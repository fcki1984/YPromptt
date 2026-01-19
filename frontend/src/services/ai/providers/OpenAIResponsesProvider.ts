import { BaseProvider } from './BaseProvider'
import type { ChatMessage, AIResponse, StreamChunk, MessageContent, APICallParams, ProviderConfig } from '../types'
import { OpenAIAttachmentHandler } from '../multimodal/OpenAIAttachmentHandler'
import { ResponseCleaner } from '../utils/ResponseCleaner'

/**
 * OpenAI Responses API 提供商实现
 */
export class OpenAIResponsesProvider extends BaseProvider {
  constructor(config: ProviderConfig, modelId: string) {
    super(config, modelId)
  }

  async callAPI(messages: ChatMessage[], stream: boolean, params?: APICallParams): Promise<AIResponse | ReadableStream<Uint8Array>> {
    if (!this.config.baseUrl) {
      throw new Error('API URL 未配置')
    }
    let apiUrl = this.config.baseUrl.trim()

    if (apiUrl.includes('/responses')) {
      // 已经是完整URL，直接使用
    } else if (apiUrl.includes('/v1')) {
      apiUrl = apiUrl.replace(/\/+$/, '') + '/responses'
    } else {
      apiUrl = apiUrl.replace(/\/+$/, '') + '/v1/responses'
    }

    const modelId = this.modelId
    const isThinkingModel = modelId.includes('gpt-5') || modelId.includes('o1') || modelId.includes('thinking')
    const timeoutMs = isThinkingModel ? 600000 : 300000

    const response = await this.fetchWithTimeout(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify(this.buildRequestBody(messages, stream, params))
    }, timeoutMs)

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const error = new Error(`OpenAI API error: ${response.status} ${response.statusText}`)
      ;(error as any).error = errorData
      ;(error as any).status = response.status
      throw error
    }

    if (stream) {
      return response.body as ReadableStream<Uint8Array>
    }

    const data = await response.json()
    const result = this.extractResponseText(data)
    if (!result || result.trim() === '') {
      throw new Error('API返回空内容或无法解析响应格式')
    }

    const cleaned = ResponseCleaner.cleanThinkTags(ResponseCleaner.cleanResponse(result))

    return {
      content: cleaned,
      finishReason: data?.finish_reason
    }
  }

  parseStreamChunk(data: string): StreamChunk | null {
    if (!data.trim()) {
      return null
    }

    try {
      const parsed = JSON.parse(data)
      if (parsed.type === 'response.output_text.delta' && typeof parsed.delta === 'string') {
        return { content: parsed.delta, done: false }
      }

      if (parsed.type === 'response.output_text.done' || parsed.type === 'response.completed') {
        return { content: '', done: true }
      }

      if (parsed.delta?.text) {
        return { content: parsed.delta.text, done: false }
      }

      return null
    } catch {
      return null
    }
  }

  private buildRequestBody(messages: ChatMessage[], stream: boolean, params?: APICallParams) {
    const input = messages.map(message => ({
      role: message.role,
      content: this.formatMessageContent(message)
    }))

    const requestBody: Record<string, any> = {
      model: this.modelId,
      input,
      ...(stream && { stream: true })
    }

    if (params?.temperature !== undefined) {
      requestBody.temperature = params.temperature
    }
    if (params?.topP !== undefined) {
      requestBody.top_p = params.topP
    }
    if (params?.maxTokens !== undefined) {
      requestBody.max_output_tokens = params.maxTokens
    }
    if (params?.reasoningEffort) {
      requestBody.reasoning = { effort: params.reasoningEffort }
    }

    return requestBody
  }

  private formatMessageContent(message: ChatMessage): string | MessageContent[] {
    if (this.hasMultimodalContent(message)) {
      return this.convertToResponsesContent(message)
    }

    if (typeof message.content === 'string') {
      return message.content
    }

    return message.content.map(part => {
      if (part.type === 'text') {
        return { type: 'input_text', text: part.text || '' } as any
      }
      if (part.type === 'image_url' && part.image_url?.url) {
        return { type: 'input_image', image_url: part.image_url } as any
      }
      return part as any
    })
  }

  private hasMultimodalContent(message: ChatMessage): boolean {
    return !!(message.attachments && message.attachments.length > 0)
  }

  private convertToResponsesContent(message: ChatMessage): MessageContent[] {
    const content: MessageContent[] = []

    if (typeof message.content === 'string' && message.content.trim()) {
      content.push({ type: 'text', text: message.content })
    }

    if (message.attachments && message.attachments.length > 0) {
      const openaiAttachments = OpenAIAttachmentHandler.convertAttachments(message.attachments)
      content.push(...openaiAttachments)
    }

    return content.map(part => {
      if (part.type === 'text') {
        return { type: 'input_text', text: part.text || '' } as any
      }
      if (part.type === 'image_url' && part.image_url?.url) {
        return { type: 'input_image', image_url: part.image_url } as any
      }
      return part as any
    })
  }

  private extractResponseText(data: any): string {
    if (typeof data?.output_text === 'string') {
      return data.output_text
    }

    const output = data?.output
    if (Array.isArray(output)) {
      const texts: string[] = []
      for (const item of output) {
        const content = item?.content
        if (!Array.isArray(content)) continue
        for (const part of content) {
          if (part?.type === 'output_text' && typeof part.text === 'string') {
            texts.push(part.text)
          }
        }
      }
      if (texts.length > 0) {
        return texts.join('')
      }
    }

    if (data?.choices?.[0]?.message?.content) {
      return data.choices[0].message.content
    }

    if (data?.content && typeof data.content === 'string') {
      return data.content
    }

    return ''
  }
}
