import type { DrawingMessage, ImageGenerationConfig, GeneratedImage } from '@/stores/drawingStore'
import type { GeminiResponse } from '@/services/geminiDrawingService'
import type { OpenAIDrawingResponse } from '@/services/openaiDrawingService'

export type DrawingServiceResponse = GeminiResponse | OpenAIDrawingResponse

export interface DrawingService {
  generateContent(
    model: string,
    conversationHistory: DrawingMessage[],
    config: ImageGenerationConfig,
    supportsImage?: boolean,
    abortSignal?: AbortSignal,
    silent?: boolean,
    systemPrompt?: string
  ): Promise<DrawingServiceResponse>
  extractImages(response: DrawingServiceResponse, prompt: string, config: ImageGenerationConfig): GeneratedImage[]
  extractText(response: DrawingServiceResponse): string
  isBlocked(response: DrawingServiceResponse): boolean
  getBlockReason(response: DrawingServiceResponse): string
  generateContentStream(
    model: string,
    conversationHistory: DrawingMessage[],
    config: ImageGenerationConfig,
    supportsImage?: boolean,
    abortSignal?: AbortSignal,
    systemPrompt?: string
  ): AsyncIterable<{ text?: string; thought?: string; done?: boolean }>
}

export const isGeminiResponse = (response: DrawingServiceResponse): response is GeminiResponse => {
  return 'candidates' in response
}
