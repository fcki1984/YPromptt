import type { DrawingMessage, ImageGenerationConfig, GeneratedImage } from '@/stores/drawingStore'

export interface OpenAIImageResponse {
  data?: Array<{
    b64_json?: string
    url?: string
    mime_type?: string
  }>
  error?: {
    message?: string
  }
}

export interface OpenAIChatResponse {
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
  error?: {
    message?: string
  }
}

export type OpenAIDrawingResponse = OpenAIImageResponse | OpenAIChatResponse

export class OpenAIDrawingService {
  private apiKey: string
  private baseUrl: string

  constructor(apiKey: string, baseUrl: string = 'https://api.openai.com/v1') {
    this.apiKey = apiKey
    this.baseUrl = baseUrl
  }

  async generateContent(
    model: string,
    conversationHistory: DrawingMessage[],
    config: ImageGenerationConfig,
    supportsImage: boolean = false,
    abortSignal?: AbortSignal,
    silent: boolean = false,
    systemPrompt?: string
  ): Promise<OpenAIDrawingResponse> {
    if (supportsImage) {
      const prompt = this.buildPrompt(conversationHistory, systemPrompt)
      const response = await this.requestImageGeneration(model, prompt, config, abortSignal, silent)
      if (response.data) {
        await this.ensureInlineBase64(response)
      }
      return response
    }

    const messages = this.buildChatMessages(conversationHistory, systemPrompt)
    const response = await this.requestChatCompletion(model, messages, config, abortSignal, silent)
    return response
  }

  extractImages(response: OpenAIDrawingResponse, prompt: string, config: ImageGenerationConfig): GeneratedImage[] {
    if (!('data' in response) || !response.data || response.data.length === 0) {
      return []
    }

    return response.data
      .filter(item => item.b64_json)
      .map((item, index) => ({
        id: `${Date.now()}-${index}`,
        imageData: item.b64_json || '',
        mimeType: item.mime_type || 'image/png',
        prompt,
        timestamp: Date.now(),
        generationConfig: JSON.parse(JSON.stringify(config))
      }))
  }

  extractText(response: OpenAIDrawingResponse): string {
    if (!('choices' in response) || !response.choices || response.choices.length === 0) {
      return ''
    }

    return response.choices[0]?.message?.content || ''
  }

  isBlocked(_response: OpenAIDrawingResponse): boolean {
    return false
  }

  getBlockReason(response: OpenAIDrawingResponse): string {
    if (response.error?.message) {
      return response.error.message
    }
    return ''
  }

