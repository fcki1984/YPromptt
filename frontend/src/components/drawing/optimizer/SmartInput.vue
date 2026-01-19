<template>
  <div class="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-4 shadow-sm h-auto transition-all duration-300 ease-in-out" style="overflow: visible;">

    <!-- Header -->
    <div class="flex items-center justify-between shrink-0">
      <div class="flex items-center gap-2">
        <Sparkles class="w-5 h-5 text-blue-500" />
        <h3 class="font-bold text-gray-800">绘境灵析</h3>
      </div>

      <div class="flex items-center gap-3">
         <!-- Provider and Model Selector -->
         <!-- Model Selection (独立选择，不影响全局) -->
         <div class="flex items-center gap-2">
            <select
              v-model="localSelectedProvider"
              @change="onProviderChange"
              class="bg-gray-50 text-[11px] text-gray-700 outline-none cursor-pointer border border-gray-300 rounded px-2 py-1"
              :disabled="isBusy"
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
              v-model="localSelectedModel"
              @change="onModelChange"
              :disabled="!localSelectedProvider || isBusy"
              class="bg-gray-50 text-[11px] text-gray-700 outline-none cursor-pointer border border-gray-300 rounded px-2 py-1 disabled:opacity-50"
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

         <div class="group relative flex items-center">
           <Info class="w-4 h-4 text-slate-400 hover:text-sky-500 cursor-help transition-colors" />
           <div class="absolute right-0 top-6 w-96 md:w-[520px] max-h-[80vh] overflow-y-auto bg-white border border-slate-200 p-4 rounded-xl text-[10px] text-slate-600 shadow-2xl opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-[9999] scale-95 group-hover:scale-100">
             <!-- Tooltip Content -->
             <div class="font-bold text-sky-600 mb-2 border-b border-slate-100 pb-1 flex items-center gap-1">
                <Sparkles class="w-3 h-3" />
                工作流逻辑 (Workflow)
             </div>
             <p class="mb-1"><span class="text-slate-900 font-bold">1. 仅文本:</span> 优化结构并生成提示词。</p>
             <p class="mb-1"><span class="text-slate-900 font-bold">2. 图片逆推:</span> 仅<span class="text-amber-500 font-bold">单图</span>模式可用。</p>
             <p class="mb-3"><span class="text-slate-900 font-bold">3. 文本+多图:</span> 禁用逆推。图片仅作为风格、构图的<span class="text-emerald-500 font-bold">AI 参考素材</span>。</p>

             <div class="font-bold text-emerald-600 mb-2 border-b border-slate-100 pb-1 flex items-center gap-1 mt-3">
                <Lightbulb class="w-3 h-3" />
                优化技术原理 (Sequential Prompting)
             </div>
             <p class="mb-2 text-slate-500 leading-relaxed">
               本工具采用<b>分层叙事架构 (Layered Narrative Framework)</b>，通过逻辑连接词引导 Gemini 按顺序构建画面：
             </p>
             <div class="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg p-2 mb-2 border border-indigo-100">
               <div class="flex flex-wrap items-center gap-1.5 text-[9px] font-mono text-indigo-700">
                 <span class="font-bold bg-white px-1.5 py-0.5 rounded">1.Style 风格</span>
                 <span class="text-indigo-400">→</span>
                 <span class="font-bold bg-white px-1.5 py-0.5 rounded">2.Scene 环境</span>
                 <span class="text-indigo-400">→</span>
                 <span class="font-bold bg-white px-1.5 py-0.5 rounded">3.Subject 主体</span>
                 <span class="text-indigo-400">→</span>
                 <span class="font-bold bg-white px-1.5 py-0.5 rounded">4.Text 文字</span>
                 <span class="text-indigo-400">→</span>
                 <span class="font-bold bg-white px-1.5 py-0.5 rounded">5.Specs 参数</span>
               </div>
             </div>
             <p class="text-[9px] text-slate-400 leading-relaxed mb-2">
               <span class="text-indigo-600 font-bold">五步构建法：</span>
               <b>首先</b>(确立基调) → <b>接着</b>(构建环境) → <b>然后</b>(刻画主体) → <b>然后</b>(植入文字) → <b>最后</b>(技术参数)
             </p>

             <div class="font-bold text-indigo-600 mb-2 border-b border-slate-100 pb-1 flex items-center gap-1 mt-3">
                <Brain class="w-3 h-3" />
                独立逻辑模型 (Independent Logic)
             </div>
             <p class="text-slate-500 leading-relaxed">
               控制台支持独立选择 <b>Text/Logic 模型</b> (Gemini 3 Pro/Flash Preview)，专门用于处理逆推、润色和质量分析任务，与右侧的生图模型互不影响。
             </p>
           </div>
         </div>
      </div>
    </div>

    <!-- Main Content Area -->
    <div class="flex flex-col gap-3">
      <!-- Image Grid -->
      <div v-if="props.images.length > 0" class="grid grid-cols-3 gap-2">
        <div
          v-for="(img, index) in props.images"
          :key="img.id"
          class="relative rounded-lg overflow-hidden border border-slate-200 bg-slate-50 group aspect-square cursor-move"
          draggable="true"
          @dragstart="handleSortDragStart($event, index)"
          @dragover="handleSortDragOver($event, index)"
          @drop="handleSortDrop($event, index)"
        >
          <img :src="img.previewUrl" :alt="`Ref ${index}`" class="w-full h-full object-cover" />
          <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <button
                  @click="lightboxImage = img.previewUrl"
                  class="p-1.5 bg-white/20 hover:bg-white/40 rounded-full text-white backdrop-blur-sm transition-colors"
                  title="Preview"
              >
                  <Maximize2 class="w-4 h-4" />
              </button>
              <button
                  @click="removeImage(img.id)"
                  class="p-1.5 bg-red-500/50 hover:bg-red-500/80 rounded-full text-white backdrop-blur-sm transition-colors"
                  title="Remove"
              >
                  <Trash2 class="w-4 h-4" />
              </button>
          </div>
          <div class="absolute top-1 left-1 px-1.5 py-0.5 bg-black/50 rounded text-[9px] text-white font-mono backdrop-blur-sm">
              {{ index + 1 }}
          </div>
        </div>
        <div
          @click="handleClickUpload"
          @dragover="handleDragOver"
          @dragleave="handleDragLeave"
          @drop="handleDrop"
          :class="[
            'border-2 border-dashed rounded-lg flex flex-col items-center justify-center transition-all aspect-square',
            isBusy
              ? 'border-slate-200 bg-slate-50 cursor-not-allowed opacity-50'
              : isDragging
                ? 'border-sky-500 bg-sky-50 scale-[1.02] cursor-copy'
                : 'border-slate-300 hover:border-sky-400 hover:bg-slate-50 hover:text-sky-500 text-slate-400 cursor-pointer'
          ]"
        >
            <Upload :class="['w-5 h-5 mb-1 transition-transform', isDragging ? 'animate-bounce' : '']" />
            <span class="text-[9px] font-bold">{{ isDragging ? "Drop" : "Add" }}</span>
        </div>
      </div>
      <div
        v-else
        @click="handleClickUpload"
        @dragover="handleDragOver"
        @dragleave="handleDragLeave"
        @drop="handleDrop"
        :class="[
          'shrink-0 border-2 border-dashed rounded-lg h-24 flex flex-col items-center justify-center transition-all',
          isBusy
            ? 'border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed'
            : isDragging
              ? 'border-sky-500 bg-sky-50 scale-[1.02] cursor-copy'
              : 'border-slate-300 bg-slate-50/50 hover:border-sky-400 hover:bg-slate-50 hover:text-sky-500 text-slate-400 cursor-pointer'
        ]"
      >
        <Upload :class="['w-5 h-5 mb-1 transition-transform', isDragging ? 'animate-bounce' : '']" />
        <span class="text-xs font-medium">{{ isDragging ? "释放以上传" : "点击或拖拽图片到此处" }}</span>
        <span class="text-[10px] text-slate-400 mt-1">支持多图上传</span>
      </div>
      <input type="file" ref="fileInputRef" @change="handleFileChange" accept="image/*" multiple class="hidden" :disabled="isBusy" />

      <textarea
        v-model="textInput"
        :placeholder="props.activeLang === 'cn' ? '在此输入文本描述... (Text Prompt Input)' : 'Enter text prompt here...'"
        :disabled="isBusy"
        :class="[
          'w-full bg-slate-50 border border-slate-300 rounded-lg p-3 text-sm text-slate-800 outline-none resize-none placeholder:text-slate-400 min-h-[120px]',
          isBusy ? 'opacity-60 cursor-not-allowed' : ''
        ]"
      />
    </div>

    <!-- Buttons -->
    <div class="grid grid-cols-3 gap-2 shrink-0">
      <button
        @click="handleReverse"
        :disabled="isBusy || props.images.length !== 1"
        :class="[
          'flex flex-col items-center justify-center p-2 rounded-lg border transition-all',
          isBusy || props.images.length !== 1
            ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed opacity-60'
            : 'border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-600'
        ]"
      >
        <ScanEye :class="['w-5 h-5 mb-1', isReversing ? 'animate-spin' : '']" />
        <span class="text-[10px] font-bold">图片逆推</span>
        <span v-if="props.images.length > 1" class="text-[9px] text-red-400 scale-75 block -mt-1">(仅单图)</span>
      </button>

      <button
        @click="handleDiagnosis"
        :disabled="isDiagnosisDisabled"
        :class="[
          'flex flex-col items-center justify-center p-2 rounded-lg border transition-all',
          isDiagnosisDisabled
            ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
            : 'border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-600'
        ]"
        :title="!textInput && props.images.length > 0 && !props.hasUsedReverseEngineer ? '请先使用图片逆推' : ''"
      >
        <Microscope :class="['w-5 h-5 mb-1', isDiagnosing ? 'animate-bounce' : '']" />
        <span class="text-[10px] font-bold">质量分析</span>
      </button>

      <button
        @click="handleRefine"
        :disabled="isRefineDisabled"
        :class="[
          'flex flex-col items-center justify-center p-2 rounded-lg border transition-all',
          isRefineDisabled
            ? 'border-emerald-100 bg-emerald-50 text-emerald-400 cursor-not-allowed'
            : 'border-emerald-500 bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-200'
        ]"
        :title="!textInput && props.images.length > 0 && !props.hasUsedReverseEngineer ? '请先使用图片逆推' : ''"
      >
        <Wand2 :class="['w-5 h-5 mb-1', isRefining ? 'animate-spin' : '']" />
        <span class="text-[10px] font-bold">AI 润色</span>
      </button>
    </div>

    <div v-if="error" class="bg-red-50 border border-red-200 text-red-600 p-2 rounded text-xs flex items-center gap-2 shrink-0">
      <AlertCircle class="w-4 h-4" />
      {{ error }}
    </div>

    <!-- Diagnosis Report Button -->
    <div v-if="props.currentDiagnosis" class="shrink-0">
      <button
        @click="$emit('openDiagnosisDrawer')"
        class="w-full flex items-center justify-between p-3 bg-gradient-to-r from-amber-50 to-orange-50 hover:from-amber-100 hover:to-orange-100 border border-amber-200 rounded-lg transition-all shadow-sm"
      >
        <div class="flex items-center gap-2">
          <Microscope class="w-4 h-4 text-amber-600" />
          <span class="text-sm font-bold text-amber-800">质量分析完成 (View Analysis)</span>
        </div>
        <div class="flex items-center gap-2">
          <span :class="[
            'text-lg font-black',
            props.currentDiagnosis.overall_score >= 80 ? 'text-emerald-600' :
            props.currentDiagnosis.overall_score >= 60 ? 'text-amber-600' : 'text-red-600'
          ]">
            {{ props.currentDiagnosis.overall_score }}<span class="text-xs text-gray-500 font-normal">/100</span>
          </span>
          <ChevronRight class="w-4 h-4 text-amber-600" />
        </div>
      </button>
    </div>

    <!-- Lightbox -->
    <div
      v-if="lightboxImage"
      class="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm"
      @click="lightboxImage = null"
    >
      <button
        class="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/40 rounded-full text-white transition-colors"
        @click="lightboxImage = null"
      >
        <X class="w-6 h-6" />
      </button>
      <img
        :src="lightboxImage"
        alt="Full preview"
        class="max-w-full max-h-[90vh] object-contain rounded shadow-2xl"
        @click.stop
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { Upload, X, ScanEye, Sparkles, AlertCircle, Microscope, Wand2, Info, ChevronRight, Maximize2, Trash2, Brain, Lightbulb } from 'lucide-vue-next'
import { DiagnosisResult, DualStructureResult, OmniPromptStructure, UploadedImage, LogicModel } from './types'
import { useDrawingStore } from '@/stores/drawingStore'
import { GeminiDrawingService } from '@/services/geminiDrawingService'

