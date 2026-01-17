import type { UsageMetadata } from '@/stores/drawingStore'

export interface DrawingServiceResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text?: string
        thoughtSignature?: string
        thought?: boolean
        inlineData?: {
          mimeType: string
          data: string
        }
      }>
      role: string
    }
    finishReason?: string
    index: number
    safetyRatings?: Array<any>
  }>
  usageMetadata?: UsageMetadata
  promptFeedback?: {
    blockReason?: string
  }
}