  async *generateContentStream(
    model: string,
    conversationHistory: DrawingMessage[],
    config: ImageGenerationConfig,
    _supportsImage: boolean = false,
    abortSignal?: AbortSignal,
    systemPrompt?: string
  ): AsyncIterable<{ text?: string; thought?: string; done?: boolean }> {
    const messages = this.buildChatMessages(conversationHistory, systemPrompt)
    const url = this.buildChatUrl()

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: config.temperature,
        top_p: config.topP,
        max_tokens: config.maxOutputTokens,
        presence_penalty: config.presencePenalty,
        frequency_penalty: config.frequencyPenalty,
        stream: true
      }),
      signal: abortSignal
    })

    if (!response.ok || !response.body) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(`OpenAI 兼容 API 错误: ${response.status} ${response.statusText}\n详情: ${JSON.stringify(errorData)}`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''

    while (true) {
      const { value, done } = await reader.read()
      if (done) {
        break
      }
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const payload = trimmed.replace(/^data:\s*/, '')
        if (payload === '[DONE]') {
          yield { done: true }
          continue
        }
        try {
          const parsed = JSON.parse(payload)
          const delta = parsed.choices?.[0]?.delta?.content
          if (delta) {
            yield { text: delta }
          }
        } catch (error) {
          console.warn('解析 OpenAI 流式响应失败:', error)
        }
      }
    }
  }

  private buildPrompt(conversationHistory: DrawingMessage[], systemPrompt?: string) {
    const systemParts = conversationHistory
      .filter(message => message.role === 'system')
      .flatMap(message => message.parts)
      .map(part => part.text)
      .filter(Boolean)
      .join('\n')

    const userParts = conversationHistory
      .filter(message => message.role === 'user')
      .flatMap(message => message.parts)
      .map(part => part.text)
      .filter(Boolean)
      .join('\n')

    const promptParts = [systemPrompt?.trim(), systemParts, userParts].filter(Boolean)
    return promptParts.join('\n\n')
  }

  private buildChatMessages(conversationHistory: DrawingMessage[], systemPrompt?: string) {
    const messages: Array<{ role: string; content: string }> = []
    const combinedSystemPrompt = [
      systemPrompt?.trim(),
      ...conversationHistory
        .filter(message => message.role === 'system')
        .flatMap(message => message.parts)
        .map(part => part.text)
        .filter(Boolean)
    ]
      .filter(Boolean)
      .join('\n\n')

    if (combinedSystemPrompt) {
      messages.push({ role: 'system', content: combinedSystemPrompt })
    }

    conversationHistory
      .filter(message => message.role !== 'system')
      .forEach(message => {
        const content = message.parts.map(part => part.text).filter(Boolean).join('\n')
        if (content) {
          messages.push({ role: message.role, content })
        }
      })

    return messages
  }

  private async requestImageGeneration(
    model: string,
    prompt: string,
    config: ImageGenerationConfig,
    abortSignal?: AbortSignal,
    silent: boolean = false
  ): Promise<OpenAIImageResponse> {
    const url = this.buildImagesUrl()
    const size = this.resolveImageSize(config)

    if (!silent) {
      console.log('OpenAI 兼容图片请求:', { url, model, size })
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model,
        prompt,
        size,
        response_format: 'b64_json'
      }),
      signal: abortSignal
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(
        `OpenAI 兼容 API 错误: ${response.status} ${response.statusText}\n` +
        `详情: ${JSON.stringify(errorData)}`
      )
    }

    return await response.json()
  }

  private async requestChatCompletion(
    model: string,
    messages: Array<{ role: string; content: string }>,
    config: ImageGenerationConfig,
    abortSignal?: AbortSignal,
    silent: boolean = false
  ): Promise<OpenAIChatResponse> {
    const url = this.buildChatUrl()

    if (!silent) {
      console.log('OpenAI 兼容对话请求:', { url, model })
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: config.temperature,
        top_p: config.topP,
        max_tokens: config.maxOutputTokens,
        presence_penalty: config.presencePenalty,
        frequency_penalty: config.frequencyPenalty
      }),
      signal: abortSignal
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(
        `OpenAI 兼容 API 错误: ${response.status} ${response.statusText}\n` +
        `详情: ${JSON.stringify(errorData)}`
      )
    }

    return await response.json()
  }

  private buildImagesUrl() {
    const base = this.baseUrl.trim().replace(/\/+$/, '')
    if (base.includes('/images/generations')) {
      return base
    }
    if (base.includes('/images')) {
      return base
    }

    const normalizedBase = base
      .replace(/\/chat\/completions$/, '')
      .replace(/\/responses$/, '')
      .replace(/\/models$/, '')
      .replace(/\/+$/, '')

    if (normalizedBase !== base) {
      if (normalizedBase.includes('/v1') || normalizedBase.includes('/openai')) {
        return `${normalizedBase}/images/generations`
      }
      return `${normalizedBase}/v1/images/generations`
    }

    if (base.includes('/openai')) {
      return `${base}/images/generations`
    }
    if (base.includes('/v1')) {
      return `${base}/images/generations`
    }
    return `${base}/v1/images/generations`
  }

  private buildChatUrl() {
    const base = this.baseUrl.trim().replace(/\/+$/, '')
    if (base.includes('/chat/completions')) {
      return base
    }
    if (base.includes('/responses')) {
      return base
    }

    const normalizedBase = base
      .replace(/\/images\/generations$/, '')
      .replace(/\/images$/, '')
      .replace(/\/models$/, '')
      .replace(/\/+$/, '')

    if (normalizedBase !== base) {
      if (normalizedBase.includes('/v1') || normalizedBase.includes('/openai')) {
        return `${normalizedBase}/chat/completions`
      }
      return `${normalizedBase}/v1/chat/completions`
    }

    if (base.includes('/openai')) {
      return `${base}/chat/completions`
    }
    if (base.includes('/v1')) {
      return `${base}/chat/completions`
    }
    return `${base}/v1/chat/completions`
  }

  private resolveImageSize(config: ImageGenerationConfig) {
    const baseSize = config.imageSize === '4K' ? 4096 : config.imageSize === '2K' ? 2048 : 1024
    const ratio = config.aspectRatio.split(':').map(value => Number(value))
    if (ratio.length !== 2 || ratio.some(value => Number.isNaN(value) || value <= 0)) {
      return `${baseSize}x${baseSize}`
    }

    const [ratioWidth, ratioHeight] = ratio
    if (ratioWidth >= ratioHeight) {
      const height = baseSize
      const width = Math.round((baseSize * ratioWidth) / ratioHeight)
      return `${width}x${height}`
    }

    const width = baseSize
    const height = Math.round((baseSize * ratioHeight) / ratioWidth)
    return `${width}x${height}`
  }

  private async ensureInlineBase64(response: OpenAIImageResponse) {
    if (!response.data) return

    await Promise.all(
      response.data.map(async (item) => {
        if (!item.url || item.b64_json) return
        try {
          const imageResponse = await fetch(item.url)
          if (!imageResponse.ok) return
          const blob = await imageResponse.blob()
          const buffer = await blob.arrayBuffer()
          item.b64_json = this.arrayBufferToBase64(buffer)
          item.mime_type = blob.type || 'image/png'
        } catch (error) {
          console.warn('获取图片 URL 失败:', error)
        }
      })
    )
  }

  private arrayBufferToBase64(buffer: ArrayBuffer) {
    let binary = ''
    const bytes = new Uint8Array(buffer)
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }
}
