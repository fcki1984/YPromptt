import type { DrawingModel, DrawingProvider, GeneratedImage, ImageGenerationConfig, DrawingMessage } from '@/stores/drawingStore'
import { GeminiDrawingService } from '@/services/geminiDrawingService'
import { OpenAIDrawingService } from '@/services/openaiDrawingService'
import type { DrawingServiceResponse } from '@/services/drawingServiceTypes'

export interface DrawingService {
  generateContent: (
    model: string,
    conversationHistory: DrawingMessage[],
    config: ImageGenerationConfig,
    supportsImage?: boolean,
    abortSignal?: AbortSignal,
    silent?: boolean,
    systemPrompt?: string
  ) => Promise<DrawingServiceResponse>
  generateContentStream: (
    model: string,
    conversationHistory: DrawingMessage[],
    config: ImageGenerationConfig,
    supportsImage?: boolean,
    abortSignal?: AbortSignal,
    systemPrompt?: string
  ) => AsyncIterable<{ text?: string; thought?: string; done?: boolean }>
  extractImages: (response: DrawingServiceResponse, prompt: string, config: ImageGenerationConfig) => GeneratedImage[]
  extractText: (response: DrawingServiceResponse) => string
  isBlocked: (response: DrawingServiceResponse) => boolean
  getBlockReason: (response: DrawingServiceResponse) => string
}

export const createDrawingService = (provider: DrawingProvider, model?: DrawingModel): DrawingService => {
  if (model?.apiType === 'openai') {
    return new OpenAIDrawingService(provider.apiKey, provider.baseURL)
  }

  return new GeminiDrawingService(provider.apiKey, provider.baseURL)
}
