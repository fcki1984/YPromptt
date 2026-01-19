<template>
  <div class="h-full flex flex-col overflow-hidden p-2">
    <!-- 模块特定顶栏 -->
    <div class="bg-white rounded-lg shadow-sm p-4 mb-4 flex-shrink-0">
      <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div class="min-w-0">
          <h1 class="text-xl lg:text-2xl font-bold text-gray-800 mb-1">AI 绘图</h1>

        </div>

        <!-- 模型选择器 -->
        <div class="flex items-center gap-2 flex-shrink-0 flex-wrap sm:flex-nowrap">
          <label class="text-sm font-medium text-gray-700 whitespace-nowrap">AI模型:</label>
          <select
            v-model="drawingStore.selectedProvider"
            @change="onProviderChange"
            class="px-3 py-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 min-w-0 flex-1 sm:flex-none"
          >
            <option value="">选择提供商</option>
            <option
              v-for="provider in availableProviders"
              :key="provider.id"
              :value="provider.id"
            >
              {{ provider.name }}
            </option>
          </select>

          <select
            v-model="drawingStore.selectedModel"
            @change="drawingStore.saveSettings"
            :disabled="!drawingStore.selectedProvider"
            class="px-3 py-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 disabled:opacity-50 min-w-0 flex-1 sm:flex-none"
          >
            <option value="">选择模型</option>
            <option
              v-for="model in availableModels"
              :key="model.id"
              :value="model.id"
            >
              {{ model.name }}
            </option>
          </select>
        </div>
      </div>

      <!-- API Key 未配置提示 -->
      <div v-if="availableProviders.length === 0" class="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
        <div class="flex items-start space-x-2">
          <AlertCircle class="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div class="flex-1">
            <p class="text-sm text-yellow-800 font-medium">请先配置 AI 提供商</p>
            <p class="text-xs text-yellow-700 mt-1">
              点击右上角的"设置"按钮，配置您的 AI 提供商和 API Key 后即可开始使用
            </p>
          </div>
          <button
            @click="showSettings = true"
            class="px-3 py-1 bg-yellow-600 text-white text-sm rounded-md hover:bg-yellow-700 transition-colors"
          >
            立即配置
          </button>
        </div>
      </div>

      <!-- 模式选择 -->
      <div class="flex space-x-2 mt-4">
        <button
          v-for="mode in drawingModes"
          :key="mode.key"
          @click="handleModeChange(mode.key)"
          :class="[
            'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            activeMode === mode.key
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          ]"
        >
          {{ mode.label }}
        </button>
      </div>
    </div>

    <!-- 主要内容区域 -->
    <div class="flex-1 overflow-hidden">
      <!-- 生图改图模式 -->
      <div v-if="activeMode === 'generate'" class="h-full flex flex-col">
        <!-- 图片预览区 - 顶部横向滚动 -->
        <div v-if="currentAttachments.length > 0" class="bg-white rounded-lg shadow-sm p-3 mb-4 flex-shrink-0">
          <div class="flex gap-3 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 pb-2">
            <div
              v-for="attachment in currentAttachments"
              :key="attachment.id"
              class="flex-shrink-0 cursor-pointer group"
              @click="openPreview(attachment)"
            >
              <img
                :src="attachment.preview"
                :alt="attachment.name"
                :title="attachment.name + ' - 点击放大'"
                class="h-32 w-auto object-contain rounded-lg border-2 border-gray-200 hover:border-blue-400 transition-all shadow-sm hover:shadow-lg"
              />
            </div>
          </div>
        </div>

        <div class="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-2 gap-4">
          <!-- 左侧：对话区域 -->
          <div class="flex flex-col min-h-0">
            <DrawingChat
              @send="handleSendMessage"
              @clear="handleClearChat"
              @attachments-change="handleAttachmentsChange"
              @regenerate="handleRegenerate"
              :streaming-text="currentStreamingText"
              :loading-message="loadingMessage"
              :elapsed-time="elapsedSeconds"
            />
          </div>

          <!-- 右侧：结果展示区域 -->
          <div class="flex flex-col min-h-0">
            <DrawingResult />
          </div>
        </div>
      </div>

      <!-- 提示词优化模式 -->
      <div v-else-if="activeMode === 'optimize'" class="h-full overflow-y-auto">
        <DrawingPromptOptimizer />
      </div>
    </div>

    <!-- 图片预览模态框 -->
    <div
      v-if="previewImage"
      class="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
      @click="closePreview"
    >
      <div class="max-w-7xl max-h-full" @click.stop>
        <img
          :src="previewImage.preview"
          :alt="previewImage.name"
          class="max-w-full max-h-[90vh] object-contain"
        />
      </div>
      <button
        @click="closePreview"
        class="absolute top-4 right-4 p-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full text-white"
      >
        <X class="w-6 h-6" />
      </button>
    </div>

    <!-- 悬浮设置按钮 -->
    <button
      @click="showSettings = true"
      class="fixed top-4 right-4 z-40 p-2 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow"
      title="设置"
    >
      <Settings class="w-5 h-5 text-gray-600" />
    </button>

    <!-- 设置模态框 -->
    <DrawingSettings v-if="showSettings" @close="showSettings = false" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Settings, AlertCircle, X } from 'lucide-vue-next'
