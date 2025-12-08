<template>
  <div class="h-full flex flex-col overflow-hidden p-2 playground-container">
    <SettingsModal />
    <SystemPromptModal
      :is-open="showSystemPromptModal"
      v-model="systemPromptDraft"
      :title="'设置系统提示词'"
      @close="showSystemPromptModal = false"
      @save="handleSystemPromptSave"
    />

    <div class="bg-white rounded-lg shadow-sm p-4 mb-4 flex-shrink-0">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div class="min-w-0">
          <h1 class="text-xl lg:text-2xl font-bold text-gray-900">提示词操练场</h1>
          <p class="text-sm text-gray-500">实时调试提示词、网页、图表与可视化 Artifact</p>
        </div>
        <div class="flex items-center gap-2 flex-shrink-0 flex-wrap sm:flex-nowrap">
            <label class="text-sm font-medium text-gray-700 whitespace-nowrap">AI模型:</label>
            <select
              v-model="settingsStore.selectedProvider"
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
              v-model="settingsStore.selectedModel"
              @change="settingsStore.saveSettings"
              :disabled="!settingsStore.selectedProvider"
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
    </div>

    <div class="flex-1 min-h-0">
      <PlaygroundApp
        :system-prompt="systemPrompt"
        :prefill-payload="prefillPayload"
        @open-system-prompt="openSystemPromptModal"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import PlaygroundApp from '@/components/playground/PlaygroundApp.js'
import SystemPromptModal from '@/components/modules/optimize/components/SystemPromptModal.vue'
import SettingsModal from '@/components/settings/SettingsModal.vue'
import '@/utils/playgroundGlobals'
import '@/style/playground.css'
import { useSettingsStore } from '@/stores/settingsStore'

const settingsStore = useSettingsStore()
const route = useRoute()

const availableProviders = computed(() => settingsStore.getAvailableProviders())
const availableModels = computed(() => {
  if (!settingsStore.selectedProvider) return []
  return settingsStore.getAvailableModels(settingsStore.selectedProvider)
})

const onProviderChange = () => {
  settingsStore.selectedModel = ''
  const models = availableModels.value
  if (models.length > 0) {
    settingsStore.selectedModel = models[0].id
  }
  settingsStore.saveSettings()
}

const STORAGE_KEY = 'yprompt_playground_system_prompt'
const systemPrompt = ref('')
const systemPromptDraft = ref('')
const showSystemPromptModal = ref(false)
const prefillPayload = ref<PrefillPayload | null>(null)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

interface PrefillMessage {
  role: 'user' | 'model'
  text: string
}

interface PrefillPayload {
  timestamp: number
  promptId: number
  title: string
  messages: PrefillMessage[]
}

if (typeof window !== 'undefined') {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      systemPrompt.value = saved
    }
  } catch (error) {
    console.warn('加载系统提示词失败', error)
  }
}

watch(systemPrompt, (value) => {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, value)
})

const openSystemPromptModal = () => {
  systemPromptDraft.value = systemPrompt.value
  showSystemPromptModal.value = true
}

const handleSystemPromptSave = () => {
  systemPrompt.value = systemPromptDraft.value
}

interface PromptDetail {
  id: number
  title: string
  final_prompt: string
  prompt_type: 'system' | 'user'
  system_prompt?: string
  conversation_history?: string
}

const parseConversationHistory = (history?: string | null): PrefillMessage[] => {
  if (!history) {
    return []
  }
  try {
    const parsed = JSON.parse(history)
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed
      .map((entry: any) => {
        const text = entry?.content ?? entry?.text ?? ''
        if (!text || !text.trim()) {
          return null
        }
        const role = entry?.role === 'assistant' ? 'model' : 'user'
        return {
          role,
          text
        } as PrefillMessage
      })
      .filter((msg): msg is PrefillMessage => Boolean(msg))
  } catch (error) {
    console.warn('解析对话历史失败:', error)
    return []
  }
}

const buildPrefillMessages = (prompt: PromptDetail): PrefillMessage[] => {
  if (prompt.prompt_type !== 'user') {
    return []
  }
  const messages = parseConversationHistory(prompt.conversation_history)
  if (prompt.final_prompt?.trim()) {
    messages.push({
      role: 'user',
      text: prompt.final_prompt
    })
  }
  return messages
}

const loadPromptForPlayground = async (promptId: number) => {
  if (!promptId) return
  try {
    const token = localStorage.getItem('yprompt_token')
    if (!token) {
      throw new Error('请先登录')
    }
    const response = await fetch(`${API_BASE_URL}/api/prompts/${promptId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    const result = await response.json()
    if (result.code !== 200) {
      throw new Error(result.message || '加载失败')
    }
    const prompt = result.data as PromptDetail

    if (prompt.prompt_type === 'user') {
      systemPrompt.value = prompt.system_prompt || ''
    } else {
      systemPrompt.value = prompt.final_prompt || ''
    }
    systemPromptDraft.value = systemPrompt.value

    prefillPayload.value = {
      timestamp: Date.now(),
      promptId: prompt.id,
      title: prompt.title,
      messages: buildPrefillMessages(prompt)
    }
  } catch (error: any) {
    console.error('加载提示词到操练场失败:', error)
    alert(`加载失败: ${error.message || '未知错误'}`)
  }
}

watch(
  () => route.query.promptId,
  (promptId) => {
    const value = Array.isArray(promptId) ? promptId[0] : promptId
    if (value) {
      const parsedId = Number(value)
      if (!Number.isNaN(parsedId)) {
        loadPromptForPlayground(parsedId)
      }
    }
  },
  { immediate: true }
)
</script>
