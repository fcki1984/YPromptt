<template>
  <div class="bg-white border border-gray-200 rounded-xl flex flex-col h-full shadow-sm">
    <!-- Controls -->
    <div class="p-4 border-b border-gray-200 shrink-0">
      <h3 class="font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <Image class="w-5 h-5 text-blue-500" />
        效果验证
      </h3>

      <div class="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label class="text-[10px] text-gray-500 uppercase font-bold tracking-wider">比例 (Ratio)</label>
          <select
            v-model="aspectRatio"
            class="w-full bg-gray-50 border border-gray-300 text-gray-700 text-xs rounded p-2 mt-1 focus:border-blue-500 outline-none"
          >
            <option :value="AspectRatio.SQUARE">1:1</option>
            <option :value="AspectRatio.LANDSCAPE">4:3</option>
            <option :value="AspectRatio.WIDE">16:9</option>
            <option :value="AspectRatio.PORTRAIT">3:4</option>
            <option :value="AspectRatio.TALL">9:16</option>
          </select>
        </div>

        <div>
          <label class="text-[10px] text-gray-500 uppercase font-bold tracking-wider">分辨率 (Res)</label>
           <select
            v-model="resolution"
            :disabled="!isProModel"
            :class="[
              'w-full bg-gray-50 border border-gray-300 text-gray-700 text-xs rounded p-2 mt-1 focus:border-blue-500 outline-none',
              !isProModel ? 'opacity-50 cursor-not-allowed' : ''
            ]"
          >
            <option :value="ImageResolution.RES_1K">1K</option>
            <option :value="ImageResolution.RES_2K">2K</option>
            <option :value="ImageResolution.RES_4K">4K</option>
          </select>
        </div>
      </div>

      <!-- Reference Image Indicator -->
      <div v-if="props.referenceImages.length > 0" class="mb-4 bg-indigo-50 border border-indigo-100 rounded px-2 py-1.5 flex items-center gap-2">
        <Layers class="w-3.5 h-3.5 text-indigo-500" />
        <span class="text-[10px] text-indigo-700 font-medium">
          使用 {{ props.referenceImages.length }} 张图片作为参考 (Using references)
        </span>
      </div>

      <button
        @click="handleGenerate"
        :disabled="generating || !props.finalPrompt"
        :class="[
          'w-full py-3 rounded-lg font-bold text-white flex justify-center items-center gap-2 transition-all shadow-md',
          generating || !props.finalPrompt
            ? 'bg-slate-300 cursor-not-allowed text-slate-500 shadow-none'
            : 'bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-500 hover:to-sky-500 shadow-blue-200'
        ]"
      >
        <template v-if="generating">
          <Sparkles class="w-4 h-4 animate-spin" />
          生成中...
        </template>
        <template v-else>
          <Sparkles class="w-4 h-4" />
          生成图片
        </template>
      </button>
    </div>

    <!-- Output Area -->
    <div class="flex-1 p-4 bg-slate-100/50 flex flex-col justify-start items-center min-h-[300px] relative overflow-hidden rounded-b-xl border-t border-slate-100">
      <div v-if="error" class="absolute top-4 left-4 right-4 bg-red-50 border border-red-200 text-red-600 p-3 rounded text-xs flex items-start gap-2 z-20 shadow-sm max-h-[80%] overflow-y-auto">
        <AlertTriangle class="w-4 h-4 shrink-0 mt-0.5" />
        <span class="break-words whitespace-pre-wrap leading-relaxed font-mono text-[10px]">{{ error }}</span>
      </div>

      <div v-if="generatedImage" class="relative w-full flex justify-center group p-2">
        <img
          :src="generatedImage"
          alt="Generated Result"
          class="max-w-full object-contain rounded-lg shadow-xl border border-white"
          style="max-height: calc(100vh - 400px);"
        />
        <div class="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
          <a
            :href="generatedImage"
            :download="`gemini-gen-${Date.now()}.png`"
            class="bg-white text-slate-800 p-2.5 rounded-full shadow-xl hover:bg-slate-50 block border border-slate-200"
          >
            <Download class="w-5 h-5" />
          </a>
        </div>
      </div>

      <div v-else class="text-center text-slate-400 mt-10">
         <div class="w-16 h-16 border-2 border-slate-200 border-dashed rounded-xl mx-auto mb-3 flex items-center justify-center bg-white">
            <Image class="w-6 h-6 opacity-40" />
         </div>
         <p class="text-xs font-medium">Ready to Imagine</p>
         <p v-if="currentModel === 'gemini-3-pro-image-preview'" class="text-[10px] text-slate-300 mt-2 max-w-[200px] mx-auto">
            Note: Pro model requires a billed project Key.
         </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Image, Download, Sparkles, AlertTriangle, Layers } from 'lucide-vue-next'