import { useDrawingStore } from '@/stores/drawingStore'
import { GeminiDrawingService } from '@/services/geminiDrawingService'
import { mapResolutionToStandard } from '@/utils/resolutionMapper'
import DrawingChat from '@/components/drawing/DrawingChat.vue'
import DrawingResult from '@/components/drawing/DrawingResult.vue'
import DrawingSettings from '@/components/drawing/DrawingSettings.vue'
import DrawingPromptOptimizer from '@/components/drawing/DrawingPromptOptimizer.vue'

const drawingStore = useDrawingStore()

// localStorage key
const ACTIVE_MODE_KEY = 'yprompt_drawing_active_mode'

// 模式状态
const activeMode = ref<'generate' | 'optimize'>('generate')

// 从 localStorage 恢复模式
try {
  const savedMode = localStorage.getItem(ACTIVE_MODE_KEY)
  if (savedMode && ['generate', 'optimize'].includes(savedMode)) {
    activeMode.value = savedMode as 'generate' | 'optimize'
  }
} catch (e) {
  console.error('读取 activeMode 失败:', e)
}

// 模式配置
const drawingModes: Array<{ key: 'generate' | 'optimize'; label: string }> = [
  { key: 'generate', label: '生图改图' },
  { key: 'optimize', label: '提示词优化' }
]

// 状态
const showSettings = ref(false)
const currentStreamingText = ref('')
const elapsedSeconds = ref(0)
const currentAttachments = ref<Array<{ id: string; preview: string; name: string }>>([])
const previewImage = ref<{ id: string; preview: string; name: string } | null>(null)
let timerInterval: number | undefined
let abortController: AbortController | null = null  // 用于中断请求

// 处理附件变化
const handleAttachmentsChange = (attachments: Array<{ id: string; preview: string; name: string }>) => {
  currentAttachments.value = attachments
}

// 打开图片预览
const openPreview = (attachment: { id: string; preview: string; name: string }) => {
  previewImage.value = attachment
}

// 关闭图片预览
const closePreview = () => {
  previewImage.value = null
}

// 处理模式切换
const handleModeChange = (mode: 'generate' | 'optimize') => {
  activeMode.value = mode
  // 保存到 localStorage
  try {
    localStorage.setItem(ACTIVE_MODE_KEY, mode)
  } catch (e) {
    console.error('保存 activeMode 失败:', e)
  }
}

// 可用的提供商
const availableProviders = computed(() => {
  return drawingStore.getAvailableProviders()
})

// 当前提供商的可用模型
const availableModels = computed(() => {
  if (!drawingStore.selectedProvider) return []
  return drawingStore.getAvailableModels(drawingStore.selectedProvider)
})

// 加载提示消息（根据模型类型）
const loadingMessage = computed(() => {
  const model = drawingStore.getCurrentModel()
  if (!model) return '正在处理'
  return model.supportsImage ? '正在生成图片' : '正在生成内容'
})

// 提供商改变时重置模型选择
const onProviderChange = () => {
  drawingStore.selectedModel = ''
  const models = availableModels.value
  if (models.length > 0) {
    drawingStore.selectedModel = models[0].id
  }
  drawingStore.saveSettings()
}

// 启动计时器
const startTimer = () => {
  elapsedSeconds.value = 0
  if (timerInterval) {
    clearInterval(timerInterval)
  }
  timerInterval = window.setInterval(() => {
    elapsedSeconds.value++
  }, 1000)
}

// 停止计时器
const stopTimer = () => {
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = undefined
  }
  elapsedSeconds.value = 0
}

