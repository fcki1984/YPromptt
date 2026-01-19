import { ref, type Ref } from 'vue'
import { useDrawingStore } from '@/stores/drawingStore'
import type { DrawingModel, DrawingProvider } from '@/stores/drawingStore'

export function useDrawingProviderManagement() {
  const drawingStore = useDrawingStore()

  const showAddProviderTypeDialog = ref(false)
  const showAddProvider = ref(false)
  const editingProvider: Ref<DrawingProvider | null> = ref(null)
  const selectedProviderType = ref<'google' | 'openai' | 'custom'>('google')

  const newProvider = ref({
    name: '',
    baseURL: '',
    apiKey: ''
  })

  const getProviderTemplate = (type: 'google' | 'openai' | 'custom'): { name: string, baseURL: string, models: DrawingModel[] } => {
    if (type === 'google') {
      return {
        name: 'Gemini',
        baseURL: 'https://generativelanguage.googleapis.com/v1beta',
        models: [
          { id: 'gemini-3-pro-image-preview', name: 'gemini-3-pro-image-preview', supportsImage: true, apiType: 'google' },
          { id: 'gemini-3-flash-preview', name: 'gemini-3-flash-preview', supportsImage: false, apiType: 'google' },
        ]
      }
    }
    if (type === 'openai') {
      return {
        name: 'OpenAI Compatible',
        baseURL: 'https://api.openai.com/v1',
        models: [
          { id: 'gemini-3-pro-image-preview', name: 'gemini-3-pro-image-preview', supportsImage: true, apiType: 'openai' }
        ]
      }
    } else {
      return {
        name: '',
        baseURL: 'https://generativelanguage.googleapis.com/v1beta',
        models: []
      }
    }
  }

  const getDefaultBaseUrl = (type: string) => {
    if (type === 'google') {
      return 'https://generativelanguage.googleapis.com/v1beta'
    }
    if (type === 'openai') {
      return 'https://api.openai.com/v1'
    }
    return 'https://api.example.com/v1'
  }

  const selectProviderType = (type: 'google' | 'openai' | 'custom') => {
    showAddProviderTypeDialog.value = false
    selectedProviderType.value = type

    if (!editingProvider.value) {
      const template = getProviderTemplate(type)
      newProvider.value = {
        name: template.name,
        baseURL: template.baseURL || '',
        apiKey: ''
      }
    }

    showAddProvider.value = true
  }

  const editProvider = (provider: DrawingProvider) => {
    editingProvider.value = provider
    selectedProviderType.value = provider.type || 'google'
    newProvider.value = {
      name: provider.name,
      baseURL: provider.baseURL || '',
      apiKey: provider.apiKey || ''
    }
    showAddProvider.value = true
  }

  const closeProviderDialog = () => {
    showAddProvider.value = false
    editingProvider.value = null
    newProvider.value = { name: '', baseURL: '', apiKey: '' }
  }

  const saveProvider = () => {
    try {
      if (editingProvider.value) {
        // 编辑现有提供商
        drawingStore.updateProvider(editingProvider.value.id, {
          name: newProvider.value.name,
          apiKey: newProvider.value.apiKey,
          baseURL: newProvider.value.baseURL,
          type: selectedProviderType.value
        })
        editingProvider.value = null
      } else {
        // 添加新提供商
        const template = getProviderTemplate(selectedProviderType.value)
        const id = `drawing-${Date.now()}`

        drawingStore.addProvider({
          id,
          name: newProvider.value.name,
          type: selectedProviderType.value,
          apiKey: newProvider.value.apiKey,
          baseURL: newProvider.value.baseURL || template.baseURL,
          models: template.models
        })
      }

      newProvider.value = { name: '', baseURL: '', apiKey: '' }
      showAddProvider.value = false
      drawingStore.saveProviders()
    } catch (error) {
      console.error('保存提供商失败:', error)
      alert(`保存失败: ${error}`)
    }
  }

  const deleteProvider = (providerId: string) => {
    if (confirm('确定要删除这个提供商吗？这将同时删除其所有模型配置。')) {
      drawingStore.deleteProvider(providerId)
      drawingStore.saveProviders()
    }
  }

  return {
    showAddProviderTypeDialog,
    showAddProvider,
    editingProvider,
    selectedProviderType,
    newProvider,
    getProviderTemplate,
    getDefaultBaseUrl,
    selectProviderType,
    editProvider,
    closeProviderDialog,
    saveProvider,
    deleteProvider
  }
}