const drawingStore = useDrawingStore()

interface Props {
  currentDiagnosis: DiagnosisResult | null
  currentStructure: OmniPromptStructure
  images: UploadedImage[]
  logicModel: LogicModel
  activeLang: 'cn' | 'en'
  hasUsedReverseEngineer: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  reverseEngineer: [data: DualStructureResult]
  refineComplete: [data: DualStructureResult]
  diagnosisComplete: [data: DiagnosisResult]
  openDiagnosisDrawer: []
  'update:images': [images: UploadedImage[]]
  'update:logicModel': [model: LogicModel]
  'update:aiProvider': [providerId: string]
  'update:aiModel': [modelId: string]
}>()

// SmartInput 独立的 provider/model 选择（不影响全局配置）
const localSelectedProvider = ref<string>('')
const localSelectedModel = ref<string>('')

// 获取所有提供商
const availableProviders = computed(() => {
  return drawingStore.getAvailableProviders()
})

// 获取当前提供商的非生图模型（只显示文本模型）
const availableModels = computed(() => {
  if (!localSelectedProvider.value) return []
  const allModels = drawingStore.getAvailableModels(localSelectedProvider.value)
  // 过滤掉生图模型，只保留非生图模型（文本模型）
  return allModels.filter(model => !model.supportsImage)
})