// 处理发送消息
const handleSendMessage = async (
  text: string,
  images: Array<{ mimeType: string; data: string }>
) => {
  // 检查提供商配置
  const provider = drawingStore.getCurrentProvider()
  const model = drawingStore.getCurrentModel()

  if (!provider || !provider.apiKey) {
    alert('请先在设置中配置 AI 提供商和 API Key')
    showSettings.value = true
    return
  }

  if (!model) {
    alert('请先选择一个模型')
    showSettings.value = true
    return
  }

  try {
    // 创建 AbortController 用于中断请求
    abortController = new AbortController()

    // 标记为生成中
    drawingStore.isGenerating = true
    currentStreamingText.value = ''
    startTimer()
    const systemPrompt = drawingStore.systemPrompt?.trim() || ''

    // 构建消息部分
    const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = []

    // 添加文本（如果有）
    if (text) {
      parts.push({ text })
    }

    // 添加图片（如果有）
    images.forEach(image => {
      parts.push({
        inlineData: {
          mimeType: image.mimeType,
          data: image.data
        }
      })
    })

    // 添加用户消息到对话历史
    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user' as const,
      parts,
      timestamp: Date.now()
    }
    drawingStore.addMessage(userMessage)

    // 创建 Gemini 服务实例
    const service = new GeminiDrawingService(provider.apiKey, provider.baseURL)

    // 判断是否使用流式输出
    // 简化处理: 图像模型始终使用非流式,只有纯文本模型使用流式
    const useStreaming = !model.supportsImage
    if (!useStreaming) {
      drawingStore.streamingThought = ''
    }

    if (useStreaming) {
      // 流式输出处理（仅用于纯文本模型）
      let accumulatedText = ''
      let streamingThoughtBuffer = ''
      drawingStore.streamingThought = ''
      const thoughtStart = Date.now()

      try {
        for await (const chunk of service.generateContentStream(
          model.id,
          drawingStore.conversationHistory,
          drawingStore.generationConfig,
          model.supportsImage,
          abortController.signal,  // 传递 signal 用于中断
          systemPrompt || undefined
        )) {
          if (chunk.thought) {
            streamingThoughtBuffer += chunk.thought
            drawingStore.streamingThought = streamingThoughtBuffer
          }

          if (chunk.text) {
            accumulatedText += chunk.text
            currentStreamingText.value = accumulatedText
          }

          if (chunk.done) {
            // 流式完成,添加完整消息到历史
            if (accumulatedText) {
              const thoughtSummary = streamingThoughtBuffer.trim()
              const duration = Date.now() - thoughtStart
              const modelMessage = {
                id: `model-${Date.now()}`,
                role: 'model' as const,
                parts: [{ text: accumulatedText }],
                timestamp: Date.now(),
                thoughtSummary: thoughtSummary ? thoughtSummary : undefined,
                thoughtDurationMs: duration
              }
              drawingStore.addMessage(modelMessage)
            }
          }
        }
      } catch (streamError: any) {
        console.error('流式生成失败:', streamError)
        alert(`生成失败: ${streamError.message || '未知错误'}`)
      } finally {
        currentStreamingText.value = ''
        drawingStore.streamingThought = ''
      }
    } else {
      // 非流式输出（图像生成模型）
      const batchCount = model.supportsImage ? drawingStore.batchGenerationCount : 1

      // 声明 response 变量（在条件块外部，以便后续访问）
      let response: any
      // 声明自定义分辨率变量（在条件块外部，以便后续访问）
      let originalImageSize: '1K' | '2K' | '4K' | undefined
      let mappedResolution: '1K' | '2K' | '4K' | undefined

      // 检查是否需要批量生成
      if (batchCount > 1) {
        // === 批量并发生成 ===
        // 创建AI消息占位符，包含候选列表
        const modelMessageId = `model-${Date.now()}`
        const imageCandidates: any[] = Array.from({ length: batchCount }, (_, idx) => ({
          id: `${modelMessageId}-candidate-${idx}`,
          isGenerating: true,
          prompt: text || '图片生成'  // 保存用户输入的提示词
        }))

        const modelMessage: any = {
          id: modelMessageId,
          role: 'model' as const,
          parts: [],
          timestamp: Date.now(),
          imageCandidates,
          selectedCandidateIndex: -1,
          isAwaitingSelection: true
        }
        drawingStore.addMessage(modelMessage)

        // 更新进度
        drawingStore.batchGenerationProgress = { current: 0, total: batchCount }

        // 并发生成
        const generatePromises = imageCandidates.map(async (candidate, idx) => {
          try {
            const batchResponse = await service.generateContent(
              model.id,
              drawingStore.conversationHistory.slice(0, -1), // 不包含刚添加的AI占位消息
              drawingStore.generationConfig,
              model.supportsImage,
              abortController?.signal,
              true,  // silent mode
              systemPrompt || undefined
            )

            // 检查是否被阻止
            if (service.isBlocked(batchResponse)) {
              candidate.error = service.getBlockReason(batchResponse)
              candidate.isGenerating = false
              return
            }

            // 提取结果
            if (batchResponse.candidates && batchResponse.candidates.length > 0) {
              const apiCandidate = batchResponse.candidates[0]

              // 提取文本
              const text = service.extractText(batchResponse)
              if (text) {
                candidate.text = text
              }

              // 提取图片和 thoughtSignature
              if (apiCandidate.content && apiCandidate.content.parts) {
                const thoughtSegments: string[] = []
                const thoughtTrace: Array<{ type: 'text' | 'image'; text?: string; mimeType?: string; data?: string }> = []

                for (const part of apiCandidate.content.parts) {
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
                    continue
                  }

                  if (part.inlineData) {
                    candidate.imageData = part.inlineData.data
                    candidate.mimeType = part.inlineData.mimeType
                  }
                  if (part.thoughtSignature) {
                    candidate.thoughtSignature = part.thoughtSignature
                  }
                }

                if (thoughtSegments.length > 0) {
                  candidate.thoughtSummary = thoughtSegments.join('\n\n')
                }
                if (thoughtTrace.length > 0) {
                  candidate.thoughtTrace = thoughtTrace
                }
              }

              if (batchResponse.usageMetadata?.thoughtsTokenCount !== undefined) {
                candidate.thoughtTokens = batchResponse.usageMetadata.thoughtsTokenCount
              }
              if (batchResponse.usageMetadata) {
                candidate.usageMetadata = JSON.parse(JSON.stringify(batchResponse.usageMetadata))
              }
            }

            candidate.isGenerating = false
            drawingStore.batchGenerationProgress.current++
          } catch (error: any) {
            console.error(`候选 ${idx + 1} 生成失败:`, error)
            candidate.error = error.message || '生成失败'
            candidate.isGenerating = false
            drawingStore.batchGenerationProgress.current++
          }
        })

        // 等待所有生成完成
        await Promise.all(generatePromises)

        // 重置进度
        drawingStore.batchGenerationProgress = { current: 0, total: 0 }

        // 检查是否所有候选都失败了
        const allFailed = imageCandidates.every(c => c.error)
        if (allFailed) {
          alert('所有图片生成均失败，请检查配置或提示词')
        }
      } else {
        // === 单次生成（原有逻辑） ===
        // 处理自定义分辨率
        if (drawingStore.enableCustomResolution) {
          mappedResolution = mapResolutionToStandard(
            drawingStore.customResolution.width,
            drawingStore.customResolution.height
          )
          originalImageSize = drawingStore.generationConfig.imageSize
          drawingStore.generationConfig.imageSize = mappedResolution
        }

        response = await service.generateContent(
          model.id,
          drawingStore.conversationHistory,
          drawingStore.generationConfig,
          model.supportsImage,
          abortController.signal,  // 传递 signal 用于中断
          false,
          systemPrompt || undefined
        )

        // 恢复原始分辨率设置
        if (drawingStore.enableCustomResolution && originalImageSize) {
          drawingStore.generationConfig.imageSize = originalImageSize
        }

        // 检查是否被阻止
        if (service.isBlocked(response)) {
          const blockReason = service.getBlockReason(response)
          alert(blockReason)
          drawingStore.isGenerating = false
          stopTimer()
          return
        }
      }

      // 单次生成的后续处理
      if (batchCount === 1) {
        // 提取完整的模型响应（包括 thoughtSignature）
        if (response.candidates && response.candidates.length > 0) {
          const candidate = response.candidates[0]

          // 提取图片添加到图片库
          const generatedImages = service.extractImages(
            response,
            text || '图片编辑',
            drawingStore.generationConfig
          )
          generatedImages.forEach(image => {
            // 添加自定义分辨率元数据
            if (drawingStore.enableCustomResolution && mappedResolution) {
              image.customResolution = {
                width: drawingStore.customResolution.width,
                height: drawingStore.customResolution.height,
                mappedStandard: mappedResolution
              }
            }
            drawingStore.addGeneratedImage(image)
          })

          // 使用 API 返回的完整 parts（包含 thoughtSignature）
          if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
            // 处理parts: 将thoughtSignature合并到对应的图片part中
            const processedParts: any[] = []
            let pendingThoughtSignature: string | null = null
            const thoughtSegments: string[] = []
            const thoughtTrace: Array<{ type: 'text' | 'image'; text?: string; mimeType?: string; data?: string }> = []

            for (const part of candidate.content.parts) {
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
                continue
              }

              // 如果是thoughtSignature,暂存它
              if (part.thoughtSignature && !part.text && !part.inlineData) {
                pendingThoughtSignature = part.thoughtSignature
              }
              // 如果是图片,并且有暂存的thoughtSignature,合并
              else if (part.inlineData) {
                const imagePart: any = {
                  inlineData: {
                    mimeType: part.inlineData.mimeType,
                    data: part.inlineData.data
                  }
                }
                // 合并thoughtSignature到图片part中
                if (pendingThoughtSignature) {
                  imagePart.thoughtSignature = pendingThoughtSignature
                  pendingThoughtSignature = null
                }
                // 或者part本身就包含thoughtSignature
                else if (part.thoughtSignature) {
                  imagePart.thoughtSignature = part.thoughtSignature
                }
                processedParts.push(imagePart)
              }
              // 如果是文本
              else if (part.text) {
                const textPart: any = { text: part.text }
                // 文本part也可能有thoughtSignature
                if (part.thoughtSignature) {
                  textPart.thoughtSignature = part.thoughtSignature
                }
                processedParts.push(textPart)
              }
            }

            if (processedParts.length > 0) {
              const modelMessage = {
                id: `model-${Date.now()}`,
                role: 'model' as const,
                parts: processedParts,
                timestamp: Date.now(),
                thoughtSummary: thoughtSegments.length > 0 ? thoughtSegments.join('\n\n') : undefined
              }
              drawingStore.addMessage(modelMessage)
            }
          }

          // 如果没有生成图片，显示提示
          if (generatedImages.length === 0 && !service.extractText(response)) {
            alert('未能生成内容，请尝试调整提示词或参数')
          }
        }
      }  // end if (batchCount === 1)
    }  // end else (非流式输出)

  } catch (error: any) {
    console.error('生成失败:', error)
    // 如果是用户主动中断，不显示错误提示
    if (error.name !== 'AbortError') {
      alert(`生成失败: ${error.message || '未知错误'}`)
    }
  } finally {
    drawingStore.isGenerating = false
    currentStreamingText.value = ''
    stopTimer()
    abortController = null  // 清空 abortController
  }
}

