<template>
  <div class="h-full flex flex-col overflow-hidden">
    <!-- Main Content -->
    <div class="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 overflow-hidden">
      <!-- Left Column: Prompt Builder -->
      <div class="lg:col-span-3 bg-white rounded-lg shadow-sm flex flex-col overflow-hidden">
         <!-- Header -->
         <div class="flex items-center justify-between border-b border-gray-200 p-4 shrink-0 bg-gray-50">
           <div class="flex items-center gap-2 text-sm font-bold text-gray-700">
             <Layers class="w-4 h-4 text-blue-500" />
             生成参数
           </div>
           <div class="flex items-center gap-2">
               <button
                 @click="isGuideOpen = true"
                 :class="[
                   'p-1.5 rounded transition-colors',
                   isGuideOpen ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-500'
                 ]"
                 title="参考指南"
               >
                  <BookOpen class="w-4 h-4" />
               </button>
               <button
                 @click="handleReset"
                 class="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                 title="重置"
               >
                  <RotateCcw class="w-3.5 h-3.5" />
               </button>
               <button
                 @click="toggleLanguage"
                 class="flex items-center gap-1.5 px-2 py-1 rounded bg-white hover:bg-gray-100 border border-gray-300 transition-colors"
                 title="切换语言"
               >
                 <span :class="['text-[10px] font-bold', activeLang === 'cn' ? 'text-blue-600' : 'text-gray-400']">CN</span>
                 <ArrowRightLeft class="w-3 h-3 text-gray-400" />
                 <span :class="['text-[10px] font-bold', activeLang === 'en' ? 'text-blue-600' : 'text-gray-400']">EN</span>
               </button>
           </div>
         </div>
         <!-- Content -->
         <div class="flex-1 overflow-y-auto p-4">
            <PromptBuilder
              :data="activeLang === 'cn' ? omniDataCN : omniDataEN"
              @update="handleDataUpdate"
              :activeLang="activeLang"
            />
         </div>
      </div>

      <!-- Middle Column: Smart Input + Final Prompt -->
      <div class="lg:col-span-5 flex flex-col gap-4">
         <!-- Smart Input Card -->
         <div class="bg-white rounded-lg shadow-sm" style="overflow: visible;">
           <SmartInput
              ref="smartInputRef"
              @reverseEngineer="handleReverseEngineer"
              @refineComplete="handleDualUpdate"
              @diagnosisComplete="(d) => { diagnosis = d; isDiagnosisOpen = true }"
              @openDiagnosisDrawer="isDiagnosisOpen = true"
              @update:aiProvider="(id) => aiToolProvider = id"
              @update:aiModel="(id) => aiToolModel = id"
              :currentDiagnosis="diagnosis"
              :currentStructure="activeLang === 'cn' ? omniDataCN : omniDataEN"
              :images="referenceImages"
              @update:images="(imgs) => referenceImages = imgs"
              :logicModel="selectedLogicModel"
              @update:logicModel="(m) => selectedLogicModel = m"
              :activeLang="activeLang"
              :hasUsedReverseEngineer="hasUsedReverseEngineer"
           />
         </div>

         <!-- Final Prompt Card -->
         <div class="flex-1 bg-white rounded-lg shadow-sm flex flex-col overflow-hidden">
            <!-- Header -->
            <div class="flex items-center justify-between border-b border-gray-200 p-4 shrink-0 bg-gray-50">
              <h3 class="text-sm font-bold text-gray-700 flex items-center gap-2">
                <Terminal class="w-4 h-4 text-green-500" />
                提示词预览
              </h3>
              <div class="flex gap-2">
                <button
                  @click="handleOptimizeFinalPrompt"
                  :disabled="isOptimizingPrompt || !finalPrompt"
                  class="flex items-center gap-2 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded text-xs font-medium transition-all disabled:opacity-50"
                >
                  <Wand2 v-if="isOptimizingPrompt" class="w-3 h-3 animate-spin" />
                  <Sparkles v-else class="w-3 h-3" />
                  优化
                </button>
                <button
                  @click="copyToClipboard"
                  class="p-1.5 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-800 transition-colors"
                  title="复制"
                >
                  <Check v-if="isCopied" class="w-3 h-3 text-green-500" />
                  <Copy v-else class="w-3 h-3" />
                </button>
              </div>
            </div>
            <!-- Content -->
            <div class="flex-1 overflow-hidden p-4">
              <textarea
                v-model="finalPrompt"
                class="w-full h-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs font-mono text-gray-700 resize-none outline-none"
                placeholder="在左侧配置提示词结构,或使用智能输入功能..."
              />
            </div>
         </div>
      </div>

      <!-- Right Column: Image Generator -->
      <div class="lg:col-span-4 bg-white rounded-lg shadow-sm overflow-hidden">
         <ImageGenerator
            ref="imageGeneratorRef"
            :finalPrompt="finalPrompt"
            :referenceImages="imageGeneratorReferences"
         />
      </div>
    </div>

    <!-- Slide-in Reference Guide -->
    <div
      :class="[
        'fixed top-0 right-0 h-full w-full md:w-[450px] lg:w-[600px] bg-white shadow-2xl z-[70] transform transition-transform duration-300 ease-in-out flex flex-col border-l border-gray-200',
        isGuideOpen ? 'translate-x-0' : 'translate-x-full'
      ]"
    >
      <div class="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50 shrink-0">
          <h2 class="text-sm font-bold text-gray-800 flex items-center gap-2">
            <BookOpen class="w-4 h-4 text-blue-500" />
            参考指南
          </h2>
          <button
              @click="isGuideOpen = false"
              class="p-2 rounded hover:bg-gray-200 text-gray-500 transition-colors"
          >
              <X class="w-5 h-5" />
          </button>
      </div>
      <div class="flex-1 overflow-y-auto bg-white">
           <div class="p-6">
             <StructureGuide :activeLang="activeLang" />
           </div>
      </div>
    </div>

    <!-- Slide-in Quality Analysis Drawer -->
    <div
      :class="[
        'fixed top-0 right-0 h-full w-full md:w-[450px] lg:w-[600px] bg-white shadow-2xl z-[70] transform transition-transform duration-300 ease-in-out flex flex-col border-l border-gray-200',
        isDiagnosisOpen ? 'translate-x-0' : 'translate-x-full'
      ]"
    >
      <div class="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50 shrink-0">
          <h2 class="text-sm font-bold text-gray-800 flex items-center gap-2">
            <Microscope class="w-4 h-4 text-amber-500" />
            质量分析报告 (Quality Analysis)
          </h2>
          <button
              @click="isDiagnosisOpen = false"
              class="p-2 rounded hover:bg-gray-200 text-gray-500 transition-colors"
          >
              <X class="w-5 h-5" />
          </button>
      </div>
      <div v-if="diagnosis" class="flex-1 overflow-y-auto bg-gray-50 p-6">
        <!-- Overall Score -->
        <div class="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-4">
          <div class="flex justify-between items-end mb-2">
            <span class="text-sm font-bold text-gray-600">整体评分 (Overall Score)</span>
            <span :class="[
              'text-2xl font-black',
              diagnosis.overall_score >= 80 ? 'text-emerald-500' :
              diagnosis.overall_score >= 60 ? 'text-amber-500' : 'text-red-500'
            ]">
              {{ diagnosis.overall_score }}<span class="text-sm text-gray-400 font-normal">/100</span>
            </span>
          </div>
          <div class="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
            <div
              :class="[
                'h-full rounded-full transition-all duration-1000',
                diagnosis.overall_score >= 80 ? 'bg-emerald-500' :
                diagnosis.overall_score >= 60 ? 'bg-amber-400' : 'bg-red-500'
              ]"
              :style="{ width: `${diagnosis.overall_score}%` }"
            ></div>
          </div>
        </div>

        <!-- Analysis Cards Grid -->
        <div class="grid grid-cols-2 gap-3 mb-4">
          <div v-for="(item, key) in diagnosis.analysis" :key="key" class="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
            <div class="flex items-center justify-between mb-1.5">
              <span class="text-[10px] font-bold text-gray-500 uppercase">
                {{ getDimensionTitle(String(key)) }}
              </span>
              <span :class="[
                'text-xs font-black',
                item.score >= 80 ? 'text-emerald-500' :
                item.score >= 60 ? 'text-amber-500' : 'text-red-500'
              ]">
                {{ item.score }}
              </span>
            </div>
            <div class="h-1 w-full bg-gray-100 rounded-full overflow-hidden mb-2">
              <div
                :class="[
                  'h-full rounded-full',
                  item.score >= 80 ? 'bg-emerald-500' :
                  item.score >= 60 ? 'bg-amber-400' : 'bg-red-500'
                ]"
                :style="{ width: `${item.score}%` }"
              ></div>
            </div>
            <div class="text-[9px] text-gray-500 mb-1">
              <span :class="[
                'px-1.5 py-0.5 rounded font-bold',
                item.status === 'excellent' ? 'bg-emerald-100 text-emerald-700' :
                item.status === 'good' ? 'bg-blue-100 text-blue-700' :
                item.status === 'fair' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
              ]">
                {{ getStatusText(item.status) }}
              </span>
            </div>
            <p class="text-[10px] text-gray-600 leading-relaxed">{{ item.feedback }}</p>
          </div>
        </div>

        <!-- Issues Section -->
        <div v-if="diagnosis.issues && diagnosis.issues.length > 0" class="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-4 shadow-sm">
          <h4 class="flex items-center gap-2 text-sm font-bold text-orange-800 mb-3">
            <AlertTriangle class="w-4 h-4" />
            发现的问题 (Issues Found)
          </h4>
          <ul class="space-y-2">
            <li v-for="(issue, idx) in diagnosis.issues" :key="idx" class="flex items-start gap-2 text-xs text-orange-800/80 leading-relaxed">
              <span class="font-bold mt-0.5">{{ idx + 1 }}.</span>
              {{ issue }}
            </li>
          </ul>
        </div>

        <!-- Suggestions Section -->
        <div v-if="diagnosis.suggestions && diagnosis.suggestions.length > 0" class="bg-emerald-50 border border-emerald-200 rounded-xl p-4 shadow-sm">
          <h4 class="flex items-center gap-2 text-sm font-bold text-emerald-800 mb-3">
            <Lightbulb class="w-4 h-4" />
            优化建议 (Improvement Suggestions)
          </h4>
          <ul class="space-y-2">
            <li v-for="(suggestion, idx) in diagnosis.suggestions" :key="idx" class="flex items-start gap-2 text-xs text-emerald-800/80 leading-relaxed">
              <span class="font-bold mt-0.5">{{ idx + 1 }}.</span>
              {{ suggestion }}
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { Layers, BookOpen, Terminal, Copy, Check, ArrowRightLeft, RotateCcw, Wand2, Sparkles, X, Microscope, AlertTriangle, Lightbulb } from 'lucide-vue-next'
import { OmniPromptStructure, DualStructureResult, LogicModel } from './optimizer/types'
import PromptBuilder from './optimizer/PromptBuilder.vue'
import SmartInput from './optimizer/SmartInput.vue'
import ImageGenerator from './optimizer/ImageGenerator.vue'
import StructureGuide from './optimizer/StructureGuide.vue'
import { compileOmniPrompt } from './optimizer/geminiService'
import { useDrawingStore } from '@/stores/drawingStore'
import { GeminiDrawingService } from '@/services/geminiDrawingService'