const onProviderChange = () => {
  // 切换提供商时清空模型选择
  localSelectedModel.value = ''
  const models = availableModels.value
  // 自动选择第一个非生图模型
  if (models.length > 0) {
    localSelectedModel.value = models[0].id
    // 通知父组件模型变化
    emit('update:aiModel', models[0].id)
  }
  // 通知父组件提供商变化
  emit('update:aiProvider', localSelectedProvider.value)
}

const onModelChange = () => {
  // 通知父组件模型变化
  emit('update:aiModel', localSelectedModel.value)
}

const getService = () => {
  if (!localSelectedProvider.value || !localSelectedModel.value) {
    throw new Error('请先选择AI提供商和模型')
  }

  const provider = availableProviders.value.find(p => p.id === localSelectedProvider.value)
  if (!provider) {
    throw new Error('提供商不存在')
  }

  return new GeminiDrawingService(provider.apiKey, provider.baseURL)
}

const getCurrentModel = () => {
  if (!localSelectedProvider.value || !localSelectedModel.value) {
    return null
  }

  const model = availableModels.value.find(m => m.id === localSelectedModel.value)
  return model || null
}

// 默认选择第一个可用的提供商和模型
onMounted(() => {
  const providers = availableProviders.value
  if (providers.length > 0 && !localSelectedProvider.value) {
    localSelectedProvider.value = providers[0].id
    onProviderChange()
  }
})

