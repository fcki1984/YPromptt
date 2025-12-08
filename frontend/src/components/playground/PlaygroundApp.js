import { computed, ref, watch } from 'vue'
import PlaygroundChatPanel from './PlaygroundChatPanel.vue'
import PreviewPanel from './PreviewPanel.js'
import '@/style/playground.css'
import { extractArtifact } from '@/services/playground/artifactParser'
import { PlaygroundAIService } from '@/services/playground/aiPlaygroundService'
import { useSettingsStore } from '@/stores/settingsStore'
import { useNotificationStore } from '@/stores/notificationStore'
import { useNavigationStore } from '@/stores/navigationStore'
import { ChevronDown } from 'lucide-vue-next'

export default {
  components: { PlaygroundChatPanel, PreviewPanel, ChevronDown },
  props: {
    systemPrompt: {
      type: String,
      default: ''
    }
  },
  emits: ['open-system-prompt'],
  template: `
    <div class="h-full flex flex-col min-h-0">
      <div
        class="flex-1 min-h-0 flex flex-col xl:flex-row gap-4"
        :class="navigationStore.isMobile ? 'gap-2' : ''"
      >
        <!-- 对话面板 -->
        <div
          :class="[
            'flex flex-col',
            navigationStore.isMobile
              ? (chatExpanded ? 'flex-1 min-h-0' : 'flex-shrink-0')
              : 'min-h-0 w-full xl:w-[420px] xl:max-w-[460px] flex-shrink-0 min-h-[300px]'
          ]"
        >
          <div
            v-if="navigationStore.isMobile && !chatExpanded"
            @click="toggleChat"
            class="bg-white rounded-lg shadow-sm p-3 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors flex-shrink-0"
          >
            <h3 class="font-semibold text-gray-800">对话面板</h3>
            <ChevronDown class="w-5 h-5 text-gray-500" />
          </div>
          <div
            v-if="!navigationStore.isMobile || chatExpanded"
            :class="[
              'flex flex-col min-h-0',
              navigationStore.isMobile ? 'flex-1' : 'h-full'
            ]"
          >
            <PlaygroundChatPanel
              :messages="messages"
              :is-streaming="isStreaming"
              :is-stream-mode="settingsStore.streamMode"
              :has-system-prompt="hasSystemPrompt"
              :current-model-name="currentModelName"
              @send="handleSend"
              @clear="handleClear"
              @toggle-stream="toggleStreamMode"
              @open-system-prompt="$emit('open-system-prompt')"
            />
          </div>
        </div>

        <!-- 预览面板 -->
        <div
          :class="[
            'flex flex-col',
            navigationStore.isMobile
              ? (previewExpanded ? 'flex-1 min-h-0' : 'flex-shrink-0')
              : 'flex-1 min-h-0'
          ]"
        >
          <div
            v-if="navigationStore.isMobile && !previewExpanded"
            @click="togglePreview"
            class="bg-white rounded-lg shadow-sm p-3 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors flex-shrink-0"
          >
            <h3 class="font-semibold text-gray-800">预览面板</h3>
            <ChevronDown class="w-5 h-5 text-gray-500" />
          </div>
          <div
            v-if="!navigationStore.isMobile || previewExpanded"
            :class="[
              'flex flex-col min-h-0',
              navigationStore.isMobile ? 'flex-1' : 'h-full'
            ]"
          >
            <div class="flex-1 min-h-0 bg-[#f0f4f9] rounded-lg overflow-hidden">
              <PreviewPanel :artifact="currentArtifact" />
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  setup(props) {
    const settingsStore = useSettingsStore()
    const notificationStore = useNotificationStore()
    const navigationStore = useNavigationStore()
    const aiService = PlaygroundAIService.getInstance()

    const messages = ref([])
    const isStreaming = ref(false)
    const currentArtifact = ref(null)
    const chatExpanded = ref(true)
    const previewExpanded = ref(false)

    const hasSystemPrompt = computed(() => Boolean(props.systemPrompt && props.systemPrompt.trim().length))

    const currentModelName = computed(() => {
      const provider = settingsStore.getCurrentProvider()
      const model = settingsStore.getCurrentModel()
      if (provider && model) {
        return `${provider.name} · ${model.name}`
      }
      return '未连接模型'
    })

    const ensureProvider = () => {
      const provider = settingsStore.getCurrentProvider()
      const model = settingsStore.getCurrentModel()
      if (!provider || !model || !provider.apiKey) {
        notificationStore.warning('请先在系统设置中配置可用的 AI 模型和 API Key')
        return null
      }
      return { provider, model }
    }

    const handleClear = () => {
      messages.value = []
      currentArtifact.value = null
    }

    const toggleStreamMode = () => {
      settingsStore.streamMode = !settingsStore.streamMode
      settingsStore.saveSettings()
    }

    const handleSend = async (payload) => {
      const text = payload?.text?.trim()
      if (!text) return

      const providerInfo = ensureProvider()
      if (!providerInfo) return

      const userMessage = {
        id: Date.now().toString(),
        role: 'user',
        text,
        timestamp: Date.now()
      }
      messages.value.push(userMessage)

      isStreaming.value = true
      const aiMsgId = `${Date.now()}_ai`
      const aiMessageIdx =
        messages.value.push({
          id: aiMsgId,
          role: 'model',
          text: '',
          displayText: '',
          isStreaming: true,
          timestamp: Date.now()
        }) - 1

      const payloadMessages = messages.value.map((msg) => ({
        id: msg.id,
        role: msg.role === 'model' ? 'assistant' : 'user',
        content: msg.text,
        timestamp: msg.timestamp
      }))

      const useStream = settingsStore.streamMode

      try {
        let accumulated = ''
        const onChunk = (chunkText) => {
          accumulated += chunkText
          messages.value[aiMessageIdx].text = accumulated
          messages.value[aiMessageIdx].displayText = buildDisplayText(accumulated)
          const artifact = extractArtifact(accumulated)
          if (artifact) {
            currentArtifact.value = artifact
          }
        }

        const response = await aiService.send({
          messages: payloadMessages,
          provider: providerInfo.provider,
          modelId: providerInfo.model.id,
          stream: useStream,
          onChunk: useStream ? onChunk : undefined,
          systemPrompt: props.systemPrompt
        })

        if (!useStream && typeof response === 'string') {
          messages.value[aiMessageIdx].text = response
          messages.value[aiMessageIdx].displayText = response
          const artifact = extractArtifact(response)
          if (artifact) {
            currentArtifact.value = artifact
          }
        }
      } catch (err) {
        messages.value[aiMessageIdx].text += `\n\n*Error: ${err?.message || err}*`
        messages.value[aiMessageIdx].displayText = messages.value[aiMessageIdx].text
      } finally {
        messages.value[aiMessageIdx].isStreaming = false
        messages.value[aiMessageIdx].displayText = messages.value[aiMessageIdx].text
        isStreaming.value = false
      }
    }

    const toggleChat = () => {
      if (!navigationStore.isMobile) return
      chatExpanded.value = true
      previewExpanded.value = false
    }

    const togglePreview = () => {
      if (!navigationStore.isMobile) return
      chatExpanded.value = false
      previewExpanded.value = true
    }

    watch(
      () => navigationStore.isMobile,
      (isMobile) => {
        if (isMobile) {
          chatExpanded.value = true
          previewExpanded.value = false
        } else {
          chatExpanded.value = true
          previewExpanded.value = true
        }
      },
      { immediate: true }
    )

    return {
      messages,
      isStreaming,
      currentArtifact,
      handleSend,
      handleClear,
      toggleStreamMode,
      currentModelName,
      settingsStore,
      hasSystemPrompt,
      navigationStore,
      chatExpanded,
      previewExpanded,
      toggleChat,
      togglePreview
    }
  }
}

const buildDisplayText = (text) => {
  const matches = text.match(/```/g)
  if (matches && matches.length % 2 !== 0) {
    return `${text}\n\`\`\``
  }
  return text
}
