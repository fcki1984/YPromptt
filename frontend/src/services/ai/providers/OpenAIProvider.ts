import { BaseProvider } from './BaseProvider'
import type { ChatMessage, AIResponse, StreamChunk, MessageContent, APICallParams, ProviderConfig } from '../types'
import type { ModelConfig } from '@/stores/settingsStore'
import { OpenAIAttachmentHandler } from '../multimodal/OpenAIAttachmentHandler'
import { ResponseCleaner } from '../utils/ResponseCleaner'

/**
 * OpenAI API 提供商实现
 * 支持 GPT 系列模型和多模态内容
 */
export class OpenAIProvider extends BaseProvider {
  private maxTokensParamName: 'max_tokens' | 'max_completion_tokens'
  private modelConfig?: ModelConfig

  constructor(config: ProviderConfig, modelId: string) {
    super(config, modelId)
    this.modelConfig = this.config.models?.find(model => model.id === modelId)
    this.maxTokensParamName = this.resolveInitialMaxTokensParam()
  }

  /**
   * 调用 OpenAI API
   * @param messages 聊天消息列表
   * @param stream 是否使用流式响应
   * @param params API 调用参数
   * @returns Promise<AIResponse | ReadableStream<Uint8Array>>
   */
  async callAPI(messages: ChatMessage[], stream: boolean, params?: APICallParams): Promise<AIResponse | ReadableStream<Uint8Array>> {
    // 构建OpenAI API URL - 智能处理基础URL和完整URL
    if (!this.config.baseUrl) {
      throw new Error('API URL 未配置')
    }
    let apiUrl = this.config.baseUrl.trim()
    const useResponsesApi = this.isResponsesApiUrl(apiUrl)
    
    if (useResponsesApi) {
      apiUrl = apiUrl.replace(/\/+$/, '')
    } else if (apiUrl.includes('/chat/completions')) {
      // 已经是完整URL，直接使用
    } else if (apiUrl.includes('/v1')) {
      // 包含v1但没有chat/completions，拼接chat/completions
      apiUrl = apiUrl.replace(/\/+$/, '') + '/chat/completions'
    } else {
      // 基础URL，需要拼接完整路径
      apiUrl = apiUrl.replace(/\/+$/, '') + '/v1/chat/completions'
    }
    
    // 使用传入的模型ID
    const modelId = this.modelId
    
    // 对于思考模型（如gpt-5-high）使用更长的超时时间
    const isThinkingModel = modelId.includes('gpt-5') || modelId.includes('o1') || modelId.includes('thinking')
    const timeoutMs = isThinkingModel ? 600000 : 300000 // 思考模型10分钟，普通模型5分钟
    
    let currentMaxTokensParam = this.maxTokensParamName
    let requestMessages = messages
    while (true) {
      const response = await this.fetchWithTimeout(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify(
          useResponsesApi
            ? this.buildResponsesRequestBody(requestMessages, stream, params, currentMaxTokensParam)
            : this.buildRequestBody(requestMessages, stream, params, currentMaxTokensParam)
        )
      }, timeoutMs)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        if (this.shouldRetryWithCompletionTokens(errorData, currentMaxTokensParam)) {
          currentMaxTokensParam = 'max_completion_tokens'
          this.maxTokensParamName = 'max_completion_tokens'
          continue
        }

        if (useResponsesApi) {
          if (this.shouldRetryWithoutInstructions(errorData, requestMessages)) {
            requestMessages = this.mergeSystemMessages(requestMessages)
            continue
          }
        } else if (this.shouldRetryWithoutSystemRole(errorData, requestMessages)) {
          requestMessages = this.mergeSystemMessages(requestMessages)
          continue
        }

        const error = new Error(`OpenAI API error: ${response.status} ${response.statusText}`)
        ;(error as any).error = errorData
        ;(error as any).status = response.status
        throw error
      }

      this.maxTokensParamName = currentMaxTokensParam