// 使用 store 持久化文本输入（使用本地 ref + watch 方式）
const textInput = ref(drawingStore.optimizerState.smartInputText)

// 监听变化并同步到 store
watch(textInput, (newVal) => {
  drawingStore.updateOptimizerState({ smartInputText: newVal })
}, { immediate: false })

// 监听 store 变化以支持外部更新
watch(() => drawingStore.optimizerState.smartInputText, (newVal) => {
  if (textInput.value !== newVal) {
    textInput.value = newVal
  }
})

const isDragging = ref(false)

const isReversing = ref(false)
const isDiagnosing = ref(false)
const isRefining = ref(false)

const error = ref<string | null>(null)

const lightboxImage = ref<string | null>(null)
const draggedImageIndex = ref<number | null>(null)

const fileInputRef = ref<HTMLInputElement | null>(null)
const isBusy = computed(() => isReversing.value || isDiagnosing.value || isRefining.value)

// 判断质量分析按钮是否应该禁用
// 规则：如果只有图片（没有文本），必须使用过图片逆推才能使用质量分析
const isDiagnosisDisabled = computed(() => {
  if (isBusy.value) return true

  const hasText = textInput.value.trim().length > 0
  const hasImages = props.images.length > 0

  // 没有输入也没有图片
  if (!hasText && !hasImages) return true

  // 只有图片，没有文本 - 必须先使用过图片逆推
  if (!hasText && hasImages) {
    return !props.hasUsedReverseEngineer
  }

  // 有文本（无论是否有图片），都可以使用质量分析
  return false
})

