import type { DrawingMessage, ImageGenerationConfig, GeneratedImage, ThoughtTraceItem, UsageMetadata } from '@/stores/drawingStore'
import { buildOpenAIChatUrl } from '@/services/ai/utils/apiUrlBuilder'
import type { DrawingServiceResponse } from '@/services/drawingServiceTypes'

interface OpenAIChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>
}

interface OpenAIResponse {
  choices?: Array<{
    message?: {
      content?: string | Array<any>
    }
    finish_reason?: string
    index?: number
  }>
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
  data?: Array<{ b64_json?: string; revised_prompt?: string; mime_type?: string }>
}

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
  ): Promise<DrawingServiceResponse> {
    const url = buildOpenAIChatUrl(this.baseUrl)
    const messages = this.buildMessages(conversationHistory, systemPrompt)

    if (!silent) {
      console.log('OpenAI Chat 请求:', {
        url,
        model,
        conversationCount: conversationHistory.length
      })
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(this.buildRequestBody(model, messages, config, supportsImage)),
      signal: abortSignal
    })

    const data: OpenAIResponse = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(
        `OpenAI API 错误: ${response.status} ${response.statusText}\n` +
        `详情: ${JSON.stringify(data)}`
      )
    }

    return this.normalizeResponse(data, config)
  }

  async *generateContentStream(
    model: string,
    conversationHistory: DrawingMessage[],
    config: ImageGenerationConfig,
    supportsImage: boolean = false,
    abortSignal?: AbortSignal,
    systemPrompt?: string
  ): AsyncIterable<{ text?: string; thought?: string; done?: boolean }> {
    const url = buildOpenAIChatUrl(this.baseUrl)
    const messages = this.buildMessages(conversationHistory, systemPrompt)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        ...this.buildRequestBody(model, messages, config, supportsImage),
        stream: true
      }),
      signal: abortSignal
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(
        `OpenAI API 错误: ${response.status} ${response.statusText}\n` +
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
          if (!line.trim()) continue
          if (!line.startsWith('data: ')) continue

          const jsonStr = line.slice(6).trim()
          if (jsonStr === '[DONE]') {
            yield { done: true }
            continue
          }

          try {
            const chunk = JSON.parse(jsonStr)
            const delta = chunk.choices?.[0]?.delta
            if (!delta) continue

            if (typeof delta.content === 'string') {
              yield { text: delta.content }
            } else if (Array.isArray(delta.content)) {
              for (const item of delta.content) {
                if (item?.type === 'text' && item.text) {
                  yield { text: item.text }
                }
              }
            }
          } catch (e) {
            console.error('解析OpenAI流式响应失败:', e, 'Line:', jsonStr)
          }
        }
      }

      yield { done: true }
    } finally {
      reader.releaseLock()
    }
  }

  extractImages(response: DrawingServiceResponse, prompt: string, config: ImageGenerationConfig): GeneratedImage[] {
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
              thoughtTrace: thoughtTrace.length > 0 ? thoughtTrace.map(item => ({ ...item })) as ThoughtTraceItem[] : undefined,
              usageMetadata: response.usageMetadata ? JSON.parse(JSON.stringify(response.usageMetadata)) : undefined
            })
          }
        })
      }
    })

    return images
  }

  extractText(response: DrawingServiceResponse): string {
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

  isBlocked(response: DrawingServiceResponse): boolean {
    return response.promptFeedback?.blockReason === 'content_filter'
  }

  getBlockReason(response: DrawingServiceResponse): string {
    if (!response.promptFeedback?.blockReason) {
      return ''
    }
    return `内容被阻止: ${response.promptFeedback.blockReason}`
  }

  private buildMessages(conversationHistory: DrawingMessage[], systemPrompt?: string): OpenAIChatMessage[] {
    const messages: OpenAIChatMessage[] = []
    const systemParts: string[] = []

    const trimmedCustomPrompt = systemPrompt?.trim()
    if (trimmedCustomPrompt) {
      systemParts.push(trimmedCustomPrompt)
    }

    const systemMessages = conversationHistory.filter(msg => msg.role === 'system')
    if (systemMessages.length > 0) {
      const systemText = systemMessages
        .map(msg => msg.parts.filter(p => p.text).map(p => p.text).join('\n'))
        .join('\n')
      if (systemText) {
        systemParts.push(systemText)
      }
    }

    if (systemParts.length > 0) {
      messages.push({
        role: 'system',
        content: systemParts.join('\n\n')
      })
    }

    conversationHistory
      .filter(msg => msg.role !== 'system')
      .forEach(msg => {
        const contentParts: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = []

        msg.parts.forEach(part => {
          if (part.text) {
            contentParts.push({ type: 'text', text: part.text })
          }
          if (part.inlineData) {
            contentParts.push({
              type: 'image_url',
              image_url: {
                url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`
              }
            })
          }
        })

        if (contentParts.length === 0) {
          return
        }

        const role = msg.role === 'model' ? 'assistant' : msg.role
        const content = contentParts.length === 1 && contentParts[0].type === 'text'
          ? contentParts[0].text
          : contentParts

        messages.push({
          role,
          content
        })
      })

    return messages
  }

  private buildRequestBody(
    model: string,
    messages: OpenAIChatMessage[],
    config: ImageGenerationConfig,
    _supportsImage: boolean
  ): Record<string, any> {
    return {
      model,
      messages,
      temperature: config.temperature,
      top_p: config.topP,
      ...(config.maxOutputTokens !== undefined && { max_tokens: config.maxOutputTokens }),
      ...(config.frequencyPenalty !== undefined && { frequency_penalty: config.frequencyPenalty }),
      ...(config.presencePenalty !== undefined && { presence_penalty: config.presencePenalty })
    }
  }

  private async normalizeResponse(response: OpenAIResponse, config: ImageGenerationConfig): Promise<DrawingServiceResponse> {
    const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = []

    const choice = response.choices?.[0]
    const content = choice?.message?.content

    if (Array.isArray(content)) {
      for (const item of content) {
        if (item?.type === 'text' && item.text) {
          parts.push({ text: item.text })
          continue
        }

        if ((item?.type === 'image_url' || item?.type === 'image') && item.image_url?.url) {
          const inlineData = await this.parseImageUrl(item.image_url.url, config.responseMimeType)
          if (inlineData) {
            parts.push({ inlineData })
          }
          continue
        }

        if (item?.type === 'image' && item.image_base64) {
          parts.push({
            inlineData: {
              mimeType: config.responseMimeType.startsWith('image/') ? config.responseMimeType : 'image/png',
              data: item.image_base64
            }
          })
        }
      }
    } else if (typeof content === 'string') {
      const inlineData = await this.parseImageUrl(content, config.responseMimeType)
      if (inlineData) {
        parts.push({ inlineData })
      } else if (content.trim()) {
        parts.push({ text: content })
      }
    }

    if (response.data && response.data.length > 0) {
      response.data.forEach(item => {
        if (item?.b64_json) {
          parts.push({
            inlineData: {
              mimeType: item.mime_type || config.responseMimeType || 'image/png',
              data: item.b64_json
            }
          })
        }
        if (item?.revised_prompt) {
          parts.push({ text: item.revised_prompt })
        }
      })
    }

    const usageMetadata: UsageMetadata | undefined = response.usage
      ? {
          promptTokenCount: response.usage.prompt_tokens,
          candidatesTokenCount: response.usage.completion_tokens,
          totalTokenCount: response.usage.total_tokens
        }
      : undefined

    const blockReason = choice?.finish_reason === 'content_filter' ? 'content_filter' : undefined

    return {
      candidates: [
        {
          content: {
            parts,
            role: 'model'
          },
          finishReason: choice?.finish_reason,
          index: choice?.index ?? 0,
          safetyRatings: []
        }
      ],
      usageMetadata,
      promptFeedback: blockReason ? { blockReason } : undefined
    }
  }

  private async parseImageUrl(url: string, fallbackMimeType: string): Promise<{ mimeType: string; data: string } | null> {
    if (!url) return null

    if (url.startsWith('data:')) {
      const match = url.match(/^data:(.*?);base64,(.*)$/)
      if (!match) return null
      return { mimeType: match[1], data: match[2] }
    }

    if (url.startsWith('http')) {
      try {
        const response = await fetch(url)
        if (!response.ok) return null
        const mimeType = response.headers.get('content-type') || fallbackMimeType || 'image/png'
        const buffer = await response.arrayBuffer()
        return { mimeType, data: this.arrayBufferToBase64(buffer) }
      } catch (error) {
        console.warn('获取图片数据失败:', error)
        return null
      }
    }

    if (this.looksLikeBase64(url)) {
      return {
        mimeType: fallbackMimeType.startsWith('image/') ? fallbackMimeType : 'image/png',
        data: url
      }
    }

    return null
  }

  private looksLikeBase64(text: string): boolean {
    if (text.length < 64) return false
    return /^[A-Za-z0-9+/=\n\r]+$/.test(text)
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = ''
    const bytes = new Uint8Array(buffer)
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }
}
