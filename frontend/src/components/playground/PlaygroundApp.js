import { computed, ref, watch } from 'vue'
import PlaygroundChatPanel from './PlaygroundChatPanel.vue'
import PreviewPanel from './PreviewPanel.js'
import '@/style/playground.css'
import { extractArtifact } from '@/services/playground/artifactParser'
import { PlaygroundAIService } from '@/services/playground/aiPlaygroundService'
import { useSettingsStore } from '@/stores/settingsStore'
import { useNotificationStore } from '@/stores/notificationStore'
import { useNavigationStore } from '@/stores/navigationStore'
import { copyToClipboard } from '@/utils/clipboardUtils'
import { ChevronDown } from 'lucide-vue-next'

export default {
  components: { PlaygroundChatPanel, PreviewPanel, ChevronDown },
  props: {
    systemPrompt: {
      type: String,
      default: ''
    },
    prefillPayload: {
      type: Object,
      default: null
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
              @start-edit="startEditMessage"
              @save-edit="(messageId) => saveEditMessage(messageId)"
              @cancel-edit="cancelEditMessage"
              @delete-message="deleteMessage"
              @copy-message="copyMessage"
              @regenerate-message="handleRegenerateMessage"
              @resend="handleResendAfterEdit"
              @resend-user="handleResendUserMessage"
              @edit-input="updateEditingContent"
              @edit-keydown="handleEditKeydown"
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
    const lastPrefillTimestamp = ref(0)

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

    const cloneAttachments = (attachments = []) => attachments.map((att) => ({ ...att }))

    const buildConversationMessages = (sourceMessages) => {
      return sourceMessages.map((msg) => ({
        id: msg.id,
        role: msg.role === 'model' ? 'assistant' : 'user',
        content: msg.text,
        timestamp: msg.timestamp,
        attachments: msg.attachments ? cloneAttachments(msg.attachments) : undefined
      }))
    }

    const handleClear = () => {
      messages.value = []
      currentArtifact.value = null
      isStreaming.value = false
    }

    const toggleStreamMode = () => {
      settingsStore.streamMode = !settingsStore.streamMode
      settingsStore.saveSettings()
    }

    const startEditMessage = (messageId) => {
      const target = messages.value.find((msg) => msg.id === messageId)
      if (!target) return
      target.isEditing = true
      target.editingText = target.text
    }

    const updateEditingContent = ({ messageId, value }) => {
      const target = messages.value.find((msg) => msg.id === messageId)
      if (!target) return
      target.editingText = value
    }

    const cancelEditMessage = (messageId) => {
      const target = messages.value.find((msg) => msg.id === messageId)
      if (!target) return
      target.isEditing = false
      target.editingText = undefined
    }

    const saveEditMessage = (messageId) => {
      const target = messages.value.find((msg) => msg.id === messageId)
      if (!target || !target.isEditing) {
        return false
      }
      const newContent = target.editingText ? target.editingText.trim() : ''
      if (!newContent) {
        notificationStore.warning('消息内容不能为空')
        return false
      }
      target.text = newContent
      target.displayText = undefined
      target.isEditing = false
      target.editingText = undefined
      target.timestamp = Date.now()
      return true
    }

    const deleteMessage = (messageId) => {
      const idx = messages.value.findIndex((msg) => msg.id === messageId)
      if (idx === -1) return
      if (window.confirm('确定要删除这条消息吗？删除后该消息将不会参与继续的对话。')) {
        messages.value.splice(idx, 1)
      }
    }

    const copyMessage = async (messageId) => {
      const target = messages.value.find((msg) => msg.id === messageId)
      if (!target) return
      const content = (target.displayText || target.text || '').trim()
      if (!content) {
        notificationStore.warning('没有可复制的内容')
        return
      }
      try {
        await copyToClipboard(content)
        notificationStore.success('已复制到剪贴板')
      } catch (error) {
        notificationStore.error('复制失败，请稍后重试')
      }
    }

    const handleEditKeydown = ({ messageId, event }) => {
      if (event.key === 'Enter' && event.ctrlKey) {
        event.preventDefault()
        saveEditMessage(messageId)
      } else if (event.key === 'Escape') {
        event.preventDefault()
        cancelEditMessage(messageId)
      }
    }

    const handleSend = async (payload) => {
      const text = payload?.text?.trim()
      const attachments = payload?.attachments || []
      if (!text) {
        if (attachments.length > 0) {
          notificationStore.warning('请输入消息内容，不能只发送附件')
        }
        return
      }
      if (isStreaming.value) {
        notificationStore.warning('AI 正在响应，请稍候')
        return
      }

      const providerInfo = ensureProvider()
      if (!providerInfo) return

      const userMessage = {
        id: Date.now().toString(),
        role: 'user',
        text,
        timestamp: Date.now(),
        attachments: attachments.length ? cloneAttachments(attachments) : undefined
      }
      messages.value.push(userMessage)

      const conversationHistory = buildConversationMessages(messages.value)

      isStreaming.value = true
      const aiMsgId = `${Date.now()}_ai`
      messages.value.push({
        id: aiMsgId,
        role: 'model',
        text: '',
        displayText: '',
        isStreaming: true,
        timestamp: Date.now()
      })
      const aiMessageIdx = messages.value.length - 1

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
          messages: conversationHistory,
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
        messages.value[aiMessageIdx].text = `${messages.value[aiMessageIdx].text || ''}\n\n*Error: ${err?.message || err}*`
        messages.value[aiMessageIdx].displayText = messages.value[aiMessageIdx].text
      } finally {
        messages.value[aiMessageIdx].isStreaming = false
        messages.value[aiMessageIdx].displayText = messages.value[aiMessageIdx].text
        isStreaming.value = false
      }
    }

    const handleRegenerateMessage = async (messageId) => {
      const targetIndex = messages.value.findIndex((msg) => msg.id === messageId)
      if (targetIndex === -1) return
      const target = messages.value[targetIndex]
      if (target.role !== 'model') return
      if (isStreaming.value) {
        notificationStore.warning('AI 正在响应，请稍候')
        return
      }

      const providerInfo = ensureProvider()
      if (!providerInfo) return

      const history = buildConversationMessages(messages.value.slice(0, targetIndex))
      if (history.length === 0) {
        notificationStore.warning('缺少可用的对话上下文')
        return
      }

      isStreaming.value = true
      target.text = ''
      target.displayText = ''
      target.isStreaming = true

      const useStream = settingsStore.streamMode

      try {
        let accumulated = ''
        const onChunk = (chunkText) => {
          accumulated += chunkText
          target.text = accumulated
          target.displayText = buildDisplayText(accumulated)
          const artifact = extractArtifact(accumulated)
          if (artifact) {
            currentArtifact.value = artifact
          }
        }

        const response = await aiService.send({
          messages: history,
          provider: providerInfo.provider,
          modelId: providerInfo.model.id,
          stream: useStream,
          onChunk: useStream ? onChunk : undefined,
          systemPrompt: props.systemPrompt
        })

        if (!useStream && typeof response === 'string') {
          target.text = response
          target.displayText = response
          const artifact = extractArtifact(response)
          if (artifact) {
            currentArtifact.value = artifact
          }
        }
      } catch (error) {
        target.text = `${target.text || ''}\n\n*Error: ${error?.message || error}*`
        target.displayText = target.text
      } finally {
        target.isStreaming = false
        target.displayText = target.text
        isStreaming.value = false
      }
    }

    const handleResendUserMessage = async (messageId) => {
      const targetIndex = messages.value.findIndex((msg) => msg.id === messageId)
      if (targetIndex === -1) return
      const target = messages.value[targetIndex]
      if (target.role !== 'user') return
      if (isStreaming.value) {
        notificationStore.warning('AI 正在响应，请稍候')
        return
      }

      const providerInfo = ensureProvider()
      if (!providerInfo) return

      if (targetIndex < messages.value.length - 1) {
        messages.value.splice(targetIndex + 1)
      }

      const history = buildConversationMessages(messages.value)

      isStreaming.value = true
      const aiMsgId = `${Date.now()}_ai`
      messages.value.push({
        id: aiMsgId,
        role: 'model',
        text: '',
        displayText: '',
        isStreaming: true,
        timestamp: Date.now()
      })
      const aiMessageIdx = messages.value.length - 1

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
          messages: history,
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
      } catch (error) {
        messages.value[aiMessageIdx].text = `${messages.value[aiMessageIdx].text || ''}\n\n*Error: ${error?.message || error}*`
        messages.value[aiMessageIdx].displayText = messages.value[aiMessageIdx].text
      } finally {
        messages.value[aiMessageIdx].isStreaming = false
        messages.value[aiMessageIdx].displayText = messages.value[aiMessageIdx].text
        isStreaming.value = false
      }
    }

    const handleResendAfterEdit = async (messageId) => {
      const saved = saveEditMessage(messageId)
      if (!saved) return
      await handleResendUserMessage(messageId)
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

    const applyPrefillPayload = (payload) => {
      if (!payload) return
      const timestamp = payload.timestamp || Date.now()
      if (timestamp === lastPrefillTimestamp.value) {
        return
      }
      lastPrefillTimestamp.value = timestamp
      const normalized = Array.isArray(payload.messages)
        ? payload.messages
            .map((msg, index) => {
              const text = `${msg?.text ?? msg?.content ?? ''}`
              if (!text.trim()) {
                return null
              }
              const role = msg?.role === 'model' ? 'model' : 'user'
              return {
                id: `prefill-${timestamp}-${index}`,
                role,
                text,
                displayText: role === 'model' ? text : undefined,
                timestamp: Date.now() + index
              }
            })
            .filter(Boolean)
        : []
      messages.value = normalized
      currentArtifact.value = null
      isStreaming.value = false
    }

    watch(
      () => props.prefillPayload,
      (payload) => {
        if (!payload) {
          return
        }
        applyPrefillPayload(payload)
      }
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
      togglePreview,
      startEditMessage,
      saveEditMessage,
      cancelEditMessage,
      deleteMessage,
      copyMessage,
      handleRegenerateMessage,
      handleResendUserMessage,
      handleResendAfterEdit,
      updateEditingContent,
      handleEditKeydown
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