import { AspectRatio, ImageResolution, UploadedImage } from './types'
import { useDrawingStore } from '@/stores/drawingStore'
import { GeminiDrawingService } from '@/services/geminiDrawingService'

const drawingStore = useDrawingStore()

interface Props {
  finalPrompt: string
  referenceImages: UploadedImage[]
}

const props = withDefaults(defineProps<Props>(), {
  referenceImages: () => []
})

const generating = ref(false)

// 使用 store 持久化生成的图片（使用本地 ref + watch 方式）
const generatedImage = ref<string | null>(drawingStore.optimizerState.generatedImage)

// 监听变化并同步到 store
watch(generatedImage, (newVal) => {
  drawingStore.updateOptimizerState({ generatedImage: newVal })
}, { immediate: false })

// 监听 store 变化以支持外部更新
watch(() => drawingStore.optimizerState.generatedImage, (newVal) => {
  if (generatedImage.value !== newVal) {
    generatedImage.value = newVal
  }
})

const aspectRatio = ref<AspectRatio>(AspectRatio.SQUARE)
const resolution = ref<ImageResolution>(ImageResolution.RES_1K)
const error = ref<string | null>(null)

// Get current model from drawing store
const currentModel = computed(() => {
  const model = drawingStore.getCurrentModel()
  return model?.id || 'gemini-3-pro-image-preview'
})

// Check if it's a Pro model (supports higher resolution)
const isProModel = computed(() => {
  return currentModel.value.includes('pro')
})

const handleGenerate = async () => {
  if (!props.finalPrompt) return

  // Ensure we have a valid provider
  const provider = drawingStore.getCurrentProvider()
  if (!provider || !provider.apiKey) {
    error.value = "请先在顶部选择AI提供商和模型"
    return
  }

  generating.value = true
  error.value = null
  try {
    const service = new GeminiDrawingService(provider.apiKey, provider.baseURL)

    // Build message parts with reference images + prompt
    const parts: Array<{
      text?: string
      inlineData?: { mimeType: string; data: string }
    }> = []

    // Add reference images first
    if (props.referenceImages && props.referenceImages.length > 0) {
      props.referenceImages.forEach(img => {
        parts.push({
          inlineData: {
            mimeType: img.mimeType,
            data: img.data
          }
        })
      })
    }

    // Add text prompt
    parts.push({ text: props.finalPrompt })

    // Create custom generation config for image generation
    // 使用设置里的参数，只覆盖图片特定的配置
    const imageGenConfig = {
      ...drawingStore.generationConfig,
      // 覆盖图片特定参数
      aspectRatio: aspectRatio.value,
      imageSize: resolution.value,
      responseModalities: ['TEXT', 'IMAGE'] as Array<'TEXT' | 'IMAGE'>
    }

    // Generate image using GeminiDrawingService
    const response = await service.generateContent(
      currentModel.value,
      [{
        id: `msg-${Date.now()}`,
        role: 'user',
        parts: parts,
        timestamp: Date.now()
      }],
      imageGenConfig,
      true,  // supportsImage = true
      undefined,  // no abort signal
      false  // not silent
    )

    // Extract image data from response
    const candidate = response.candidates?.[0]
    if (candidate?.content?.parts) {
      for (const part of candidate.content.parts) {
        if (part.inlineData && part.inlineData.data) {
          const base64 = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`
          generatedImage.value = base64
          return
        }
      }
    }

    // If no image found, check for text response
    const textParts = candidate?.content?.parts?.filter(p => p.text).map(p => p.text).join('')
    if (textParts) {
      throw new Error(`模型返回文本而非图片: ${textParts.substring(0, 200)}...`)
    }

    throw new Error("响应中未找到图片数据")
  } catch (err: any) {
    console.error("图片生成失败:", err)
    const errMsg = err.message || "图片生成失败"
    error.value = errMsg
  } finally {
    generating.value = false
  }
}

// 重置方法，清空生成的图片和错误信息
const reset = () => {
  generatedImage.value = null
  error.value = null
}

// 暴露reset方法给父组件
defineExpose({
  reset
})
</script>