// 判断AI润色按钮是否应该禁用
// 规则：
// 1. 必须先进行质量分析
// 2. 如果只有图片（没有文本），必须使用过图片逆推才能使用AI润色
const isRefineDisabled = computed(() => {
  if (isBusy.value) return true

  // 必须先进行质量分析
  if (!props.currentDiagnosis) return true

  const hasText = textInput.value.trim().length > 0
  const hasImages = props.images.length > 0

  // 只有图片，没有文本 - 必须先使用过图片逆推
  if (!hasText && hasImages) {
    return !props.hasUsedReverseEngineer
  }

  // 有文本（无论是否有图片），都可以使用AI润色
  return false
})


const processFiles = (fileList: FileList | null) => {
  if (!fileList || fileList.length === 0) return

  // 先过滤出图片文件
  const imageFiles = Array.from(fileList).filter(file => file.type.startsWith('image/'))
  if (imageFiles.length === 0) return

  const newImages: UploadedImage[] = []
  let processedCount = 0

  imageFiles.forEach(file => {
    const reader = new FileReader()
    reader.onload = (event) => {
      const result = event.target?.result as string
      const base64Data = result.split(',')[1]
      newImages.push({
        id: crypto.randomUUID(),
        data: base64Data,
        mimeType: file.type,
        previewUrl: result
      })
      processedCount++
      // 使用过滤后的图片数量作为比较基准
      if (processedCount === imageFiles.length) {
        emit('update:images', [...props.images, ...newImages])
        error.value = null
      }
    }
    reader.readAsDataURL(file)
  })
}

const handleFileChange = (e: Event) => {
  const target = e.target as HTMLInputElement
  processFiles(target.files)
  if (fileInputRef.value) fileInputRef.value.value = ''
}

const handleDragOver = (e: DragEvent) => {
  e.preventDefault()
  isDragging.value = true
}

const handleDragLeave = (e: DragEvent) => {
  e.preventDefault()
  isDragging.value = false
}

const handleDrop = (e: DragEvent) => {
  e.preventDefault()
  isDragging.value = false
  processFiles(e.dataTransfer?.files || null)
}

// 处理点击上传
const handleClickUpload = () => {
  if (!isBusy.value && fileInputRef.value) {
    fileInputRef.value.click()
  }
}

const removeImage = (id: string) => {
  emit('update:images', props.images.filter(img => img.id !== id))
}

const handleSortDragStart = (e: DragEvent, index: number) => {
  draggedImageIndex.value = index
  e.dataTransfer!.effectAllowed = "move"
}

const handleSortDragOver = (e: DragEvent, _index: number) => {
  e.preventDefault()
  e.dataTransfer!.dropEffect = "move"
}

const handleSortDrop = (e: DragEvent, dropIndex: number) => {
  e.preventDefault()
  if (draggedImageIndex.value === null) return
  const newImages = [...props.images]
  const [draggedItem] = newImages.splice(draggedImageIndex.value, 1)
  newImages.splice(dropIndex, 0, draggedItem)
  emit('update:images', newImages)
  draggedImageIndex.value = null
}

// --- API Handlers ---

