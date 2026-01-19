import type { DrawingMessage, ImageGenerationConfig, GeneratedImage, ThoughtTraceItem } from '@/stores/drawingStore'
import { getThinkingSupport } from '@/utils/thinkingSupport'

/**
 * Gemini API 请求体
 */
interface GeminiRequest {
  contents: Array<{
    role: string
    parts: Array<{
      text?: string
      thoughtSignature?: string
      inlineData?: {
        mimeType: string
        data: string
      }
      thought?: boolean
    }>
  }>
  generationConfig?: any
  safetySettings?: Array<{
    category: string
    threshold: string
  }>
  systemInstruction?: {
    parts: Array<{
      text: string
    }>
  }
  tools?: Array<any>
}

/**
 * Gemini API 响应
 */
export interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text?: string
        thoughtSignature?: string  // 图像编辑思考签名
        thought?: boolean
        inlineData?: {
          mimeType: string
          data: string
        }
      }>
      role: string
    }
    finishReason: string
    index: number
    safetyRatings: Array<{
      category: string
      probability: string
    }>
  }>
  promptFeedback?: {
    safetyRatings: Array<{
      category: string
      probability: string
    }>
    blockReason?: string
  }
  usageMetadata?: {
    promptTokenCount: number
    candidatesTokenCount: number
    totalTokenCount: number
    thoughtsTokenCount?: number
  }
}

/**
 * Gemini 绘图服务类
 */
export class GeminiDrawingService {
  private apiKey: string
  private baseUrl: string

  constructor(apiKey: string, baseUrl: string = 'https://generativelanguage.googleapis.com/v1beta') {
    this.apiKey = apiKey
    this.baseUrl = baseUrl
  }

  /**
   * 生成内容（文本或图像）
   */
  async generateContent(
    model: string,
    conversationHistory: DrawingMessage[],
    config: ImageGenerationConfig,
    supportsImage: boolean = false,  // 标识模型是否支持图像生成
    abortSignal?: AbortSignal,  // 支持中断请求
    silent: boolean = false,  // 静默模式，不输出日志
    systemPrompt?: string
  ): Promise<GeminiResponse> {
    // 使用 header 传递 API key
    const url = `${this.baseUrl}/models/${model}:generateContent`

    // 优化：图像生成模型只需要最近的上下文（加快生图速度）
    // 只取最近一条AI消息（包含图片+thoughtSignature）和最新用户消息
    let messagesToSend = conversationHistory
    if (supportsImage && conversationHistory.length > 2) {
      const filteredMessages: DrawingMessage[] = []

      // 从后往前找最近的AI消息（可能包含图片和thoughtSignature）
      for (let i = conversationHistory.length - 1; i >= 0; i--) {
        const msg = conversationHistory[i]
        if (msg.role === 'model') {
          filteredMessages.unshift(msg)
          break
        }
      }

      // 添加最新的用户消息
      for (let i = conversationHistory.length - 1; i >= 0; i--) {
        const msg = conversationHistory[i]
        if (msg.role === 'user') {
          filteredMessages.push(msg)
          break
        }
      }

      messagesToSend = filteredMessages
    }

    // 构建请求体
    const requestBody: GeminiRequest = {
      contents: messagesToSend
        .filter(msg => msg.role !== 'system')
        .map(msg => ({
          role: msg.role,
          parts: msg.parts.map(part => {
            const apiPart: any = {}

            // 添加 text
            if (part.text) {
              apiPart.text = part.text
            }

            // 添加 thoughtSignature（用于多轮图像编辑）
            if (part.thoughtSignature) {
              apiPart.thoughtSignature = part.thoughtSignature
            }

            // 添加 inlineData
            if (part.inlineData) {
              apiPart.inlineData = {
                mimeType: part.inlineData.mimeType,
                data: part.inlineData.data
              }
            }

            return apiPart
          }).filter(part => Object.keys(part).length > 0)  // 过滤空对象
        })),
      generationConfig: this.buildGenerationConfig(config, supportsImage, model),
      safetySettings: config.safetySettings
    }

    // 添加 tools（如果启用了工具）
    const tools: any[] = []
    if (config.useGoogleSearch) {
      tools.push({ google_search: {} })
    }
    if (config.useCodeExecution) {
      tools.push({ code_execution: {} })
    }
    if (tools.length > 0) {
      requestBody.tools = tools
    }

    // 添加 systemInstruction（如果对话历史中有 system 消息）
    const systemMessages = conversationHistory.filter(msg => msg.role === 'system')
    const combinedSystemParts: string[] = []
    const trimmedCustomPrompt = systemPrompt?.trim()
    if (trimmedCustomPrompt) {
      combinedSystemParts.push(trimmedCustomPrompt)
    }
    if (systemMessages.length > 0) {
      const systemText = systemMessages
        .map(msg => msg.parts.filter(p => p.text).map(p => p.text).join('\n'))
        .join('\n')
      if (systemText) {
        combinedSystemParts.push(systemText)
      }
    }
    if (combinedSystemParts.length > 0) {
      requestBody.systemInstruction = {
        parts: [{ text: combinedSystemParts.join('\n\n') }]
      }
    }

    if (!silent) {
      console.log('Gemini API 请求:', {
        url,
        model,
        conversationCount: conversationHistory.length,
        config: requestBody.generationConfig
      })
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.apiKey  // 添加 API Key 到 header
      },
      body: JSON.stringify(requestBody),
      signal: abortSignal  // 支持中断请求
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(
        `Gemini API 错误: ${response.status} ${response.statusText}\n` +
        `详情: ${JSON.stringify(errorData)}`
      )
    }