// 处理清空对话
const handleClearChat = () => {
  // 如果正在生成中，中断请求
  if (abortController) {
    abortController.abort()
    abortController = null
  }

  // 立即停止生成状态
  drawingStore.isGenerating = false

  // 停止计时器
  stopTimer()

  // 重置流式文本
  currentStreamingText.value = ''
}

// 处理重新生成AI回复
const handleRegenerate = async () => {
  // 检查提供商配置
  const provider = drawingStore.getCurrentProvider()
  const model = drawingStore.getCurrentModel()

  if (!provider || !provider.apiKey) {
    alert('请先在设置中配置 AI 提供商和 API Key')
    showSettings.value = true
    return
  }

  if (!model) {
    alert('请先选择一个模型')
    showSettings.value = true
    return
  }

  try {
    // 创建 AbortController 用于中断请求
    abortController = new AbortController()

    // 标记为生成中
    drawingStore.isGenerating = true
    currentStreamingText.value = ''
    startTimer()
    const systemPrompt = drawingStore.systemPrompt?.trim() || ''

    // 创建 Gemini 服务实例
    const service = new GeminiDrawingService(provider.apiKey, provider.baseURL)

    // 判断是否使用流式输出
    const useStreaming = !model.supportsImage
    if (!useStreaming) {
      drawingStore.streamingThought = ''
    }

    if (useStreaming) {
      // 流式输出处理（仅用于纯文本模型）
      let accumulatedText = ''
      let streamingThoughtBuffer = ''
      drawingStore.streamingThought = ''
      const thoughtStart = Date.now()

      try {
        for await (const chunk of service.generateContentStream(
          model.id,
          drawingStore.conversationHistory,
          drawingStore.generationConfig,
          model.supportsImage,
          abortController.signal,
          systemPrompt || undefined
        )) {
          if (chunk.thought) {
            streamingThoughtBuffer += chunk.thought
            drawingStore.streamingThought = streamingThoughtBuffer
          }

          if (chunk.text) {
            accumulatedText += chunk.text
            currentStreamingText.value = accumulatedText
          }

          if (chunk.done) {
            // 流式完成,添加完整消息到历史
            if (accumulatedText) {
              const thoughtSummary = streamingThoughtBuffer.trim()
              const duration = Date.now() - thoughtStart
              const modelMessage = {
                id: `model-${Date.now()}`,
                role: 'model' as const,
                parts: [{ text: accumulatedText }],
                timestamp: Date.now(),
                thoughtSummary: thoughtSummary ? thoughtSummary : undefined,
                thoughtDurationMs: duration
              }
              drawingStore.addMessage(modelMessage)
            }
          }
        }
      } catch (streamError: any) {
        console.error('流式生成失败:', streamError)
        alert(`生成失败: ${streamError.message || '未知错误'}`)
      } finally {
        currentStreamingText.value = ''
        drawingStore.streamingThought = ''
      }
    } else {
      // 非流式输出（图像生成模型）
      const batchCount = model.supportsImage ? drawingStore.batchGenerationCount : 1

      let response: any

      // 检查是否需要批量生成
      if (batchCount > 1) {
        // 批量并发生成（复用现有逻辑）
        const modelMessageId = `model-${Date.now()}`
        const imageCandidates: any[] = Array.from({ length: batchCount }, (_, idx) => ({
          id: `${modelMessageId}-candidate-${idx}`,
          isGenerating: true,
          prompt: '重新生成'
        }))

        const modelMessage: any = {
          id: modelMessageId,
          role: 'model' as const,
          parts: [],
          timestamp: Date.now(),
          imageCandidates,
          selectedCandidateIndex: -1,
          isAwaitingSelection: true
        }
        drawingStore.addMessage(modelMessage)

        drawingStore.batchGenerationProgress = { current: 0, total: batchCount }

        const generatePromises = imageCandidates.map(async (candidate, idx) => {
          try {
            // 处理自定义分辨率
            let batchOriginalImageSize: '1K' | '2K' | '4K' | undefined
            let batchMappedResolution: '1K' | '2K' | '4K' | undefined

            if (drawingStore.enableCustomResolution) {
              batchMappedResolution = mapResolutionToStandard(
                drawingStore.customResolution.width,
                drawingStore.customResolution.height
              )
              batchOriginalImageSize = drawingStore.generationConfig.imageSize
              drawingStore.generationConfig.imageSize = batchMappedResolution
            }

            const batchResponse = await service.generateContent(
              model.id,
              drawingStore.conversationHistory.slice(0, -1),
              drawingStore.generationConfig,
              model.supportsImage,
              abortController?.signal,
              true,
              systemPrompt || undefined
            )

            // 恢复原始分辨率设置
            if (drawingStore.enableCustomResolution && batchOriginalImageSize) {
              drawingStore.generationConfig.imageSize = batchOriginalImageSize
            }

            if (service.isBlocked(batchResponse)) {
              candidate.error = service.getBlockReason(batchResponse)
              candidate.isGenerating = false
              return
            }

            if (batchResponse.candidates && batchResponse.candidates.length > 0) {
              const apiCandidate = batchResponse.candidates[0]

              const text = service.extractText(batchResponse)
              if (text) {
                candidate.text = text
              }

              if (apiCandidate.content && apiCandidate.content.parts) {
                for (const part of apiCandidate.content.parts) {
                  if (part.inlineData) {
                    candidate.imageData = part.inlineData.data
                    candidate.mimeType = part.inlineData.mimeType
                  }
                  if (part.thoughtSignature) {
                    candidate.thoughtSignature = part.thoughtSignature
                  }
                }
              }

              // 添加自定义分辨率元数据到批量生成的候选
              if (drawingStore.enableCustomResolution && batchMappedResolution) {
                candidate.customResolution = {
                  width: drawingStore.customResolution.width,
                  height: drawingStore.customResolution.height,
                  mappedStandard: batchMappedResolution
                }
              }
            }

            candidate.isGenerating = false
            drawingStore.batchGenerationProgress.current++
          } catch (error: any) {
            console.error(`候选 ${idx + 1} 生成失败:`, error)
            candidate.error = error.message || '生成失败'
            candidate.isGenerating = false
            drawingStore.batchGenerationProgress.current++
          }
        })

        await Promise.all(generatePromises)
        drawingStore.batchGenerationProgress = { current: 0, total: 0 }

        const allFailed = imageCandidates.every(c => c.error)
        if (allFailed) {
          alert('所有图片生成均失败，请检查配置或提示词')
        }
      } else {
        // 单次生成
        // 处理自定义分辨率
        let regenOriginalImageSize: '1K' | '2K' | '4K' | undefined
        let regenMappedResolution: '1K' | '2K' | '4K' | undefined

        if (drawingStore.enableCustomResolution) {
          regenMappedResolution = mapResolutionToStandard(
            drawingStore.customResolution.width,
            drawingStore.customResolution.height
          )
          regenOriginalImageSize = drawingStore.generationConfig.imageSize
          drawingStore.generationConfig.imageSize = regenMappedResolution
        }

        response = await service.generateContent(
          model.id,
          drawingStore.conversationHistory,
          drawingStore.generationConfig,
          model.supportsImage,
          abortController.signal,
          false,
          systemPrompt || undefined
        )

        // 恢复原始分辨率设置
        if (drawingStore.enableCustomResolution && regenOriginalImageSize) {
          drawingStore.generationConfig.imageSize = regenOriginalImageSize
        }

        if (service.isBlocked(response)) {
          const blockReason = service.getBlockReason(response)
          alert(blockReason)
          drawingStore.isGenerating = false
          stopTimer()
          return
        }

        // 提取结果并添加到对话历史（复用现有逻辑）
        if (response.candidates && response.candidates.length > 0) {
          const candidate = response.candidates[0]

          const generatedImages = service.extractImages(
            response,
            '重新生成',
            drawingStore.generationConfig
          )
          generatedImages.forEach(image => {
            // 添加自定义分辨率元数据
            if (drawingStore.enableCustomResolution && regenMappedResolution) {
              image.customResolution = {
                width: drawingStore.customResolution.width,
                height: drawingStore.customResolution.height,
                mappedStandard: regenMappedResolution
              }
            }
            drawingStore.addGeneratedImage(image)
          })

          if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
            const processedParts: any[] = []
            let pendingThoughtSignature: string | null = null

            for (const part of candidate.content.parts) {
              if (part.thoughtSignature && !part.text && !part.inlineData) {
                pendingThoughtSignature = part.thoughtSignature
              } else if (part.inlineData) {
                const imagePart: any = {
                  inlineData: {
                    mimeType: part.inlineData.mimeType,
                    data: part.inlineData.data
                  }
                }
                if (pendingThoughtSignature) {
                  imagePart.thoughtSignature = pendingThoughtSignature
                  pendingThoughtSignature = null
                } else if (part.thoughtSignature) {
                  imagePart.thoughtSignature = part.thoughtSignature
                }
                processedParts.push(imagePart)
              } else if (part.text) {
                const textPart: any = { text: part.text }
                if (part.thoughtSignature) {
                  textPart.thoughtSignature = part.thoughtSignature
                }
                processedParts.push(textPart)
              }
            }

            if (processedParts.length > 0) {
              const modelMessage = {
                id: `model-${Date.now()}`,
                role: 'model' as const,
                parts: processedParts,
                timestamp: Date.now()
              }
              drawingStore.addMessage(modelMessage)
            }
          }
        }
      }
    }
  } catch (error: any) {
    console.error('重新生成失败:', error)
    if (error.name !== 'AbortError') {
      alert(`生成失败: ${error.message || '未知错误'}`)
    }
  } finally {
    drawingStore.isGenerating = false
    currentStreamingText.value = ''
    stopTimer()
    abortController = null
  }
}

// 组件挂载时的初始化
onMounted(() => {
  // 如果没有配置提供商，自动打开设置
  if (availableProviders.value.length === 0) {
    setTimeout(() => {
      if (availableProviders.value.length === 0) {
        showSettings.value = true
      }
    }, 1000)
  }
})
</script>

<style scoped>
/* 网格布局在小屏幕上自动变为单列 */
@media (max-width: 1023px) {
  .grid-cols-1 {
    grid-template-rows: 1fr 1fr;
  }
}
</style>