const handleReverse = async () => {
  if (props.images.length === 0) {
    error.value = "请先上传参考图片"
    return
  }
  if (props.images.length > 1) {
    error.value = "多图模式不支持逆推，仅支持单图。"
    return
  }

  isReversing.value = true
  error.value = null
  try {
    const service = getService()
    const currentModel = getCurrentModel()
    if (!currentModel) {
      throw new Error('请先选择模型')
    }

    const OMNI_SCHEMA_STRING = `{
  "meta": { "aspectRatio": "string", "imageCount": 1, "negativePrompt": "string" },
  "artStyle": { "medium": "string", "visualStyle": "string", "renderer": "string" },
  "subject": { "main": "string", "action": "string", "clothing": "string", "accessories": "string" },
  "environment": { "scene": "string", "time": "string", "weather": "string", "lighting": "string" },
  "camera": { "shotType": "string", "lens": "string", "composition": "string", "spatial": "string" },
  "typography": { "text": "string", "style": "string", "placement": "string" },
  "logic": { "constraints": "string", "details": "string" }
}`

    const systemPrompt = `You are a professional Reverse Prompt Engineer specializing in Google Imagen 3.
TASK: Analyze the image and generate structured JSON (en & cn) + two natural language paragraphs (en & cn) using Google Imagen 3 Formula.

OUTPUT REQUIREMENTS:
1. Extract ALL visible details from the image
2. Fill in as many fields as possible - be thorough and descriptive
3. For artStyle: analyze medium (e.g., "digital art", "oil painting", "photograph"), visualStyle (e.g., "minimalist", "realistic", "anime"), and renderer (e.g., "octane render", "unreal engine")
4. For subject: describe the main subject, their action, clothing, and accessories in detail
5. For environment: describe scene, time of day, weather conditions, and lighting
6. For camera: identify shot type, lens characteristics, composition, and spatial arrangement
7. **CRITICAL**: If a field doesn't apply or cannot be determined from the image, use an EMPTY STRING (""), NOT "无", "none", "N/A", or any other placeholder text

JSON Schema (BOTH en and cn must follow this exact structure):
${OMNI_SCHEMA_STRING}

RESPONSE FORMAT (pure JSON only, no markdown):
{
  "en": ${OMNI_SCHEMA_STRING},
  "cn": ${OMNI_SCHEMA_STRING},
  "naturalPromptEN": "A fluent English paragraph following Google Imagen 3 Formula: [Context/Scene] -> [Subject] -> [Details/Style] -> [Tech Specs]",
  "naturalPromptCN": "流畅的中文段落，遵循 Google Imagen 3 公式：[场景/背景] -> [主体] -> [细节/风格] -> [技术规格]"
}

REMEMBER: Empty fields should be "" (empty string), never use words like "无", "none", "N/A", or similar placeholders.`

    // Create a custom generation config with responseMimeType for JSON
    const reverseConfig = {
      ...drawingStore.generationConfig,
      responseMimeType: "application/json" as const,
      temperature: 0.5,
      maxOutputTokens: 4096  // Ensure enough tokens for complete JSON output
    }

    const response = await service.generateContent(
      currentModel.id,
      [{
        id: `msg-${Date.now()}`,
        role: 'user',
        parts: [
          { inlineData: { mimeType: props.images[0].mimeType, data: props.images[0].data } },
          { text: 'Reverse engineer this image and extract its complete prompt structure following the schema provided.' }
        ],
        timestamp: Date.now()
      }],
      reverseConfig,
      false,
      undefined,
      false,
      systemPrompt
    )

    const text = service.extractText(response)

    // Clean JSON (remove markdown code blocks if any)
    let cleaned = text.trim()
    cleaned = cleaned.replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/\s*```$/, "")

    const parsed = JSON.parse(cleaned)

    // Sanitize structures to ensure all fields exist
    const sanitizeStructure = (data: any): OmniPromptStructure => {
      const initialStructure: OmniPromptStructure = {
        meta: { aspectRatio: "1:1", imageCount: 1, negativePrompt: "" },
        artStyle: { medium: "", visualStyle: "", renderer: "" },
        subject: { main: "", action: "", clothing: "", accessories: "" },
        environment: { scene: "", time: "", weather: "", lighting: "" },
        camera: { shotType: "", lens: "", composition: "", spatial: "" },
        typography: { text: "", style: "", placement: "" },
        logic: { constraints: "", details: "" }
      }

      if (!data || typeof data !== 'object') return initialStructure
      return {
        meta: { ...initialStructure.meta, ...(data.meta || {}) },
        artStyle: { ...initialStructure.artStyle, ...(data.artStyle || {}) },
        subject: { ...initialStructure.subject, ...(data.subject || {}) },
        environment: { ...initialStructure.environment, ...(data.environment || {}) },
        camera: { ...initialStructure.camera, ...(data.camera || {}) },
        typography: { ...initialStructure.typography, ...(data.typography || {}) },
        logic: { ...initialStructure.logic, ...(data.logic || {}) }
      }
    }

    const result: DualStructureResult = {
      en: sanitizeStructure(parsed.en),
      cn: sanitizeStructure(parsed.cn),
      naturalPromptEN: parsed.naturalPromptEN || "",
      naturalPromptCN: parsed.naturalPromptCN || ""
    }

    emit('reverseEngineer', result)
  } catch (e: any) {
    console.error("图片逆推错误:", e)
    error.value = "图片逆推失败: " + e.message
  } finally {
    isReversing.value = false
  }
}

const handleDiagnosis = async () => {
  if (!textInput.value && props.images.length === 0) {
    error.value = "请输入描述或上传图片"
    return
  }
  isDiagnosing.value = true
  error.value = null
  try {
    const service = getService()
    const currentModel = getCurrentModel()
    if (!currentModel) {
      throw new Error('请先选择模型')
    }

    // 根据生成参数的语言类型设置输出语言
    const outputLangInstruction = props.activeLang === 'cn'
      ? "CRITICAL: You MUST output the 'feedback', 'issues', and 'suggestions' fields in SIMPLIFIED CHINESE (简体中文)."
      : "CRITICAL: You MUST output the 'feedback', 'issues', and 'suggestions' fields in ENGLISH."

    const systemPrompt = `You are a professional **AI Image Prompt Quality Expert**.
Evaluate based on 6 Dimensions: Subject, Environment, Composition, Style, Details, Clarity.
${outputLangInstruction}

OUTPUT FORMAT (Strict JSON):
{
  "overall_score": number (0-100),
  "overall_status": "good"|"needs_improvement"|"poor",
  "analysis": {
    "subject": { "score": number, "status": "excellent|good|fair|poor", "feedback": "Localized String" },
    "environment": { "score": number, "status": "excellent|good|fair|poor", "feedback": "Localized String" },
    "composition": { "score": number, "status": "excellent|good|fair|poor", "feedback": "Localized String" },
    "style": { "score": number, "status": "excellent|good|fair|poor", "feedback": "Localized String" },
    "details": { "score": number, "status": "excellent|good|fair|poor", "feedback": "Localized String" },
    "clarity": { "score": number, "status": "excellent|good|fair|poor", "feedback": "Localized String" }
  },
  "issues": ["Localized String"],
  "suggestions": ["Localized String"]
}`

    // Build user message parts
    const parts: any[] = []

    // Construct context based on inputs
    let userInstruction = ""
    if (props.images.length > 0 && textInput.value) {
      userInstruction = `Context: User uploaded ${props.images.length} image(s).\nPrompt to analyze: "${textInput.value}".`
    } else if (props.images.length > 0) {
      userInstruction = `Analyze the first image for prompt structure quality.`
    } else {
      userInstruction = `Analyze this Prompt: "${textInput.value}".`
    }

    // Add images first if any
    props.images.forEach(img => {
      parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } })
    })

    // Then add text instruction
    parts.push({ text: userInstruction })

    // Create config with enough tokens for complete JSON output
    const diagnosisConfig = {
      ...drawingStore.generationConfig,
      responseMimeType: "application/json" as const,
      maxOutputTokens: 4096
    }

    const response = await service.generateContent(
      currentModel.id,
      [{ id: `msg-${Date.now()}`, role: 'user', parts, timestamp: Date.now() }],
      diagnosisConfig,
      false,
      undefined,
      false,
      systemPrompt
    )

    const text = service.extractText(response)
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('无法解析AI响应')

    const result = JSON.parse(jsonMatch[0])
    emit('diagnosisComplete', result as DiagnosisResult)
  } catch (e: any) {
    error.value = "诊断失败: " + e.message
  } finally {
    isDiagnosing.value = false
  }
}

const handleRefine = async () => {
  isRefining.value = true
  error.value = null
  try {
    const service = getService()
    const currentModel = getCurrentModel()
    if (!currentModel) {
      throw new Error('请先选择模型')
    }

    const OMNI_SCHEMA_STRING = `{
  "meta": { "aspectRatio": "string", "imageCount": 1, "negativePrompt": "string" },
  "artStyle": { "medium": "string", "visualStyle": "string", "renderer": "string" },
  "subject": { "main": "string", "action": "string", "clothing": "string", "accessories": "string" },
  "environment": { "scene": "string", "time": "string", "weather": "string", "lighting": "string" },
  "camera": { "shotType": "string", "lens": "string", "composition": "string", "spatial": "string" },
  "typography": { "text": "string", "style": "string", "placement": "string" },
  "logic": { "constraints": "string", "details": "string" }
}`

    const systemPrompt = `You are an expert Prompt Optimizer utilizing the **Google Imagen 3 Prompting Formula**.
THE FORMULA: **[Context/Scene] -> [Subject] -> [Details/Style] -> [Tech Specs]**

GOALS: Output 'en' and 'cn' JSON structures + TWO natural language paragraphs following the formula.

**CRITICAL EMPTY VALUE HANDLING**:
- If a field doesn't apply or cannot be determined, use an EMPTY STRING (""), NOT "无", "none", "N/A", or any placeholder text
- Empty fields should be "" (empty string), never use words like "无", "none", "N/A", or similar placeholders

JSON Schema:
{
  "en": ${OMNI_SCHEMA_STRING},
  "cn": ${OMNI_SCHEMA_STRING},
  "naturalPromptEN": "Fluent English paragraph following the formula",
  "naturalPromptCN": "Fluent Chinese paragraph following the formula"
}`

    // Build prompt context
    const parts: any[] = []

    // Add images first if any
    props.images.forEach(img => {
      parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } })
    })

    // Build context with current structure, user intent, and diagnosis
    let promptContext = `TASK: Refine/Create Prompt Structure.\nUser Intent: "${textInput.value || 'Optimize and refine this.'}"\nCurrent Structure: ${JSON.stringify(props.currentStructure)}`

    // Add complete diagnosis if available
    if (props.currentDiagnosis) {
      promptContext += `\n\nQuality Analysis:\n${JSON.stringify(props.currentDiagnosis, null, 2)}`
    }

    parts.push({ text: promptContext })

    const response = await service.generateContent(
      currentModel.id,
      [{ id: `msg-${Date.now()}`, role: 'user', parts, timestamp: Date.now() }],
      {
        ...drawingStore.generationConfig,
        responseMimeType: "application/json",
        maxOutputTokens: 4096
      },
      false,
      undefined,
      false,
      systemPrompt
    )

    const text = service.extractText(response)
    const cleaned = text.trim().replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/\s*```$/, "")
    const parsed = JSON.parse(cleaned)

    // Sanitize structures
    const sanitizeStructure = (data: any): OmniPromptStructure => {
      const initialStructure: OmniPromptStructure = {
        meta: { aspectRatio: "1:1", imageCount: 1, negativePrompt: "" },
        artStyle: { medium: "", visualStyle: "", renderer: "" },
        subject: { main: "", action: "", clothing: "", accessories: "" },
        environment: { scene: "", time: "", weather: "", lighting: "" },
        camera: { shotType: "", lens: "", composition: "", spatial: "" },
        typography: { text: "", style: "", placement: "" },
        logic: { constraints: "", details: "" }
      }

      if (!data || typeof data !== 'object') return initialStructure
      return {
        meta: { ...initialStructure.meta, ...(data.meta || {}) },
        artStyle: { ...initialStructure.artStyle, ...(data.artStyle || {}) },
        subject: { ...initialStructure.subject, ...(data.subject || {}) },
        environment: { ...initialStructure.environment, ...(data.environment || {}) },
        camera: { ...initialStructure.camera, ...(data.camera || {}) },
        typography: { ...initialStructure.typography, ...(data.typography || {}) },
        logic: { ...initialStructure.logic, ...(data.logic || {}) }
      }
    }

    const result: DualStructureResult = {
      en: sanitizeStructure(parsed.en),
      cn: sanitizeStructure(parsed.cn),
      naturalPromptEN: parsed.naturalPromptEN || "",
      naturalPromptCN: parsed.naturalPromptCN || ""
    }

    emit('refineComplete', result)
  } catch (e: any) {
    console.error(e)
    error.value = "优化失败: " + e.message
  } finally {
    isRefining.value = false
  }
}

// 重置方法，供父组件调用
const reset = () => {
  textInput.value = ''
  error.value = null
}

// 暴露给父组件
defineExpose({
  reset
})
</script>

<script lang="ts">
import { defineComponent } from 'vue'

// Diagnosis Card Component
export const DiagnosisCard = defineComponent({
  name: 'DiagnosisCard',
  props: {
    title: { type: String, required: true },
    data: { type: Object as () => { score: number; status: string; feedback: string } | undefined, default: undefined }
  },
  setup(_props) {
    const getColor = (score: number) => {
      if (score >= 80) return 'text-emerald-600'
      if (score >= 60) return 'text-amber-500'
      return 'text-red-500'
    }

    return { getColor }
  },
  template: `
    <div v-if="data" class="bg-white border border-slate-100 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow">
      <div class="flex justify-between items-start mb-2">
        <h4 class="text-xs font-bold text-slate-700">{{ title }}</h4>
        <span :class="['text-sm font-bold', getColor(data.score)]">{{ data.score }}</span>
      </div>
      <p class="text-[10px] text-slate-500 leading-relaxed">{{ data.feedback }}</p>
    </div>
  `
})
</script>
