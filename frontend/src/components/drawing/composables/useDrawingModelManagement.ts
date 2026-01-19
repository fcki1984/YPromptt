import { ref, computed } from 'vue'
import { useDrawingStore } from '@/stores/drawingStore'
import type { DrawingModel } from '@/stores/drawingStore'
import { AIService } from '@/services/aiService'

export function useDrawingModelManagement() {
  const drawingStore = useDrawingStore()
  const aiService = AIService.getInstance()

  const showAddModelDialog = ref(false)
  const addingModelToProvider = ref<string>('')
  const editingModel = ref<DrawingModel | null>(null)
  const loadingModels = ref(false)
  const providerModelsCache = ref<Record<string, string[]>>({})
  const modelFetchError = ref('')
  const modelSearchKeyword = ref('')

  const newModel = ref({
    id: '',
    name: '',
    supportsImage: true,
    apiType: 'google' as 'google' | 'openai' | 'anthropic' | 'custom'
  })

  // 判断模型是否支持图像生成
  const isImageGenerationModel = (modelId: string): boolean => {
    const modelIdLower = modelId.toLowerCase()

    // 方法1: 直接匹配已知的图像生成模型关键词
    const imageKeywords = [
      'image',           // gemini-xxx-image, gemini-xxx-image-preview
      'imagen',          // imagen系列
      'img'              // 其他可能的缩写
    ]

    // 检查是否包含图像生成关键词
    const hasImageKeyword = imageKeywords.some(keyword => modelIdLower.includes(keyword))

    // 方法2: 排除明确不支持图像生成的模型
    const nonImageKeywords = [
      'text-only',
      'code-only',
      'chat-only'
    ]

    const isNonImageModel = nonImageKeywords.some(keyword => modelIdLower.includes(keyword))

    return hasImageKeyword && !isNonImageModel
  }

  // 获取当前筛选后的模型列表
  const getCurrentProviderModels = computed(() => {
    const allModels = providerModelsCache.value[addingModelToProvider.value] || []

    let filteredModels = allModels

    // 1. 如果勾选了"支持图像生成",只显示支持图像生成的模型
    if (newModel.value.supportsImage) {
      filteredModels = filteredModels.filter(modelId => isImageGenerationModel(modelId))
    }

    // 2. 应用搜索关键词筛选
    if (modelSearchKeyword.value.trim()) {
      const keywords = modelSearchKeyword.value.toLowerCase().trim().split(/\s+/)
      filteredModels = filteredModels.filter(modelId => {
        const modelIdLower = modelId.toLowerCase()
        return keywords.every(keyword => modelIdLower.includes(keyword))
      })
    }

    return filteredModels
  })

  const getProviderForModel = (providerId: string) => {
    return drawingStore.providers.find(p => p.id === providerId)
  }

  const showAddModel = (providerId: string) => {
    const provider = getProviderForModel(providerId)
    addingModelToProvider.value = providerId
    editingModel.value = null
    loadingModels.value = false
    modelFetchError.value = ''
    modelSearchKeyword.value = ''
    const providerType = provider?.type || 'google'
    newModel.value = {
      id: '',
      name: '',
      supportsImage: true,
      apiType: providerType === 'openai' ? 'openai' : providerType === 'custom' ? 'custom' : 'google'
    }
    showAddModelDialog.value = true
  }

  const editModel = (providerId: string, model: DrawingModel) => {
    const provider = getProviderForModel(providerId)
    addingModelToProvider.value = providerId
    editingModel.value = model
    modelSearchKeyword.value = ''
    newModel.value = {
      id: model.id,
      name: model.name,
      supportsImage: model.supportsImage,
      apiType: model.apiType || (provider?.type === 'openai' ? 'openai' : provider?.type === 'custom' ? 'custom' : 'google')
    }
    showAddModelDialog.value = true
  }

  const closeAddModelDialog = () => {
    showAddModelDialog.value = false
    modelSearchKeyword.value = ''
    addingModelToProvider.value = ''
    modelFetchError.value = ''
    editingModel.value = null
    newModel.value = {
      id: '',
      name: '',
      supportsImage: true,
      apiType: 'google'
    }
  }

  const fetchAvailableModels = async () => {
    try {
      loadingModels.value = true
      modelFetchError.value = ''

      const providerId = addingModelToProvider.value
      const provider = getProviderForModel(providerId)
      if (!provider) {
        throw new Error('未找到提供商信息')
      }

      if (!provider.apiKey || !provider.baseURL) {
        throw new Error('请先配置提供商的API密钥和基础URL')
      }

      // 为绘图模块获取Gemini模型
      const providerType = provider.type || 'google'
      const requestType = providerType === 'openai' ? 'openai' : 'google'
      const models = await aiService.getAvailableModels(
        {
          id: provider.id,
          name: provider.name,
          type: requestType,
          apiKey: provider.apiKey,
          baseUrl: provider.baseURL,
          models: [],
          enabled: true
        },
        requestType
      )

      providerModelsCache.value[providerId] = models

      if (models.length === 0) {
        modelFetchError.value = '未找到可用模型'
      }
    } catch (error: any) {
      console.error('获取模型列表失败:', error)
      modelFetchError.value = error.message || '获取模型列表失败，请手动输入模型ID'
    } finally {
      loadingModels.value = false
    }
  }

  const selectModel = (modelId: string) => {
    newModel.value.id = modelId
    if (!newModel.value.name) {
      newModel.value.name = modelId
    }
  }

  const addCustomModel = () => {
    if (!newModel.value.id || !newModel.value.name) {
      alert('请填写模型ID和名称')
      return
    }

    try {
      if (editingModel.value) {
        // 编辑模型 - 删除旧的,添加新的
        drawingStore.deleteModel(addingModelToProvider.value, editingModel.value.id)
        drawingStore.addModel(addingModelToProvider.value, {
          id: newModel.value.id,
          name: newModel.value.name,
          supportsImage: newModel.value.supportsImage,
          apiType: newModel.value.apiType || 'google'
        })
      } else {
        // 添加新模型
        drawingStore.addModel(addingModelToProvider.value, {
          id: newModel.value.id,
          name: newModel.value.name,
          supportsImage: newModel.value.supportsImage,
          apiType: newModel.value.apiType || 'google'
        })
      }

      closeAddModelDialog()
      drawingStore.saveProviders()
    } catch (error) {
      console.error('添加模型失败:', error)
      alert(`添加模型失败: ${error}`)
    }
  }

  const deleteModel = (providerId: string, modelId: string) => {
    if (confirm('确定要删除这个模型吗？')) {
      drawingStore.deleteModel(providerId, modelId)
      drawingStore.saveProviders()
    }
  }

  return {
    showAddModelDialog,
    addingModelToProvider,
    editingModel,
    loadingModels,
    providerModelsCache,
    modelFetchError,
    modelSearchKeyword,
    newModel,
    getCurrentProviderModels,
    getProviderForModel,
    showAddModel,
    editModel,
    closeAddModelDialog,
    fetchAvailableModels,
    selectModel,
    addCustomModel,
    deleteModel
  }
}