const drawingStore = useDrawingStore()

// Helper functions for diagnosis drawer
const getDimensionTitle = (key: string): string => {
  const titles: Record<string, string> = {
    subject: '角色 (Subject)',
    environment: '场景 (Env)',
    composition: '构图 (Comp)',
    style: '风格 (Style)',
    details: '细节 (Detail)',
    clarity: '表达 (Clarity)'
  }
  return titles[key] || key
}

const getStatusText = (status: string): string => {
  const texts: Record<string, string> = {
    excellent: '优秀',
    good: '良好',
    fair: '一般',
    poor: '较差'
  }
  return texts[status] || status
}

// 使用 store 中的状态（使用 computed 保持响应性并自动保存）
const omniDataCN = computed({
  get: () => drawingStore.optimizerState.omniDataCN,
  set: (val) => drawingStore.updateOptimizerState({ omniDataCN: val })
})

const omniDataEN = computed({
  get: () => drawingStore.optimizerState.omniDataEN,
  set: (val) => drawingStore.updateOptimizerState({ omniDataEN: val })
})

const diagnosis = computed({
  get: () => drawingStore.optimizerState.diagnosis,
  set: (val) => drawingStore.updateOptimizerState({ diagnosis: val })
})

const referenceImages = computed({
  get: () => drawingStore.optimizerState.referenceImages,
  set: (val) => drawingStore.updateOptimizerState({ referenceImages: val })
})

