import type { DrawingModel, DrawingProvider } from '@/stores/drawingStore'
import { GeminiDrawingService } from '@/services/geminiDrawingService'
import { OpenAIDrawingService } from '@/services/openaiDrawingService'
import type { DrawingService } from '@/services/drawingTypes'

export const getDrawingService = (
  provider: DrawingProvider,
  model?: DrawingModel | null
): DrawingService => {
  const apiType = model?.apiType || provider.type || 'google'
  if (apiType === 'openai') {
    return new OpenAIDrawingService(provider.apiKey, provider.baseURL) as DrawingService
  }
  return new GeminiDrawingService(provider.apiKey, provider.baseURL) as DrawingService
}
