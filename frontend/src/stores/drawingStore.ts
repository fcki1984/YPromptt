import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

/**
 * 批量生成的图片候选
 */
export type ThoughtTraceItem =
  | { type: 'text'; text: string }
  | { type: 'image'; mimeType: string; data: string }

export interface ImageCandidate {
  id: string
  imageData?: string  // base64
  mimeType?: string
  thoughtSignature?: string  // 思考签名（用于后续对话）
  text?: string  // AI返回的文本描述
  prompt?: string  // 用户输入的提示词
  isGenerating?: boolean  // 是否正在生成
  error?: string  // 生成错误信息
  thoughtSummary?: string  // 模型思考摘要
  thoughtTokens?: number  // 思考令牌消耗
  thoughtTrace?: ThoughtTraceItem[]
  usageMetadata?: UsageMetadata
}

/**
 * 对话消息类型
 */
export interface DrawingMessage {
  id: string
  role: 'user' | 'model' | 'system'
  parts: MessagePart[]
  timestamp: number
  // 批量生成相关
  imageCandidates?: ImageCandidate[]  // 批量生成的图片候选列表
  selectedCandidateIndex?: number  // 用户选择的候选索引（-1表示未选择）
  isAwaitingSelection?: boolean  // 是否等待用户选择
  thoughtSummary?: string  // 模型本次回复的思考摘要
  thoughtDurationMs?: number  // 思考用时
}

/**
 * 消息片段类型
 */
export interface MessagePart {
  text?: string
  thoughtSignature?: string  // 用于多轮图像编辑的思考签名
  inlineData?: {
    mimeType: string
    data: string  // base64
  }
  isThought?: boolean  // 是否为思考内容片段
}

/**
 * 生成的图片结果
 */
export interface GeneratedImage {
  id: string
  imageData: string  // base64
  mimeType: string
  prompt: string
  timestamp: number
  generationConfig: any
  thoughtSummary?: string  // 思考过程总结
  thoughtTokens?: number  // 思考令牌使用量
  thoughtTrace?: ThoughtTraceItem[]  // 思考过程中的内容顺序
  usageMetadata?: UsageMetadata
  customResolution?: {  // 自定义分辨率信息（用于下载时转换）
    width: number
    height: number
    mappedStandard: '1K' | '2K' | '4K'
  }
}

export interface TokensDetail {
  modality: 'TEXT' | 'IMAGE'
  tokenCount: number
}

export interface UsageMetadata {
  promptTokenCount?: number
  candidatesTokenCount?: number
  totalTokenCount?: number
  thoughtsTokenCount?: number
  promptTokensDetails?: TokensDetail[]
  candidatesTokensDetails?: TokensDetail[]
}

/**
 * 模型提供商配置
 */
export interface DrawingProvider {
  id: string
  name: string
  type?: 'google' | 'openai' | 'custom'
  apiKey: string
  baseURL?: string
  models: DrawingModel[]
}

/**
 * 模型配置
 */
export interface DrawingModel {
  id: string
  name: string
  supportsImage: boolean
  apiType?: 'google' | 'openai' | 'anthropic' | 'custom'
}

/**
 * 函数声明（用于tools）
 */
export interface FunctionDeclaration {
  name: string
  description: string
  parametersJson: string  // JSON字符串（用于UI编辑）
  parameters?: any  // 解析后的JSON Schema对象
  parameterError?: string  // JSON解析错误信息
}

/**
 * Gemini 图像生成完整配置（严格按照API文档 - Nano Banana Pro）
 */
export interface ThinkingConfig {
  includeThoughts: boolean
  thinkingLevel?: 'minimal' | 'low' | 'medium' | 'high'
  thinkingBudget?: number | null
}

/**
 * Gemini 图像生成完整配置（严格按照API文档 - Nano Banana Pro）
 */
export interface ImageGenerationConfig {
  // === imageConfig ===
  aspectRatio: '1:1' | '2:3' | '3:2' | '3:4' | '4:3' | '4:5' | '5:4' | '9:16' | '16:9' | '21:9'
  imageSize: '1K' | '2K' | '4K'