const selectedLogicModel = computed({
  get: () => drawingStore.optimizerState.selectedLogicModel as LogicModel,
  set: (val) => drawingStore.updateOptimizerState({ selectedLogicModel: val })
})

const activeLang = computed({
  get: () => drawingStore.optimizerState.activeLang,
  set: (val) => drawingStore.updateOptimizerState({ activeLang: val })
})

const aiToolProvider = computed({
  get: () => drawingStore.optimizerState.aiToolProvider,
  set: (val) => drawingStore.updateOptimizerState({ aiToolProvider: val })
})

const aiToolModel = computed({
  get: () => drawingStore.optimizerState.aiToolModel,
  set: (val) => drawingStore.updateOptimizerState({ aiToolModel: val })
})

const aiNaturalPromptEN = computed({
  get: () => drawingStore.optimizerState.aiNaturalPromptEN,
  set: (val) => drawingStore.updateOptimizerState({ aiNaturalPromptEN: val })
})

const aiNaturalPromptCN = computed({
  get: () => drawingStore.optimizerState.aiNaturalPromptCN,
  set: (val) => drawingStore.updateOptimizerState({ aiNaturalPromptCN: val })
})

const finalPrompt = computed({
  get: () => drawingStore.optimizerState.finalPrompt,
  set: (val) => drawingStore.updateOptimizerState({ finalPrompt: val })
})