      if (stream) {
        return response.body as ReadableStream<Uint8Array>
      } else {
        const data = await response.json()
        
        // 支持多种API响应格式的内容提取
        let result: string | undefined
        
        if (data.choices && data.choices[0]?.message?.content) {
          // OpenAI 格式: {choices: [{message: {content: "text"}}]}
          result = data.choices[0].message.content
        } else if (typeof data.output_text === 'string') {
          // Responses API 直接返回output_text字段
          result = data.output_text
        } else if (Array.isArray(data.output)) {
          // Responses API 输出结构
          for (const output of data.output) {
            const contents = output?.content
            if (!Array.isArray(contents)) continue
            for (const content of contents) {
              if (typeof content?.text === 'string' && content.text.trim()) {
                result = content.text
                break
              }
              if (typeof content?.output_text === 'string' && content.output_text.trim()) {
                result = content.output_text
                break
              }
            }
            if (result) break
          }
        } else if (data.candidates && data.candidates[0]?.content?.parts) {
          // Gemini 格式: {candidates: [{content: {parts: [{text: "text"}]}}]}
          const parts = data.candidates[0].content.parts
          // 查找包含text的部分（过滤掉thought等）
          for (const part of parts) {
            if (part.text && !part.thought) {
              result = part.text
              break
            }
          }
        } else if (data.content && typeof data.content === 'string') {
          // 直接返回内容格式
          result = data.content
        } else if (data.text && typeof data.text === 'string') {
          // 简单文本格式
          result = data.text
        }
        
        if (!result || result.trim() === '') {
          throw new Error('API返回空内容或无法解析响应格式')
        }
        
        // 清理响应内容
        result = ResponseCleaner.cleanResponse(result)
        result = ResponseCleaner.cleanThinkTags(result)
        
        return {
          content: result,
          finishReason: data.choices?.[0]?.finish_reason
        }

      }
    }
  }

  private buildRequestBody(
    messages: ChatMessage[],
    stream: boolean,
    params: APICallParams | undefined,
    maxTokensParam: 'max_tokens' | 'max_completion_tokens'
  ) {
    const requestBody: Record<string, any> = {
      model: this.modelId,
      messages: messages.map(msg => {
        if (this.hasMultimodalContent(msg)) {
          const multimodalContent = this.convertToMultimodalContent(msg)
          return {
            role: msg.role,
            content: multimodalContent
          }
        } else {
          return {
            role: msg.role,
            content: typeof msg.content === 'string' ? msg.content : msg.content[0]?.text || ''
          }
        }
      }),
      temperature: params?.temperature ?? 1.0,
      top_p: params?.topP ?? 0.95,
      ...(params?.frequencyPenalty !== undefined && { frequency_penalty: params.frequencyPenalty }),
      ...(params?.presencePenalty !== undefined && { presence_penalty: params.presencePenalty }),
      ...(stream && { stream: true })
    }

    const maxTokensValue = params?.maxTokens ?? 8192
    if (maxTokensValue !== undefined) {
      requestBody[maxTokensParam] = maxTokensValue
    }

    return requestBody
  }

  private buildResponsesRequestBody(
    messages: ChatMessage[],
    stream: boolean,
    params: APICallParams | undefined,
    _maxTokensParam: 'max_tokens' | 'max_completion_tokens'
  ) {
    const { instructions, input } = this.buildResponsesInput(messages)

    const requestBody: Record<string, any> = {
      model: this.modelId,
      input,
      temperature: params?.temperature ?? 1.0,
      top_p: params?.topP ?? 0.95,
      ...(params?.frequencyPenalty !== undefined && { frequency_penalty: params.frequencyPenalty }),
      ...(params?.presencePenalty !== undefined && { presence_penalty: params.presencePenalty }),
      ...(stream && { stream: true })
    }

    if (instructions) {
      requestBody.instructions = instructions
    }

    const maxTokensValue = params?.maxTokens ?? 8192
    if (maxTokensValue !== undefined) {
      requestBody.max_output_tokens = maxTokensValue
    }

    return requestBody
  }

  private buildResponsesInput(messages: ChatMessage[]): { instructions: string; input: any } {
    const systemMessages = messages.filter(msg => msg.role === 'system')
    const instructions = systemMessages
      .map(msg => this.stringifyMessageContent(msg))
      .filter(Boolean)
      .join('\n\n')

    const inputMessages = messages
      .filter(msg => msg.role !== 'system')
      .map(msg => {
        if (this.hasMultimodalContent(msg)) {
          return {
            role: msg.role,
            content: this.convertToResponsesContent(msg)
          }
        }

        return {
          role: msg.role,
          content: this.stringifyMessageContent(msg)
        }
      })

    return {
      instructions,
      input: inputMessages
    }
  }

  private convertToResponsesContent(message: ChatMessage): MessageContent[] {
    const content: MessageContent[] = []

    if (typeof message.content === 'string' && message.content.trim()) {
      content.push({ type: 'input_text', text: message.content })
    } else if (Array.isArray(message.content)) {
      for (const part of message.content) {
        if (part.type === 'text' && part.text) {
          content.push({ type: 'input_text', text: part.text })
        }
      }
    }

    if (message.attachments && message.attachments.length > 0) {
      const openaiAttachments = OpenAIAttachmentHandler.convertAttachments(message.attachments)
      for (const attachment of openaiAttachments) {
        if (attachment.type !== 'image_url' || !attachment.image_url) {
          continue
        }
        const imageUrl = typeof attachment.image_url === 'string'
          ? attachment.image_url
          : attachment.image_url.url
        if (imageUrl) {
          content.push({ type: 'input_image', image_url: imageUrl })
        }
      }
    }

    return content
  }

  private resolveInitialMaxTokensParam(): 'max_tokens' | 'max_completion_tokens' {
    const configuredParam = this.modelConfig?.capabilities?.supportedParams.maxTokens
    if (configuredParam) {
      return configuredParam
    }
    
    return this.requiresCompletionTokens(this.modelId) ? 'max_completion_tokens' : 'max_tokens'
  }

  private shouldRetryWithCompletionTokens(
    errorData: any,
    currentParam: 'max_tokens' | 'max_completion_tokens'
  ): boolean {
    if (currentParam === 'max_completion_tokens') {
      return false
    }

    const errorInfo = errorData?.error
    if (!errorInfo) {
      return false
    }

    const message = typeof errorInfo.message === 'string' ? errorInfo.message.toLowerCase() : ''
    if (!message) {
      return false
    }

    const isUnsupportedParam = errorInfo.code === 'unsupported_parameter' || message.includes('unsupported parameter')
    const referencesTokens = message.includes('max_tokens') && message.includes('max_completion_tokens')
    const isMaxTokensParam = !errorInfo.param || errorInfo.param === 'max_tokens'

    return isUnsupportedParam && referencesTokens && isMaxTokensParam
  }

  private shouldRetryWithoutSystemRole(errorData: any, messages: ChatMessage[]): boolean {
    if (!messages.some(msg => msg.role === 'system')) {
      return false
    }

    const message = typeof errorData?.error?.message === 'string'
      ? errorData.error.message.toLowerCase()
      : ''

    if (!message) {
      return false
    }

    return message.includes('system') &&
      (message.includes('unsupported') || message.includes('not supported') || message.includes('not allowed') || message.includes('invalid') || message.includes('role'))
  }

  private shouldRetryWithoutInstructions(errorData: any, messages: ChatMessage[]): boolean {
    if (!messages.some(msg => msg.role === 'system')) {
      return false
    }

    const message = typeof errorData?.error?.message === 'string'
      ? errorData.error.message.toLowerCase()
      : ''

    if (!message) {
      return false
    }

    return message.includes('instruction') ||
      (message.includes('system') &&
        (message.includes('unsupported') || message.includes('not supported') || message.includes('not allowed') || message.includes('invalid')))
  }

  private mergeSystemMessages(messages: ChatMessage[]): ChatMessage[] {
    const systemMessages = messages.filter(msg => msg.role === 'system')
    if (systemMessages.length === 0) {
      return messages
    }

    const systemText = systemMessages
      .map(msg => this.stringifyMessageContent(msg))
      .filter(Boolean)
      .join('\n\n')

    const nonSystemMessages = messages.filter(msg => msg.role !== 'system')

    if (!systemText) {
      return nonSystemMessages
    }

    if (nonSystemMessages.length === 0) {
      return [{ role: 'user', content: `System:\n${systemText}` }]
    }

    const [first, ...rest] = nonSystemMessages
    if (first.role !== 'user') {
      return [{ role: 'user', content: `System:\n${systemText}` }, ...nonSystemMessages]
    }

    const firstContent = this.stringifyMessageContent(first)
    const merged = `System:\n${systemText}\n\n${firstContent}`.trim()
    return [{ ...first, content: merged }, ...rest]
  }

  private stringifyMessageContent(message: ChatMessage): string {
    if (typeof message.content === 'string') {
      return message.content
    }

    if (Array.isArray(message.content)) {
      const textParts = message.content
        .filter(part => part.type === 'text' && part.text)
        .map(part => part.text)
      return textParts.join('\n')
    }

    return ''
  }

  private requiresCompletionTokens(modelId: string): boolean {
    const normalized = modelId.toLowerCase()
    const keywords = ['gpt-5', 'o1', 'o3', 'o4', 'reasoning']
    return keywords.some(keyword => normalized.includes(keyword))
  }

  /**
   * 解析 OpenAI 流式响应块
   * @param data SSE 数据字符串
   * @returns 解析后的流式块或 null
   */
  parseStreamChunk(data: string): StreamChunk | null {
    if (!data.trim() || data.trim() === '[DONE]') {
      return { content: '', done: true }
    }
    
    // 专门过滤OPENROUTER的处理状态信息
    if (data === ': OPENROUTER PROCESSING') {
      return null
    }
    
    // 过滤其他明显的状态信息（更保守的方法）
    if (data.startsWith(': ') && data.toUpperCase().includes('PROCESSING')) {
      return null
    }
    
    try {
      const parsed = JSON.parse(data)
      let content: string | undefined
      
      // 支持多种流式响应格式
      if (parsed.type && typeof parsed.type === 'string') {
        if (parsed.type.includes('response.output_text.delta') && typeof parsed.delta === 'string') {
          content = parsed.delta
        } else if (parsed.type.includes('response.output_text.done') && typeof parsed.text === 'string') {
          content = parsed.text
        }
      }

      if (!content && parsed.choices?.[0]?.delta?.content) {
        // OpenAI 流式格式
        content = parsed.choices[0].delta.content
      } else if (parsed.candidates?.[0]?.content?.parts) {
        // Gemini SSE 流式格式
        const parts = parsed.candidates[0].content.parts
        for (const part of parts) {
          if (part.text && !part.thought) {
            content = part.text
            break
          }
        }
      } else if (parsed.delta?.text) {
        // 简化流式格式
        content = parsed.delta.text
      } else if (parsed.text) {
        // 直接文本格式
        content = parsed.text
      }
      
      const finishReason = parsed.choices?.[0]?.finish_reason
      const done = !!(finishReason || parsed.done || (parsed.type && parsed.type.includes('response.completed')))
      
      return {
        content: content || '',
        done
      }
    } catch (e) {
      // JSON解析错误，返回null
      return null
    }
  }

  private isResponsesApiUrl(baseUrl: string): boolean {
    return baseUrl.includes('/responses')
  }

  /**
   * 检查消息是否包含多模态内容
   * @param message 聊天消息
   * @returns 是否包含附件
   */
  private hasMultimodalContent(message: ChatMessage): boolean {
    return !!(message.attachments && message.attachments.length > 0)
  }

  /**
   * 将消息转换为多模态内容格式
   * @param message 聊天消息
   * @returns 多模态内容数组
   */
  private convertToMultimodalContent(message: ChatMessage): MessageContent[] {
    const content: MessageContent[] = []
    
    // 添加文本内容
    if (typeof message.content === 'string' && message.content.trim()) {
      content.push({ type: 'text', text: message.content })
    }
    
    // 添加附件内容
    if (message.attachments && message.attachments.length > 0) {
      const openaiAttachments = OpenAIAttachmentHandler.convertAttachments(message.attachments)
      content.push(...openaiAttachments)
    }
    
    return content
  }
}