  // === 基础生成参数 ===
  temperature: number  // [0.0, 2.0]
  topP: number  // [0.0, 1.0]
  topK: number  // [1, 40]
  maxOutputTokens: number  // [1, 8192]
  // candidateCount 已移除 - 大多数Gemini模型不支持此参数

  // === 停止序列 ===
  stopSequences: string[]  // 最多5个

  // === 惩罚参数 ===
  presencePenalty: number  // [-2.0, 2.0]
  frequencyPenalty: number  // [-2.0, 2.0]

  // === 高级参数 ===
  seed?: number  // 随机种子
  responseLogprobs: boolean  // 是否包含日志概率
  logprobs?: number  // [0, 20] 需启用responseLogprobs
  enableEnhancedCivicAnswers: boolean  // 增强公民诚信回答
  thinkingConfig?: ThinkingConfig  // 模型思考配置

  // === 响应格式 ===
  responseModalities: Array<'TEXT' | 'IMAGE'>  // 输出模态
  responseMimeType: 'text/plain' | 'application/json' | 'image/png' | 'image/jpeg'
  responseSchema?: any  // JSON Schema对象

  // === 工具配置 ===
  useGoogleSearch: boolean  // 是否启用Google搜索接地
  useCodeExecution: boolean  // 是否启用代码执行
  functionDeclarations: FunctionDeclaration[]  // 自定义函数声明数组
  functionCallingMode?: 'FUNCTION_CALLING_CONFIG_MODE_UNSPECIFIED' | 'AUTO' | 'ANY' | 'NONE'

  // === 媒体分辨率 ===
  mediaResolution: 'MEDIA_RESOLUTION_UNSPECIFIED' | 'MEDIA_RESOLUTION_LOW' | 'MEDIA_RESOLUTION_MEDIUM' | 'MEDIA_RESOLUTION_HIGH'

  // === 安全设置 ===
  safetySettings: SafetySetting[]
}

/**
 * 安全设置（严格按照API文档 - 完整枚举）
 */
export interface SafetySetting {
  category:
    | 'HARM_CATEGORY_UNSPECIFIED'
    | 'HARM_CATEGORY_DEROGATORY'
    | 'HARM_CATEGORY_TOXICITY'
    | 'HARM_CATEGORY_VIOLENCE'
    | 'HARM_CATEGORY_SEXUAL'
    | 'HARM_CATEGORY_MEDICAL'
    | 'HARM_CATEGORY_DANGEROUS'
    | 'HARM_CATEGORY_HARASSMENT'
    | 'HARM_CATEGORY_HATE_SPEECH'
    | 'HARM_CATEGORY_SEXUALLY_EXPLICIT'
    | 'HARM_CATEGORY_DANGEROUS_CONTENT'
    | 'HARM_CATEGORY_CIVIC_INTEGRITY'
  threshold:
    | 'HARM_BLOCK_THRESHOLD_UNSPECIFIED'
    | 'BLOCK_LOW_AND_ABOVE'
    | 'BLOCK_MEDIUM_AND_ABOVE'
    | 'BLOCK_ONLY_HIGH'
    | 'BLOCK_NONE'
    | 'OFF'
}

/**
 * 绘图设置存储键
 */
const DRAWING_SETTINGS_KEY = 'yprompt_drawing_settings'
const DRAWING_PROVIDERS_KEY = 'yprompt_drawing_providers'
const DRAWING_CONVERSATION_KEY = 'yprompt_drawing_conversation'
const DRAWING_IMAGES_KEY = 'yprompt_drawing_images'
const DRAWING_OPTIMIZER_KEY = 'yprompt_drawing_optimizer'

// 提示词优化器数据类型
export interface OptimizerState {
  omniDataCN: any  // OmniPromptStructure
  omniDataEN: any  // OmniPromptStructure
  diagnosis: any | null  // DiagnosisResult | null
  referenceImages: any[]  // UploadedImage[]
  selectedLogicModel: string  // LogicModel
  activeLang: 'cn' | 'en'
  aiToolProvider: string
  aiToolModel: string
  aiNaturalPromptEN: string
  aiNaturalPromptCN: string
  finalPrompt: string
  isAiOptimized: boolean
  hasUsedReverseEngineer: boolean
  smartInputText: string  // 绘境灵析的文本框内容
  generatedImage: string | null  // 图片生成的结果
}