const isAiOptimizedRef = computed({
  get: () => drawingStore.optimizerState.isAiOptimized,
  set: (val) => drawingStore.updateOptimizerState({ isAiOptimized: val })
})

const hasUsedReverseEngineer = computed({
  get: () => drawingStore.optimizerState.hasUsedReverseEngineer,
  set: (val) => drawingStore.updateOptimizerState({ hasUsedReverseEngineer: val })
})

// 本地 UI 状态（不需要持久化）
const isCopied = ref(false)
const isOptimizingPrompt = ref(false)
const isGuideOpen = ref(false)
const isDiagnosisOpen = ref(false)

// 组件引用
const smartInputRef = ref<InstanceType<typeof SmartInput> | null>(null)
const imageGeneratorRef = ref<InstanceType<typeof ImageGenerator> | null>(null)

// Update final prompt when data changes
watch([omniDataCN, omniDataEN, activeLang, aiNaturalPromptEN, aiNaturalPromptCN], () => {
  // 如果是AI优化过的提示词，只需要检查当前语言的prompt是否存在
  const currentAiPrompt = activeLang.value === 'cn' ? aiNaturalPromptCN.value : aiNaturalPromptEN.value
  if (isAiOptimizedRef.value && currentAiPrompt) {
      finalPrompt.value = currentAiPrompt
      return
  }
  const activeData = activeLang.value === 'cn' ? omniDataCN.value : omniDataEN.value
  const simplePrompt = compileOmniPrompt(activeData, activeLang.value)
  finalPrompt.value = simplePrompt
}, { deep: true })

const handleDataUpdate = (newData: OmniPromptStructure) => {
  isAiOptimizedRef.value = false
  if (activeLang.value === 'cn') omniDataCN.value = newData
  else omniDataEN.value = newData
}

const handleReverseEngineer = (result: DualStructureResult) => {
  hasUsedReverseEngineer.value = true
  handleDualUpdate(result)
}

const handleDualUpdate = (result: DualStructureResult) => {
  isAiOptimizedRef.value = true
  omniDataCN.value = result.cn
  omniDataEN.value = result.en
  aiNaturalPromptEN.value = result.naturalPromptEN || ""
  aiNaturalPromptCN.value = result.naturalPromptCN || ""
  finalPrompt.value = activeLang.value === 'cn' ? (result.naturalPromptCN || "") : (result.naturalPromptEN || "")
}

// 计算是否应该将图片作为参考附件传递给ImageGenerator
// 只有在：1. 有文本输入 2. 没有使用过图片逆推 的情况下才传递
const imageGeneratorReferences = computed(() => {
  // 检查是否有文本内容（从结构化数据或AI生成的提示词）
  const hasTextContent = finalPrompt.value.trim().length > 0

  // 只有输入了文本提示词，且没有使用过图片逆推时，才将图片作为参考附件
  if (hasTextContent && !hasUsedReverseEngineer.value) {
    return referenceImages.value
  }
  return []
})

const toggleLanguage = () => {
  activeLang.value = activeLang.value === 'cn' ? 'en' : 'cn'
}

const handleReset = () => {
  if (confirm(activeLang.value === 'cn' ? "确定要清空所有参数吗？" : "Are you sure you want to reset all parameters?")) {
      drawingStore.resetOptimizerState()  // 使用 store 的重置方法

      // 清空AI工具的文本输入框
      if (smartInputRef.value) {
        smartInputRef.value.reset()
      }

      // 清空图片生成器的生成结果
      if (imageGeneratorRef.value) {
        imageGeneratorRef.value.reset()
      }
  }
}