    const data: GeminiResponse = await response.json()
    if (!silent) {
      console.log('Gemini API 响应:', data)
    }

    return data
  }

  /**
   * 构建 GenerationConfig（严格按照API文档）
   */
  private buildGenerationConfig(config: ImageGenerationConfig, supportsImage: boolean = false, modelId?: string) {
    const generationConfig: any = {}

    // 基础生成参数 - 根据官方文档，gemini-2.5-flash-image 支持这些参数
    generationConfig.temperature = config.temperature
    generationConfig.topP = config.topP
    generationConfig.topK = config.topK
    generationConfig.maxOutputTokens = config.maxOutputTokens

    // candidateCount - 大多数模型都不支持此参数或只支持1
    // 图像生成模型不支持，大部分文本模型也只支持candidateCount=1
    // 为避免API错误，完全移除此参数，让API使用默认值
    // if (!supportsImage) {
    //   generationConfig.candidateCount = config.candidateCount
    // }

    // 停止序列（如果有）
    if (config.stopSequences && config.stopSequences.length > 0) {
      generationConfig.stopSequences = config.stopSequences
    }

    // 惩罚参数（只在非零时添加）
    if (config.presencePenalty !== 0) {
      generationConfig.presencePenalty = config.presencePenalty
    }
    if (config.frequencyPenalty !== 0) {
      generationConfig.frequencyPenalty = config.frequencyPenalty
    }

    // 随机种子（如果有）
    if (config.seed !== undefined && config.seed !== null) {
      generationConfig.seed = config.seed
    }

    // 日志概率
    if (config.responseLogprobs) {
      generationConfig.responseLogprobs = true
      if (config.logprobs !== undefined && config.logprobs !== null) {
        generationConfig.logprobs = config.logprobs
      }
    }

    // 增强公民诚信回答
    if (config.enableEnhancedCivicAnswers) {
      generationConfig.enableEnhancedCivicAnswers = true
    }

    // 思考配置 thinkingConfig - 根据模型支持情况添加
    if (config.thinkingConfig && config.thinkingConfig.includeThoughts) {
      // 获取模型的思考支持情况
      const thinkingSupport = getThinkingSupport(modelId, { supportsImage })

      // 调试日志
      console.log('[buildGenerationConfig] 思考配置检测:', {
        modelId,
        supportsImage,
        supported: thinkingSupport.supported,
        thinkingMode: thinkingSupport.mode,
        includeThoughtsSupported: thinkingSupport.includeThoughts,
        configThinkingLevel: config.thinkingConfig.thinkingLevel,
        configThinkingBudget: config.thinkingConfig.thinkingBudget
      })

      // 只有当模型支持思考配置时才添加 thinkingConfig
      if (thinkingSupport.supported && thinkingSupport.includeThoughts) {
        generationConfig.thinkingConfig = {
          includeThoughts: true
        }

        // 只在支持 thinkingLevel 的模型上添加（mode === 'level'）
        if (thinkingSupport.mode === 'level' && config.thinkingConfig.thinkingLevel) {
          generationConfig.thinkingConfig.thinkingLevel = config.thinkingConfig.thinkingLevel
          console.log('[buildGenerationConfig] 添加 thinkingLevel:', config.thinkingConfig.thinkingLevel)
        }

        // 只在支持 thinkingBudget 的模型上添加（mode === 'budget'）
        if (thinkingSupport.mode === 'budget' &&
            config.thinkingConfig.thinkingBudget !== undefined &&
            config.thinkingConfig.thinkingBudget !== null) {
          generationConfig.thinkingConfig.thinkingBudget = config.thinkingConfig.thinkingBudget
          console.log('[buildGenerationConfig] 添加 thinkingBudget:', config.thinkingConfig.thinkingBudget)
        }

        console.log('[buildGenerationConfig] 最终 thinkingConfig:', generationConfig.thinkingConfig)
      } else {
        console.log('[buildGenerationConfig] 模型不支持思考配置，跳过添加 thinkingConfig')
      }
    }

    // 图像配置 imageConfig（仅当模型支持图像生成时）
    // 注意: gemini-2.5-flash-image 不支持 imageSize，只支持 aspectRatio
    if (supportsImage && config.aspectRatio) {
      generationConfig.imageConfig = {
        aspectRatio: config.aspectRatio
      }
      // imageSize 不支持，已移除
    }

    // 以下参数不在官方文档的 generationConfig 列表中，不添加
    // responseModalities - 文档未列出
    // responseMimeType - 文档未列出
    // mediaResolution - 文档未列出

    return generationConfig
  }

  /**
   * 从响应中提取图片
   */
  extractImages(response: GeminiResponse, prompt: string, config: ImageGenerationConfig): GeneratedImage[] {
    const images: GeneratedImage[] = []

    if (!response.candidates || response.candidates.length === 0) {
      return images
    }

    response.candidates.forEach((candidate, index) => {
      if (candidate.content && candidate.content.parts) {
        const thoughtSegments: string[] = []
        const thoughtTrace: ThoughtTraceItem[] = []

        candidate.content.parts.forEach(part => {
          if ((part as any).thought) {
            if (part.text) {
              const cleaned = part.text.trim()
              if (cleaned) {
                thoughtSegments.push(cleaned)
                thoughtTrace.push({ type: 'text', text: cleaned })
              }
            } else if (part.inlineData) {
              thoughtTrace.push({
                type: 'image',
                mimeType: part.inlineData.mimeType,
                data: part.inlineData.data
              })
            }
            return
          }

          if (part.inlineData) {
            images.push({
              id: `${Date.now()}-${index}`,
              imageData: part.inlineData.data,
              mimeType: part.inlineData.mimeType,
          prompt,
          timestamp: Date.now(),
          generationConfig: JSON.parse(JSON.stringify(config)),
          thoughtSummary: thoughtSegments.length > 0 ? thoughtSegments.join('\n\n') : undefined,
          thoughtTokens: response.usageMetadata?.thoughtsTokenCount,
          thoughtTrace: thoughtTrace.length > 0 ? thoughtTrace.map(item => ({ ...item })) as ThoughtTraceItem[] : undefined,
          usageMetadata: response.usageMetadata ? JSON.parse(JSON.stringify(response.usageMetadata)) : undefined
        })
      }
    })
      }
    })

    return images
  }

  /**
   * 从响应中提取文本
   */
  extractText(response: GeminiResponse): string {
    if (!response.candidates || response.candidates.length === 0) {
      return ''
    }

    const candidate = response.candidates[0]
    if (!candidate.content || !candidate.content.parts) {
      return ''
    }

    return candidate.content.parts
      .filter(part => part.text && !(part as any).thought)
      .map(part => part.text)
      .join('')
  }

  /**
   * 检查响应是否被安全过滤器阻止
   */
  isBlocked(response: GeminiResponse): boolean {
    return !!(response.promptFeedback?.blockReason)
  }

  /**
   * 获取阻止原因
   */
  getBlockReason(response: GeminiResponse): string {
    if (!response.promptFeedback?.blockReason) {
      return ''
    }
    return `内容被阻止: ${response.promptFeedback.blockReason}`
  }

  /**
   * 流式生成内容（仅用于纯文本模型）
   */
  async *generateContentStream(
    model: string,
    conversationHistory: DrawingMessage[],
    config: ImageGenerationConfig,
    supportsImage: boolean = false,
    abortSignal?: AbortSignal,  // 支持中断请求
    systemPrompt?: string
  ): AsyncIterable<{ text?: string; thought?: string; done?: boolean }> {
    // 使用SSE格式的流式API，通过 header 传递 API key
    const url = `${this.baseUrl}/models/${model}:streamGenerateContent?alt=sse`

    // 优化：图像生成模型只需要最近的上下文（加快生图速度）
    // 只取最近一条AI消息（包含图片+thoughtSignature）和最新用户消息
    let messagesToSend = conversationHistory
    if (supportsImage && conversationHistory.length > 2) {
      const filteredMessages: DrawingMessage[] = []

      // 从后往前找最近的AI消息（可能包含图片和thoughtSignature）
      for (let i = conversationHistory.length - 1; i >= 0; i--) {
        const msg = conversationHistory[i]
        if (msg.role === 'model') {
          filteredMessages.unshift(msg)
          break
        }
      }

      // 添加最新的用户消息
      for (let i = conversationHistory.length - 1; i >= 0; i--) {
        const msg = conversationHistory[i]
        if (msg.role === 'user') {
          filteredMessages.push(msg)
          break
        }
      }

      messagesToSend = filteredMessages
    }

    // 构建请求体（与非流式相同）
    const requestBody: GeminiRequest = {
      contents: messagesToSend
        .filter(msg => msg.role !== 'system')
        .map(msg => ({
          role: msg.role,
          parts: msg.parts.map(part => {
            const apiPart: any = {}
            if (part.text) apiPart.text = part.text
            if (part.thoughtSignature) apiPart.thoughtSignature = part.thoughtSignature
            if (part.inlineData) apiPart.inlineData = {
              mimeType: part.inlineData.mimeType,
              data: part.inlineData.data
            }
            return apiPart
          }).filter(part => Object.keys(part).length > 0)
        })),
      generationConfig: this.buildGenerationConfig(config, supportsImage, model),
      safetySettings: config.safetySettings
    }

    // 添加 tools（如果启用了工具）
    const tools: any[] = []
    if (config.useGoogleSearch) {
      tools.push({ google_search: {} })
    }
    if (config.useCodeExecution) {
      tools.push({ code_execution: {} })
    }
    if (tools.length > 0) {
      requestBody.tools = tools
    }

    // 添加 systemInstruction
    const systemMessages = conversationHistory.filter(msg => msg.role === 'system')
    const combinedSystemParts: string[] = []
    const trimmedCustomPrompt = systemPrompt?.trim()
    if (trimmedCustomPrompt) {
      combinedSystemParts.push(trimmedCustomPrompt)
    }
    if (systemMessages.length > 0) {
      const systemText = systemMessages
        .map(msg => msg.parts.filter(p => p.text).map(p => p.text).join('\n'))
        .join('\n')
      if (systemText) {
        combinedSystemParts.push(systemText)
      }
    }
    if (combinedSystemParts.length > 0) {
      requestBody.systemInstruction = {
        parts: [{ text: combinedSystemParts.join('\n\n') }]
      }
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.apiKey  // 添加 API Key 到 header
      },
      body: JSON.stringify(requestBody),
      signal: abortSignal  // 支持中断请求
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(
        `Gemini API 错误: ${response.status} ${response.statusText}\n` +
        `详情: ${JSON.stringify(errorData)}`
      )
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('无法获取响应流')
    }

    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()

        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          // SSE格式: "data: {...}"
          if (!line.trim()) continue
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6).trim()  // 移除 "data: " 前缀
            if (!jsonStr) continue

            try {
              const chunk: GeminiResponse = JSON.parse(jsonStr)

              // 检查是否被阻止
              if (this.isBlocked(chunk)) {
                throw new Error(this.getBlockReason(chunk))
              }

              if (chunk.candidates && chunk.candidates.length > 0) {
                const candidate = chunk.candidates[0]
                if (candidate.content && candidate.content.parts) {
                  for (const part of candidate.content.parts) {
                    if ((part as any).thought && part.text) {
                      yield { thought: part.text }
                      continue
                    }
                    if (part.text && !(part as any).thought) {
                      yield { text: part.text }
                    }
                  }
                }
              }
            } catch (e) {
              console.error('解析SSE响应失败:', e, 'Line:', jsonStr)
            }
          }
        }
      }

      yield { done: true }
    } finally {
      reader.releaseLock()
    }
  }

  /**
   * 验证 API Key
   */
  async validateApiKey(): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/models/gemini-1.5-pro:generateContent`
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.apiKey  // 添加 API Key 到 header
        },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [{ text: 'Hello' }]
          }]
        })
      })
      return response.ok || response.status === 400  // 400 也表示 API Key 有效（只是请求格式问题）
    } catch {
      return false
    }
  }

  /**
   * 获取可用模型列表
   */
  async listModels(): Promise<Array<{ name: string; displayName: string }>> {
    try {
      const url = `${this.baseUrl}/models`
      const response = await fetch(url, {
        headers: {
          'x-goog-api-key': this.apiKey  // 添加 API Key 到 header
        }
      })
      if (!response.ok) {
        throw new Error('获取模型列表失败')
      }
      const data = await response.json()
      return data.models
        .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m: any) => ({
          name: m.name.replace('models/', ''),
          displayName: m.displayName
        }))
    } catch (error) {
      console.error('获取模型列表失败:', error)
      return []
    }
  }
}

/**
 * 辅助函数：将文件转换为 base64
 */
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // 移除 data:image/xxx;base64, 前缀
      const base64 = result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * 辅助函数：获取文件的 MIME 类型
 */
export function getFileMimeType(file: File): string {
  return file.type || 'image/jpeg'
}