export const useDrawingStore = defineStore('drawing', () => {
  // 状态
  const conversationHistory = ref<DrawingMessage[]>([])
  const generatedImages = ref<GeneratedImage[]>([])
  const isGenerating = ref(false)
  const currentStreamingText = ref('')
  const streamingThought = ref('')

  // 批量生成配置
  const batchGenerationCount = ref(1)  // 每次生成图片数量（1-4）
  const batchGenerationProgress = ref<{ current: number; total: number }>({ current: 0, total: 0 })

  // 提供商和模型配置
  const providers = ref<DrawingProvider[]>([])
  const selectedProvider = ref<string>('')
  const selectedModel = ref<string>('')
  const systemPrompt = ref<string>('')

  // 自定义分辨率配置
  const enableCustomResolution = ref(false)
  const customResolution = ref({ width: 1728, height: 2304 })

  // 提示词优化器状态
  const optimizerState = ref<OptimizerState>({
    omniDataCN: {
      meta: { aspectRatio: "1:1", imageCount: 1, negativePrompt: "" },
      artStyle: { medium: "", visualStyle: "", renderer: "" },
      subject: { main: "", action: "", clothing: "", accessories: "" },
      environment: { scene: "", time: "", weather: "", lighting: "" },
      camera: { shotType: "", lens: "", composition: "", spatial: "" },
      typography: { text: "", style: "", placement: "" },
      logic: { constraints: "", details: "" }
    },
    omniDataEN: {
      meta: { aspectRatio: "1:1", imageCount: 1, negativePrompt: "" },
      artStyle: { medium: "", visualStyle: "", renderer: "" },
      subject: { main: "", action: "", clothing: "", accessories: "" },
      environment: { scene: "", time: "", weather: "", lighting: "" },
      camera: { shotType: "", lens: "", composition: "", spatial: "" },
      typography: { text: "", style: "", placement: "" },
      logic: { constraints: "", details: "" }
    },
    diagnosis: null,
    referenceImages: [],
    selectedLogicModel: 'gemini-3-pro-preview',
    activeLang: 'cn',
    aiToolProvider: '',
    aiToolModel: '',
    aiNaturalPromptEN: '',
    aiNaturalPromptCN: '',
    finalPrompt: '',
    isAiOptimized: false,
    hasUsedReverseEngineer: false,
    smartInputText: '',
    generatedImage: null
  })

  // 图像生成配置（默认值严格按照API文档）
  const generationConfig = ref<ImageGenerationConfig>({
    // imageConfig
    aspectRatio: '1:1',
    imageSize: '1K',

    // 基础生成参数（默认值按API文档）
    temperature: 0.9,
    topP: 1.0,
    topK: 32,
    maxOutputTokens: 2048,
    // candidateCount 已移除 - 大多数Gemini模型不支持

    // 停止序列
    stopSequences: [],

    // 惩罚参数（默认值为无，即0）
    presencePenalty: 0,
    frequencyPenalty: 0,

    // 高级参数（默认值按API文档）
    seed: undefined,
    responseLogprobs: false,
    logprobs: undefined,
    enableEnhancedCivicAnswers: false,

    // 响应格式
    responseModalities: ['TEXT', 'IMAGE'],
    responseMimeType: 'text/plain',
    responseSchema: undefined,

    // 工具配置
    useGoogleSearch: false,
    useCodeExecution: false,
    functionDeclarations: [],
    functionCallingMode: 'FUNCTION_CALLING_CONFIG_MODE_UNSPECIFIED',

    // 媒体分辨率（默认值按API文档）
    mediaResolution: 'MEDIA_RESOLUTION_UNSPECIFIED',

    // 思考配置
    thinkingConfig: {
      includeThoughts: false,
      thinkingLevel: 'high',
      thinkingBudget: undefined
    },

    // 安全设置（默认中等阈值）
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' }
    ]
  })

  // 方法：添加消息到对话历史
  const addMessage = (message: DrawingMessage) => {
    conversationHistory.value.push(message)
    // saveConversation()  // 已禁用localStorage存储
  }

  // 方法：添加生成的图片
  const addGeneratedImage = (image: GeneratedImage) => {
    generatedImages.value.unshift(image)  // 最新的在前面
    // saveImages()  // 已禁用localStorage存储
  }

  // 方法：清空对话历史
  const clearConversation = () => {
    conversationHistory.value = []
    currentStreamingText.value = ''
    streamingThought.value = ''
    localStorage.removeItem(DRAWING_CONVERSATION_KEY)  // 同时清空localStorage
  }

  // 方法：清空生成的图片
  const clearImages = () => {
    generatedImages.value = []
    localStorage.removeItem(DRAWING_IMAGES_KEY)  // 同时清空localStorage
  }

  // 方法：添加提供商
  const addProvider = (provider: DrawingProvider) => {
    providers.value.push(provider)
    ensureDefaultSelections()
    saveProviders()
  }

  // 方法：更新提供商
  const updateProvider = (providerId: string, updates: Partial<DrawingProvider>) => {
    const index = providers.value.findIndex(p => p.id === providerId)
    if (index !== -1) {
      providers.value[index] = { ...providers.value[index], ...updates }
      ensureDefaultSelections()
      saveProviders()
    }
  }

  // 方法：删除提供商
  const deleteProvider = (providerId: string) => {
    providers.value = providers.value.filter(p => p.id !== providerId)
    if (selectedProvider.value === providerId) {
      selectedProvider.value = ''
      selectedModel.value = ''
    }
    ensureDefaultSelections()
    saveProviders()
  }

  // 方法：获取可用的提供商(有API Key的)
  const getAvailableProviders = () => {
    return providers.value.filter(p => p.apiKey && p.apiKey.trim() !== '')
  }

  // 方法：获取当前提供商的可用模型
  const getAvailableModels = (providerId: string) => {
    const provider = providers.value.find(p => p.id === providerId)
    return provider ? provider.models : []
  }

  // 方法：获取当前选中的提供商
  const getCurrentProvider = () => {
    return providers.value.find(p => p.id === selectedProvider.value)
  }

  // 方法：获取当前选中的模型
  const getCurrentModel = () => {
    const provider = getCurrentProvider()
    if (!provider) return null
    return provider.models.find(m => m.id === selectedModel.value) || null
  }

  const ensureDefaultSelections = () => {
    const availableProviders = getAvailableProviders()

    if (availableProviders.length === 0) {
      if (selectedProvider.value) {
        selectedProvider.value = ''
      }
      if (selectedModel.value) {
        selectedModel.value = ''
      }
      return
    }

    if (!availableProviders.some(p => p.id === selectedProvider.value)) {
      selectedProvider.value = availableProviders[0].id
    }

    const provider = providers.value.find(p => p.id === selectedProvider.value)
    if (!provider) {
      selectedProvider.value = availableProviders[0].id
      return
    }

    if (provider.models.length === 0) {
      if (selectedModel.value) {
        selectedModel.value = ''
      }
      return
    }

    if (!provider.models.some(m => m.id === selectedModel.value)) {
      selectedModel.value = provider.models[0].id
    }
  }

  // 方法：添加模型到指定提供商
  const addModel = (providerId: string, model: DrawingModel) => {
    const provider = providers.value.find(p => p.id === providerId)
    if (provider) {
      provider.models.push(model)
      ensureDefaultSelections()
      saveProviders()
    }
  }

  // 方法：删除模型
  const deleteModel = (providerId: string, modelId: string) => {
    const provider = providers.value.find(p => p.id === providerId)
    if (provider) {
      provider.models = provider.models.filter(m => m.id !== modelId)
      if (selectedModel.value === modelId) {
        selectedModel.value = ''
      }
      ensureDefaultSelections()
      saveProviders()
    }
  }

  // 方法：保存设置到 localStorage
  const saveSettings = () => {
    const settings = {
      selectedProvider: selectedProvider.value,
      selectedModel: selectedModel.value,
      generationConfig: generationConfig.value,
      systemPrompt: systemPrompt.value,
      enableCustomResolution: enableCustomResolution.value,
      customResolution: customResolution.value
    }
    localStorage.setItem(DRAWING_SETTINGS_KEY, JSON.stringify(settings))
  }

  // 方法：保存提供商到 localStorage
  const saveProviders = () => {
    localStorage.setItem(DRAWING_PROVIDERS_KEY, JSON.stringify(providers.value))
  }

  // 注意：对话历史和图片的localStorage存储功能已禁用
  // 将来会上传到对象存储服务

  // 方法：保存优化器状态
  const saveOptimizerState = () => {
    try {
      localStorage.setItem(DRAWING_OPTIMIZER_KEY, JSON.stringify(optimizerState.value))
    } catch (error) {
      console.error('保存优化器状态失败:', error)
    }
  }

  // 方法：加载优化器状态
  const loadOptimizerState = () => {
    try {
      const saved = localStorage.getItem(DRAWING_OPTIMIZER_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        optimizerState.value = { ...optimizerState.value, ...parsed }
      }
    } catch (error) {
      console.error('加载优化器状态失败:', error)
    }
  }

  // 方法：更新优化器状态（并自动保存）
  const updateOptimizerState = (updates: Partial<OptimizerState>) => {
    optimizerState.value = { ...optimizerState.value, ...updates }
    saveOptimizerState()
  }

  // 方法：重置优化器状态
  const resetOptimizerState = () => {
    optimizerState.value = {
      omniDataCN: {
        meta: { aspectRatio: "1:1", imageCount: 1, negativePrompt: "" },
        artStyle: { medium: "", visualStyle: "", renderer: "" },
        subject: { main: "", action: "", clothing: "", accessories: "" },
        environment: { scene: "", time: "", weather: "", lighting: "" },
        camera: { shotType: "", lens: "", composition: "", spatial: "" },
        typography: { text: "", style: "", placement: "" },
        logic: { constraints: "", details: "" }
      },
      omniDataEN: {
        meta: { aspectRatio: "1:1", imageCount: 1, negativePrompt: "" },
        artStyle: { medium: "", visualStyle: "", renderer: "" },
        subject: { main: "", action: "", clothing: "", accessories: "" },
        environment: { scene: "", time: "", weather: "", lighting: "" },
        camera: { shotType: "", lens: "", composition: "", spatial: "" },
        typography: { text: "", style: "", placement: "" },
        logic: { constraints: "", details: "" }
      },
      diagnosis: null,
      referenceImages: [],
      selectedLogicModel: 'gemini-3-pro-preview',
      activeLang: 'cn',
      aiToolProvider: '',
      aiToolModel: '',
      aiNaturalPromptEN: '',
      aiNaturalPromptCN: '',
      finalPrompt: '',
      isAiOptimized: false,
      hasUsedReverseEngineer: false,
      smartInputText: '',
      generatedImage: null
    }
    saveOptimizerState()
  }

  // 方法：从 localStorage 加载设置
  const loadSettings = () => {
    const inferProviderType = (provider: DrawingProvider): DrawingProvider['type'] => {
      if (provider.type) return provider.type
      const modelTypes = provider.models?.map(model => model.apiType).filter(Boolean) as DrawingModel['apiType'][]
      if (modelTypes.length > 0) {
        const uniqueTypes = Array.from(new Set(modelTypes))
        if (uniqueTypes.length === 1) {
          if (uniqueTypes[0] === 'openai') {
            return 'openai'
          }
          if (uniqueTypes[0] === 'custom') {
            return 'custom'
          }
          return 'google'
        }
      }
      if (provider.baseURL?.includes('openai')) {
        return 'openai'
      }
      return 'google'
    }

    try {
      const saved = localStorage.getItem(DRAWING_SETTINGS_KEY)
      if (saved) {
        const settings = JSON.parse(saved)
        if (settings.selectedProvider) selectedProvider.value = settings.selectedProvider
        if (settings.selectedModel) selectedModel.value = settings.selectedModel
        if (settings.systemPrompt) systemPrompt.value = settings.systemPrompt

        // 加载自定义分辨率配置
        if (settings.enableCustomResolution !== undefined) {
          enableCustomResolution.value = settings.enableCustomResolution
        }
        if (settings.customResolution) {
          customResolution.value = settings.customResolution
        }

        if (settings.generationConfig) {
          generationConfig.value = {
            ...generationConfig.value,
            ...settings.generationConfig
          }

          // 修复旧数据：确保 functionDeclarations 存在
          if (!generationConfig.value.functionDeclarations) {
            generationConfig.value.functionDeclarations = []
          }

          if (!generationConfig.value.thinkingConfig) {
            generationConfig.value.thinkingConfig = {
              includeThoughts: false,
              thinkingLevel: 'high',
              thinkingBudget: undefined
            }
          }
        }
      }

      // 加载提供商
      const savedProviders = localStorage.getItem(DRAWING_PROVIDERS_KEY)
      if (savedProviders) {
        const parsedProviders = JSON.parse(savedProviders) as DrawingProvider[]
        providers.value = parsedProviders.map(provider => ({
          ...provider,
          type: provider.type || inferProviderType(provider)
        }))
      } else {
        // 初始化默认提供商
        providers.value = [{
          id: 'gemini-default',
          name: 'Gemini',
          type: 'google',
          apiKey: '',
          baseURL: 'https://generativelanguage.googleapis.com/v1beta',
          models: [
            { id: 'gemini-3-pro-image-preview', name: 'gemini-3-pro-image-preview', supportsImage: true, apiType: 'google' },
            { id: 'gemini-3-flash-preview', name: 'gemini-3-flash-preview', supportsImage: false, apiType: 'google' }
          ]
        }]
        saveProviders()
      }

      // 已禁用localStorage存储 - 将来会上传到对象存储
      // // 加载对话历史
      // const savedConversation = localStorage.getItem(DRAWING_CONVERSATION_KEY)
      // if (savedConversation) {
      //   conversationHistory.value = JSON.parse(savedConversation)
      // }

      // // 加载图片数据
      // const savedImages = localStorage.getItem(DRAWING_IMAGES_KEY)
      // if (savedImages) {
      //   generatedImages.value = JSON.parse(savedImages)
      // }
      ensureDefaultSelections()
    } catch (error) {
      console.error('加载绘图设置失败:', error)
    }
  }

  // 方法：删除指定图片
  const deleteImage = (imageId: string) => {
    const index = generatedImages.value.findIndex(img => img.id === imageId)
    if (index !== -1) {
      generatedImages.value.splice(index, 1)
      // saveImages()  // 已禁用localStorage存储
    }
  }

  // 方法：删除指定消息
  const deleteMessage = (messageId: string) => {
    const index = conversationHistory.value.findIndex(msg => msg.id === messageId)
    if (index !== -1) {
      conversationHistory.value.splice(index, 1)
      // saveConversation()  // 已禁用localStorage存储
    }
  }

  watch(providers, () => {
    ensureDefaultSelections()
  }, { deep: true })

  watch(selectedProvider, () => {
    const provider = getCurrentProvider()
    if (!provider) {
      if (selectedModel.value) {
        selectedModel.value = ''
      }
      return
    }

    if (provider.models.length === 0) {
      if (selectedModel.value) {
        selectedModel.value = ''
      }
      return
    }

    if (!provider.models.some(m => m.id === selectedModel.value)) {
      selectedModel.value = provider.models[0].id
    }
  })

  // 初始化时加载设置
  loadSettings()
  loadOptimizerState()

  return {
    // 状态
    conversationHistory,
    generatedImages,
    isGenerating,
    currentStreamingText,
    streamingThought,
    batchGenerationCount,
    batchGenerationProgress,
    providers,
    selectedProvider,
    selectedModel,
    systemPrompt,
    generationConfig,
    enableCustomResolution,
    customResolution,
    optimizerState,

    // 方法
    addMessage,
    addGeneratedImage,
    clearConversation,
    clearImages,
    addProvider,
    updateProvider,
    deleteProvider,
    getAvailableProviders,
    getAvailableModels,
    getCurrentProvider,
    getCurrentModel,
    addModel,
    deleteModel,
    setSystemPrompt: (prompt: string) => { systemPrompt.value = prompt },
    saveSettings,
    saveProviders,
    loadSettings,
    deleteImage,
    deleteMessage,
    updateOptimizerState,
    saveOptimizerState,
    resetOptimizerState
  }
})