const handleOptimizeFinalPrompt = async () => {
  if (!finalPrompt.value.trim()) return

  // 使用 AI 工具的 provider/model，而非全局的
  if (!aiToolProvider.value || !aiToolModel.value) {
    alert('请先在 AI 工具中选择提供商和模型')
    return
  }

  const provider = drawingStore.getAvailableProviders().find(p => p.id === aiToolProvider.value)
  const models = drawingStore.getAvailableModels(aiToolProvider.value)
  const model = models.find(m => m.id === aiToolModel.value)

  if (!provider || !model) {
    alert('AI 工具的提供商或模型配置无效')
    return
  }

  isOptimizingPrompt.value = true
  try {
    const service = new GeminiDrawingService(provider.apiKey, provider.baseURL)
    const langName = activeLang.value === 'cn' ? "Chinese" : "English"

    // 使用Imagen 3专业系统提示词
    const systemPrompt = `# Role: Imagen 3 / Gemini Image Prompting Specialist

# Profile
You are an expert AI Art Prompt Engineer specializing in Google's **Imagen 3** and **Gemini** models. Your core competency is converting vague or simple user concepts into structured, high-fidelity prompts using the official **"Step-by-Step Layering" (分步分层)** technique.

# The Imagen 3 Formula
You must construct the visual description following this specific logical hierarchy (The "Concentric Circle" Method):
1.  **Style & Medium (基调)**: Photorealism, 3D Render, Oil Painting, etc.
2.  **Scene & Context (环境)**: Setting, Lighting, Composition, Spatial Relations.
3.  **Subject Core (主体)**: Character, Object, Pose, Appearance.
4.  **Text & Logic (文字)**: Specific text content (if any), typography, placement.
5.  **Camera Specs (参数)**: Lens, Aperture, Film Stock, Technical details.

# Operational Rules
1.  **Language**: Output the final prompt in **${langName}** (unless specified otherwise).
2.  **Structure**: You MUST use specific **Natural Language Connectors** to link the layers. Do not use bullet points; use a flowing narrative paragraph or separated sentence blocks.
3.  **Content Enhancement**: If the user input is brief, intelligently infer details (e.g., lighting, texture, camera specs) based on the chosen style to ensure high quality.

# Mandatory Output Format (Strictly Follow)
You must rewrite the input into 3-5 distinct sentences using EXACTLY these starting connectors:

* **首先，[Style/Medium]**：Define the aesthetic, art style, and medium (e.g., "Establish a photorealistic cinematic style...").
* **接着，[Scene/Context]**：Describe the background, lighting atmosphere, and spatial layout (e.g., "Create a background of... with neon lighting...").
* **然后，[Subject/Text]**：Place the main subject in the scene with detailed appearance/pose. If text is required, describe the text content and style here (e.g., "In the center, place a... holding a sign that says...").
* **最后，[Technical Specs]**：Add camera parameters, film grain, or render engine details (e.g., "Render with a 35mm lens, f/1.8 aperture...").

# Task
Rewrite the USER INPUT into a high-quality "Imagen 3 Optimized Prompt" adhering to the structure above. Output **ONLY** the optimized prompt.`

    // Build user instruction with complete diagnosis if available
    let userInstruction = finalPrompt.value
    if (diagnosis.value) {
      userInstruction = `${finalPrompt.value}\n\n---\nQuality Analysis Reference:\n${JSON.stringify(diagnosis.value, null, 2)}`
    }

    const response = await service.generateContent(
      model.id,
      [{
        id: `msg-${Date.now()}`,
        role: 'user',
        parts: [{ text: userInstruction }],
        timestamp: Date.now()
      }],
      { ...drawingStore.generationConfig, temperature: 0.7 },
      false,
      undefined,
      false,
      systemPrompt
    )

    const polished = service.extractText(response).trim() || finalPrompt.value
    // 必须先设置 isAiOptimizedRef 为 true，再设置 aiNaturalPrompt，
    // 否则 watch 会在 isAiOptimizedRef 还是 false 时触发，导致 finalPrompt 被清空
    isAiOptimizedRef.value = true
    if (activeLang.value === 'cn') aiNaturalPromptCN.value = polished
    else aiNaturalPromptEN.value = polished
    finalPrompt.value = polished
  } catch (e: any) {
    console.error("Optimization failed", e)
    const errMsg = e.message
    if (errMsg.includes('API Key') || errMsg.includes('403')) {
      alert('API Key Error: Please check your settings. (请检查 API Key 配置)')
    } else {
      alert(`Optimization Failed: ${errMsg}`)
    }
  } finally {
    isOptimizingPrompt.value = false
  }
}

const copyToClipboard = () => {
  navigator.clipboard.writeText(finalPrompt.value)
  isCopied.value = true
  setTimeout(() => isCopied.value = false, 2000)
}
</script>
