<template>
  <div
    class="drawing-chat h-full flex flex-col bg-white rounded-lg shadow-sm overflow-hidden border border-gray-100 relative"
    @dragover.prevent="handleGlobalDragOver"
    @dragenter.prevent="handleGlobalDragEnter"
    @dragleave.prevent="handleGlobalDragLeave"
    @drop.prevent="handleGlobalDrop"
  >
    <SystemPromptModal
      :is-open="showSystemPromptModal"
      v-model="systemPromptDraft"
      :title="'设置系统提示词'"
      @close="showSystemPromptModal = false"
      @save="handleSystemPromptSave"
    />
    <!-- Header -->
    <div class="p-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
      <div class="flex items-center space-x-4">
        <div class="text-lg font-semibold">AI对话</div>

        <!-- 批量生成数量控制（仅图片模型显示） -->
        <div
          v-if="currentModel?.supportsImage"
          class="flex items-center space-x-2"
        >
          <span class="text-sm text-gray-600">生成数量:</span>
          <input
            v-model.number="drawingStore.batchGenerationCount"
            type="number"
            min="1"
            max="4"
            :disabled="drawingStore.isGenerating"
            class="w-12 px-2 py-1 text-sm text-center border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
            title="每次并发生成的图片数量（1-4张）"
          />
          <span class="text-sm text-gray-600">张</span>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <button
          @click="openSystemPromptModal"
          class="p-2 rounded-lg border transition-colors"
          :class="hasSystemPrompt ? 'border-blue-200 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-500 hover:bg-gray-50'"
          title="设置系统提示词"
        >
          <FileText class="w-4 h-4" />
        </button>

        <button
          @click="handleClearChat"
          class="p-2 rounded-lg border border-gray-200 text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
          title="重新开始"
        >
          <RefreshCw class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- Messages -->
    <div ref="chatContainer" class="flex-1 overflow-y-auto bg-gray-50 px-4 py-6 space-y-5">
      <!-- 欢迎消息 -->
      <div
        v-if="messages.length === 0"
        class="h-full flex flex-col items-center justify-center text-gray-400 p-6 text-center"
      >
        <div class="w-16 h-16 rounded-2xl bg-white border border-gray-200 flex items-center justify-center mb-4">
          <Sparkles class="w-8 h-8 text-gray-300" />
        </div>
        <p class="text-base font-medium text-gray-700 mb-2">开始对话生成图片</p>
        <p class="text-sm text-gray-500 max-w-xs">
          描述您想要的图片,或上传图片进行编辑
        </p>
      </div>

      <!-- 消息列表 -->
      <div
        v-for="message in messages"
        :key="message.id"
        :class="message.role === 'user' ? 'justify-end' : 'justify-start'"
        class="flex group"
      >
        <div
          class="flex flex-col w-full"
          :class="getMessageEditState(message.id).isEditing ? 'max-w-full sm:max-w-2xl' : 'max-w-xs lg:max-w-md'"
        >
          <div
            v-if="shouldShowThoughtSummary(message)"
            :class="[
              'mb-1 w-full max-w-full text-xs',
              message.role === 'user' ? 'ml-auto' : 'mr-auto'
            ]"
          >
            <button
              class="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-500 hover:text-gray-700 transition-colors"
              @click="toggleThoughtExpanded(message.id)"
            >
              <Lightbulb class="w-3.5 h-3.5 text-gray-500" />
              <span class="text-gray-600">思考过程</span>
              <span v-if="message.thoughtDurationMs" class="text-gray-400 text-[10px]">· {{ formatThoughtDuration(message.thoughtDurationMs) }}</span>
              <ChevronDown
                class="w-3 h-3 text-gray-400 transition-transform duration-150"
                :class="isThoughtExpanded(message.id) ? 'rotate-180' : ''"
              />
            </button>
            <div
              v-show="isThoughtExpanded(message.id)"
              class="mt-1 px-4 py-3 text-sm text-gray-800 whitespace-pre-wrap leading-relaxed bg-gray-50 rounded-md"
            >
              {{ message.thoughtSummary }}
            </div>
          </div>

          <!-- 消息内容 -->
          <div
            :class="[
              getMessageEditState(message.id).isEditing
                ? 'bg-transparent border-0 shadow-none p-0'
                : message.role === 'user'
                  ? 'bg-blue-500 text-white px-4 py-3 rounded-lg'
                  : 'bg-gray-100 text-gray-800 px-4 py-3 rounded-lg',
              !getMessageEditState(message.id).isEditing && (message.role === 'user' ? 'ml-auto' : 'mr-auto'),
              'transition-all duration-300 relative'
            ]"
          >
            <!-- 编辑模式 -->
            <div v-if="getMessageEditState(message.id).isEditing" class="relative">
              <div class="relative border border-blue-300 rounded-2xl overflow-hidden bg-white">
                <textarea
                  :value="getMessageEditState(message.id).editingText"
                  @input="updateEditingText(message.id, ($event.target as HTMLTextAreaElement).value)"
                  class="w-full p-4 border-0 resize-none focus:outline-none text-gray-800 bg-white min-h-[80px] max-h-[200px] overflow-y-auto text-base"
                  placeholder="编辑消息内容..."
                  @keydown.ctrl.enter="saveEditAndResend(message)"
                  @keydown.esc="cancelEdit(message.id)"
                ></textarea>
              </div>
            </div>

            <!-- 正常显示模式 -->
            <div v-else>
              <div v-for="(part, index) in message.parts" :key="index">
                <!-- 用户消息直接显示 -->
                <p v-if="part.text && message.role === 'user'" class="whitespace-pre-wrap break-words text-white">
                  {{ part.text }}
                </p>

                <!-- AI消息使用Markdown渲染 -->
                <div
                  v-if="part.text && message.role === 'model'"
                  v-html="renderMarkdown(part.text)"
                  class="prose prose-sm max-w-none prose-headings:text-gray-800 prose-p:text-gray-800 prose-li:text-gray-800 prose-strong:text-gray-800"
                ></div>

                <!-- 图片内容 -->
                <img
                  v-if="part.inlineData"
                  :src="`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`"
                  alt="图片"
                  class="max-w-full rounded mt-2"
                />
              </div>

              <!-- 批量候选图片（仅AI消息） -->
              <div v-if="message.role === 'model' && message.imageCandidates && message.imageCandidates.length > 0" class="mt-3">
                <div class="text-xs text-gray-500 mb-2">
                  {{ message.isAwaitingSelection ? '请选择一张图片继续对话：' : '候选图片：' }}
                  <span class="text-gray-400">({{ message.imageCandidates.filter(c => !c.isGenerating && !c.error).length }}/{{ message.imageCandidates.length }})</span>
                </div>

                <!-- 候选图片网格 -->
                <div class="grid grid-cols-2 gap-3">
                  <div
                    v-for="(candidate, idx) in message.imageCandidates"
                    :key="candidate.id"
                    class="relative group"
                  >
                    <!-- 图片容器 -->
                    <div
                      :class="[
                        'relative rounded-lg overflow-hidden border-2 transition-all cursor-pointer',
                        message.selectedCandidateIndex === idx
                          ? 'border-blue-500 ring-2 ring-blue-200'
                          : 'border-gray-200 hover:border-blue-300',
                        message.isAwaitingSelection && !candidate.isGenerating && !candidate.error
                          ? 'hover:shadow-lg'
                          : ''
                      ]"
                      @click="() => message.isAwaitingSelection && !candidate.isGenerating && !candidate.error && selectCandidate(message.id, idx)"
                    >
                      <!-- 生成中 -->
                      <div v-if="candidate.isGenerating" class="aspect-square bg-gray-100 flex flex-col items-center justify-center">
                        <div class="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                        <div class="text-xs text-gray-500">生成中 {{ idx + 1 }}/{{ message.imageCandidates!.length }}</div>
                      </div>

                      <!-- 生成失败 -->
                      <div v-else-if="candidate.error" class="aspect-square bg-red-50 flex flex-col items-center justify-center p-3">
                        <X class="w-8 h-8 text-red-400 mb-2" />
                        <div class="text-xs text-red-600 text-center">生成失败</div>
                        <div class="text-xs text-red-500 text-center mt-1">{{ candidate.error }}</div>
                      </div>

                      <!-- 生成成功 -->
                      <div v-else-if="candidate.imageData" class="aspect-square">
                        <img
                          :src="`data:${candidate.mimeType};base64,${candidate.imageData}`"
                          alt="候选图片"
                          class="w-full h-full object-cover"
                        />

                        <!-- 选中标记 -->
                        <div
                          v-if="message.selectedCandidateIndex === idx"
                          class="absolute top-2 right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center"
                        >
                          <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                          </svg>
                        </div>

                        <!-- 序号 -->
                        <div class="absolute top-2 left-2 w-6 h-6 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
                          <span class="text-xs text-white font-medium">{{ idx + 1 }}</span>
                        </div>

                        <!-- 查看大图按钮 -->
                        <button
                          v-if="candidate.imageData && candidate.mimeType"
                          @click.stop="openImagePreview(candidate.imageData!, candidate.mimeType!)"
                          class="absolute bottom-2 right-2 p-1.5 bg-black bg-opacity-50 hover:bg-opacity-70 rounded-full transition-all opacity-0 group-hover:opacity-100"
                          title="查看大图"
                        >
                          <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"></path>
                          </svg>
                        </button>

                        <!-- 选择提示 -->
                        <div
                          v-if="message.isAwaitingSelection"
                          class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all flex items-center justify-center pointer-events-none"
                        >
                          <div class="opacity-0 group-hover:opacity-100 text-white text-xs font-medium bg-black bg-opacity-60 px-2 py-1 rounded">
                            点击选择
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- 文本描述（如果有） -->
                    <div v-if="candidate.text" class="mt-1 text-xs text-gray-600 line-clamp-2">
                      {{ candidate.text }}
                    </div>
                  </div>
                </div>

                <!-- 确认按钮（选择后显示） -->
                <div v-if="message.isAwaitingSelection && message.selectedCandidateIndex !== undefined && message.selectedCandidateIndex >= 0" class="mt-3 flex justify-end">
                  <button
                    @click="confirmCandidateSelection(message.id)"
                    class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
                  >
                    确认选择并继续对话
                  </button>
                </div>
              </div>

              <!-- 时间戳 -->
              <div
                :class="[
                  'text-xs mt-1',
                  message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                ]"
              >
                {{ formatTime(message.timestamp) }}
              </div>
            </div>
          </div>

          <!-- 操作按钮 -->
          <div
            class="flex space-x-1 mt-2 transition-opacity duration-200"
            :class="[
              getMessageEditState(message.id).isEditing ? 'opacity-100 justify-end' : 'opacity-0 group-hover:opacity-100 ' + (message.role === 'user' ? 'justify-end' : 'justify-start')
            ]"
          >
            <!-- 编辑模式按钮 -->
            <template v-if="getMessageEditState(message.id).isEditing">
              <button
                @click="saveEditAndResend(message)"
                class="p-1.5 text-gray-500 hover:text-blue-600 transition-colors rounded-lg hover:bg-gray-100"
                title="保存并重新发送 (Ctrl+Enter)"
                :disabled="isGenerating"
              >
                <Send class="w-3.5 h-3.5" />
              </button>

              <button
                @click="cancelEdit(message.id)"
                class="p-1.5 text-gray-500 hover:text-red-600 transition-colors rounded-lg hover:bg-gray-100"
                title="取消编辑 (Esc)"
              >
                <X class="w-3.5 h-3.5" />
              </button>
            </template>

            <!-- 正常模式按钮 -->
            <template v-else>
              <!-- AI消息：重新生成按钮 -->
              <button
                v-if="message.role === 'model'"
                @click="regenerateMessage(message)"
                class="p-1.5 text-gray-500 hover:text-blue-600 transition-colors rounded-lg hover:bg-gray-100"
                title="重新生成回复"
                :disabled="isGenerating"
              >
                <RefreshCw class="w-3.5 h-3.5" />
              </button>

              <!-- 用户消息：重新发送按钮 -->
              <button
                v-if="message.role === 'user'"
                @click="resendUserMessage(message)"
                class="p-1.5 text-gray-500 hover:text-blue-600 transition-colors rounded-lg hover:bg-gray-100"
                title="重新发送消息"
                :disabled="isGenerating"
              >
                <Send class="w-3.5 h-3.5" />
              </button>

              <!-- 编辑按钮 - 图片消息不显示 -->
              <button
                v-if="message.role === 'user' || !hasImageContent(message)"
                @click="startEdit(message)"
                class="p-1.5 text-gray-500 hover:text-green-600 transition-colors rounded-lg hover:bg-gray-100"
                title="编辑消息"
              >
                <Edit2 class="w-3.5 h-3.5" />
              </button>

              <!-- 删除按钮 -->
              <button
                @click="deleteMessage(message)"
                class="p-1.5 text-gray-500 hover:text-red-600 transition-colors rounded-lg hover:bg-gray-100"
                title="删除消息"
              >
                <Trash2 class="w-3.5 h-3.5" />
              </button>

              <!-- 复制按钮 - 图片消息不显示 -->
              <button
                v-if="!hasImageContent(message)"
                @click="copyMessage(message)"
                class="p-1.5 text-gray-500 hover:text-blue-600 transition-colors rounded-lg hover:bg-gray-100"
                title="复制消息内容"
              >
                <Copy class="w-3.5 h-3.5" />
              </button>
            </template>
          </div>
        </div>
      </div>

      <!-- 流式思考过程 -->
      <div v-if="showStreamingThoughtCard" class="flex justify-start">
        <div class="bg-gray-50 rounded-md px-3 py-2 mr-auto max-w-xs lg:max-w-md text-xs">
          <div class="flex items-center gap-1 text-[11px] font-semibold text-gray-500 tracking-wide mb-1">
            <Lightbulb class="w-3.5 h-3.5 text-gray-500" />
            <span>思考过程</span>
            <span class="text-gray-400">生成中 · {{ formatSecondsLabel(streamingElapsedSeconds) }}</span>
          </div>
          <div
            ref="streamingThoughtRef"
            class="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto pr-1"
          >
            {{ streamingThought }}
          </div>
        </div>
      </div>

      <!-- 流式输出临时消息 -->
      <div v-if="streamingText" class="flex justify-start">
        <div class="bg-gray-100 text-gray-800 px-4 py-3 rounded-lg mr-auto max-w-xs lg:max-w-md">
          <div
            v-html="renderMarkdown(streamingText)"
            class="prose prose-sm max-w-none prose-headings:text-gray-800 prose-p:text-gray-800 prose-li:text-gray-800 prose-strong:text-gray-800"
          ></div>
        </div>
      </div>

      <!-- 生成中提示 -->
      <div v-if="isGenerating && !streamingText" class="flex justify-start">
        <div class="bg-gray-100 text-gray-800 px-4 py-2 rounded-lg mr-auto">
          <div class="flex items-center space-x-2">
            <div class="flex space-x-1">
              <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
              <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.1s"></div>
              <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
            </div>
            <span class="text-sm">{{ loadingMessage }}</span>
            <span v-if="elapsedTime && elapsedTime > 0" class="text-xs text-gray-500">({{ elapsedTime }}s)</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Input -->
    <div class="p-3 border-t border-gray-200 bg-white flex-shrink-0">
      <div class="max-w-4xl mx-auto relative">
        <input
          ref="fileInputRef"
          type="file"
          multiple
          accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
          class="hidden"
          @change="handleFileSelect"
        />

        <!-- 附件预览区域(支持拖拽排序) -->
        <div v-if="attachments.length > 0" class="mb-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm text-gray-600">已选择 {{ attachments.length }} 张图片</span>
            <button
              @click="clearAttachments"
              class="text-xs text-red-500 hover:text-red-600"
            >
              清空全部
            </button>
          </div>
          <div
            class="flex gap-2 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
            @dragover.prevent="handleDragOver"
            @drop.prevent="handleDrop"
          >
            <div
              v-for="(attachment, index) in attachments"
              :key="attachment.id"
              :draggable="true"
              @dragstart="handleDragStart(index, $event)"
              @dragend="handleDragEnd"
              class="flex-shrink-0 flex items-center gap-2 bg-white px-3 py-2 rounded-md border border-gray-200 min-w-0 cursor-move hover:shadow-md transition-shadow"
              :class="{ 'opacity-50': draggingIndex === index }"
            >
              <div class="flex items-center gap-2 min-w-0 flex-1">
                <div class="flex-shrink-0">
                  <svg class="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div class="min-w-0 flex-1">
                  <div class="text-xs font-medium text-gray-700 truncate max-w-24" :title="attachment.name">
                    {{ attachment.name }}
                  </div>
                  <div class="text-xs text-gray-500">
                    {{ (attachment.size / 1024).toFixed(1) }}KB
                  </div>
                </div>
              </div>
              <button
                @click="removeAttachment(index)"
                class="flex-shrink-0 w-4 h-4 text-gray-400 hover:text-red-500 transition-colors"
                title="移除图片"
              >
                <X class="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        <!-- 输入框(完全参考playground样式) -->
        <div
          class="relative border border-gray-300 rounded-2xl focus-within:outline-none focus-within:border-gray-300 overflow-hidden"
          style="height: 120px;"
        >
          <div class="absolute top-0 left-0 right-0" style="bottom: 48px;">
            <textarea
              ref="textareaRef"
              v-model="inputText"
              rows="1"
              class="w-full h-full px-3 pt-3 pb-1 border-0 outline-none resize-none text-base overflow-y-auto bg-transparent"
              :placeholder="placeholderText"
              :disabled="isGenerating || hasAwaitingSelection"
              @keydown="handleKeydown"
            ></textarea>
          </div>
          <div class="absolute bottom-0 left-0 right-0 h-12 flex items-center justify-between px-3 bg-transparent pointer-events-none">
            <!-- 左侧按钮组 -->
            <div class="flex items-center gap-1">
              <!-- 附件按钮 -->
              <button
                @click="triggerFileSelect"
                class="w-8 h-8 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors flex items-center justify-center pointer-events-auto"
                :disabled="isGenerating"
                title="上传图片(支持拖拽),单个文件最大4MB"
              >
                <div class="relative">
                  <Paperclip class="w-4 h-4" />
                  <span
                    v-if="attachments.length > 0"
                    class="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full w-3 h-3 flex items-center justify-center"
                    style="font-size: 9px;"
                  >
                    {{ attachments.length }}
                  </span>
                </div>
              </button>

              <!-- 翻译按钮 -->
              <div class="relative pointer-events-auto translate-menu-container">
                <button
                  @click="showTranslateMenu = !showTranslateMenu"
                  class="w-8 h-8 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  :disabled="!inputText.trim() || isGenerating || isTranslating"
                  title="翻译文本"
                >
                  <Languages class="w-4 h-4" :class="{ 'animate-pulse': isTranslating }" />
                </button>

                <!-- 翻译菜单 (使用Teleport移到body，避免被父容器裁剪) -->
                <Teleport to="body">
                  <div
                    v-if="showTranslateMenu"
                    :style="getMenuPosition()"
                    class="fixed bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50 min-w-[120px]"
                    @click.stop
                  >
                    <button
                      @click="translateText('en')"
                      class="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-2"
                      :disabled="isTranslating"
                    >
                      <span>🇬🇧</span>
                      <span>转英文</span>
                    </button>
                    <button
                      @click="translateText('zh')"
                      class="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-2"
                      :disabled="isTranslating"
                    >
                      <span>🇨🇳</span>
                      <span>转中文</span>
                    </button>
                  </div>
                </Teleport>
              </div>
            </div>

            <!-- 发送按钮 -->
            <button
              @click="sendMessage"
              :disabled="!inputText.trim() || isGenerating || isTranslating || hasAwaitingSelection"
              class="w-8 h-8 rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center pointer-events-auto"
              :title="hasAwaitingSelection ? '请先从候选图片中选择确认一张' : '发送消息'"
            >
              <ArrowUp class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 拖拽上传遮罩 -->
    <div
      v-if="isGlobalDragging"
      class="absolute inset-0 bg-blue-50 bg-opacity-90 flex items-center justify-center z-40 border-2 border-dashed border-blue-400 rounded-lg"
    >
      <div class="text-center">
        <Upload class="w-12 h-12 mx-auto mb-4 text-blue-500" />
        <div class="text-lg font-medium text-blue-700 mb-2">
          释放图片以上传
        </div>
        <div class="text-sm text-blue-600">
          支持 JPG, PNG, GIF, WebP 格式
        </div>
      </div>
    </div>

    <!-- 图片预览模态框 -->
    <Teleport to="body">
      <div
        v-if="imagePreview.show"
        class="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50"
        @click="closeImagePreview"
      >
        <div class="relative max-w-[90vw] max-h-[90vh]" @click.stop>
          <!-- 关闭按钮 -->
          <button
            @click="closeImagePreview"
            class="absolute -top-10 right-0 p-2 text-white hover:text-gray-300 transition-colors"
            title="关闭 (Esc)"
          >
            <X class="w-6 h-6" />
          </button>

          <!-- 图片 -->
          <img
            v-if="imagePreview.imageData && imagePreview.mimeType"
            :src="`data:${imagePreview.mimeType};base64,${imagePreview.imageData}`"
            alt="图片预览"
            class="max-w-full max-h-[90vh] object-contain rounded-lg"
          />
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, computed, onMounted, onUnmounted } from 'vue'
import { RefreshCw, ArrowUp, Paperclip, Upload, X, Sparkles, Send, Edit2, Trash2, Copy, Languages, FileText, Lightbulb, ChevronDown } from 'lucide-vue-next'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { useDrawingStore } from '@/stores/drawingStore'
import type { DrawingMessage } from '@/stores/drawingStore'
import { fileToBase64, getFileMimeType } from '@/services/geminiDrawingService'
import SystemPromptModal from '@/components/modules/optimize/components/SystemPromptModal.vue'

// Props
const props = defineProps<{
  streamingText?: string
  loadingMessage?: string
  elapsedTime?: number
}>()

const emit = defineEmits<{
  send: [text: string, images: Array<{ mimeType: string; data: string }>]
  clear: []  // 新增清空事件
  attachmentsChange: [attachments: Array<{ id: string; preview: string; name: string }>]  // 暴露附件变化
  regenerate: []  // 重新生成AI回复
}>()

const drawingStore = useDrawingStore()

// 配置 marked
marked.setOptions({
  breaks: true,
  gfm: true
})

// 引用
const chatContainer = ref<HTMLElement>()
const fileInputRef = ref<HTMLInputElement>()
const textareaRef = ref<HTMLTextAreaElement>()

// 状态
const inputText = ref('')
const MAX_IMAGE_COUNT = 14
const MAX_IMAGE_SIZE_BYTES = 7 * 1024 * 1024 // 7MB per Gemini spec
const MAX_REQUEST_SIZE_BYTES = 20 * 1024 * 1024 // total inline_data + prompt < 20MB

const attachments = ref<Array<{ id: string; name: string; size: number; file: File; preview: string; mimeType: string; data: string }>>([])
const isGlobalDragging = ref(false)
const draggingIndex = ref<number | null>(null)

const getAttachmentsSize = () => {
  return attachments.value.reduce((sum, att) => sum + att.size, 0)
}

const formatMB = (bytes: number) => (bytes / (1024 * 1024)).toFixed(2)

// 监听 attachments 变化，通知父组件
watch(attachments, (newAttachments) => {
  emit('attachmentsChange', newAttachments.map(att => ({
    id: att.id,
    preview: att.preview,
    name: att.name
  })))
}, { deep: true })

// 编辑状态管理
const editingMessages = ref<Map<string, { isEditing: boolean; editingText: string }>>(new Map())

// 翻译状态
const showTranslateMenu = ref(false)
const isTranslating = ref(false)
const showSystemPromptModal = ref(false)
const systemPromptDraft = ref('')

// 图片预览状态
const imagePreview = ref<{
  show: boolean
  imageData: string | null
  mimeType: string | null
}>({
  show: false,
  imageData: null,
  mimeType: null
})

// 检查是否有待选择确认的候选图片
const hasAwaitingSelection = computed(() => {
  return messages.value.some(msg => msg.isAwaitingSelection)
})

// 计算翻译菜单位置
const getMenuPosition = () => {
  const container = document.querySelector('.translate-menu-container')
  if (!container) return {}

  const rect = container.getBoundingClientRect()
  return {
    left: `${rect.left}px`,
    bottom: `${window.innerHeight - rect.top + 8}px`  // 在按钮上方8px
  }
}

// 计算属性
const messages = ref<DrawingMessage[]>([])
const isGenerating = ref(false)
const placeholderText = computed(() => {
  if (hasAwaitingSelection.value) {
    return '请先从上方候选图片中选择确认一张，再继续对话'
  }
  return 'Shift+Enter 换行'
})
const currentModel = computed(() => drawingStore.getCurrentModel())
const isTextModel = computed(() => !currentModel.value?.supportsImage)
const streamingThought = computed(() => drawingStore.streamingThought)
const showStreamingThoughtCard = computed(() => isTextModel.value && !!streamingThought.value.trim())
const hasSystemPrompt = computed(() => !!drawingStore.systemPrompt?.trim())
const thoughtCollapseState = ref<Map<string, boolean>>(new Map())
const streamingElapsedSeconds = computed(() => props.elapsedTime ?? 0)
const streamingThoughtRef = ref<HTMLElement | null>(null)

const formatSecondsLabel = (seconds: number) => {
  if (!seconds || seconds <= 0) return '<1s'
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  return `${(seconds / 60).toFixed(1)}min`
}

const formatThoughtDuration = (ms?: number) => {
  if (!ms || ms <= 0) return ''
  const seconds = ms / 1000
  return formatSecondsLabel(seconds)
}

const ensureThoughtState = (messageId: string) => {
  if (!thoughtCollapseState.value.has(messageId)) {
    thoughtCollapseState.value.set(messageId, false)
  }
}

const isThoughtExpanded = (messageId: string) => {
  ensureThoughtState(messageId)
  return thoughtCollapseState.value.get(messageId) === true
}

const toggleThoughtExpanded = (messageId: string) => {
  const current = isThoughtExpanded(messageId)
  thoughtCollapseState.value.set(messageId, !current)
}

watch(streamingThought, () => {
  nextTick(() => {
    const el = streamingThoughtRef.value
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  })
})

// 监听 store 的变化
watch(
  () => drawingStore.conversationHistory,
  (newHistory) => {
    messages.value = newHistory
    nextTick(() => scrollToBottom())
  },
  { deep: true, immediate: true }
)

watch(
  () => drawingStore.isGenerating,
  (newValue) => {
    isGenerating.value = newValue
    if (!newValue) {
      nextTick(() => scrollToBottom())
    }
  },
  { immediate: true }
)

// 监听流式文本变化,自动滚动
watch(
  () => props.streamingText,
  () => {
    nextTick(() => scrollToBottom())
  }
)

// 方法：渲染Markdown
const renderMarkdown = (text: string): string => {
  try {
    const html = marked.parse(text) as string
    return DOMPurify.sanitize(html)
  } catch (error) {
    console.error('Markdown渲染失败:', error)
    return text
  }
}

// 方法：滚动到底部
const scrollToBottom = () => {
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight
  }
}

// 方法：格式化时间
const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

// 方法：获取消息的编辑状态
const getMessageEditState = (messageId: string) => {
  return editingMessages.value.get(messageId) || { isEditing: false, editingText: '' }
}

// 方法：获取消息的纯文本内容
const getMessageText = (message: DrawingMessage): string => {
  const textParts = message.parts.filter(p => p.text).map(p => p.text)
  return textParts.join('\n')
}

// 方法：检查消息是否包含图片
const hasImageContent = (message: DrawingMessage): boolean => {
  return message.parts.some(p => p.inlineData)
}

// 方法：开始编辑消息
const startEdit = (message: DrawingMessage) => {
  const text = getMessageText(message)
  editingMessages.value.set(message.id, {
    isEditing: true,
    editingText: text
  })
}

// 方法：取消编辑
const cancelEdit = (messageId: string) => {
  editingMessages.value.delete(messageId)
}

// 方法：保存编辑并重新发送
const saveEditAndResend = (message: DrawingMessage) => {
  const editState = editingMessages.value.get(message.id)
  if (!editState) return

  const newText = editState.editingText.trim()
  if (!newText) {
    alert('消息内容不能为空')
    return
  }

  // 删除当前消息及其之后的所有消息
  const messageIndex = messages.value.findIndex(m => m.id === message.id)
  if (messageIndex !== -1) {
    // 删除从当前消息开始的所有后续消息
    const messagesToRemove = messages.value.slice(messageIndex)
    messagesToRemove.forEach(m => {
      drawingStore.deleteMessage(m.id)
    })
  }

  // 取消编辑状态
  cancelEdit(message.id)

  // 重新发送（使用原有的附件信息，如果有的话）
  const imageParts = message.parts.filter(p => p.inlineData)
  const images = imageParts.map(p => ({
    mimeType: p.inlineData!.mimeType,
    data: p.inlineData!.data
  }))

  emit('send', newText, images)
}

// 方法：更新编辑文本
const updateEditingText = (messageId: string, text: string) => {
  const editState = editingMessages.value.get(messageId)
  if (editState) {
    editState.editingText = text
  }
}

// 方法：删除消息
const deleteMessage = (message: DrawingMessage) => {
  if (confirm('确定要删除这条消息吗？')) {
    drawingStore.deleteMessage(message.id)
  }
}

// 方法：复制消息内容
const copyMessage = (message: DrawingMessage) => {
  const text = getMessageText(message)
  navigator.clipboard.writeText(text).then(() => {
    // 可以添加一个提示，但这里简化处理
    console.log('已复制到剪贴板')
  }).catch(err => {
    console.error('复制失败:', err)
    alert('复制失败')
  })
}

// 方法：选择候选图片
const selectCandidate = (messageId: string, candidateIndex: number) => {
  const message = messages.value.find(m => m.id === messageId)
  if (message && message.isAwaitingSelection) {
    message.selectedCandidateIndex = candidateIndex
  }
}

// 方法：确认候选图片选择
const confirmCandidateSelection = (messageId: string) => {
  const message = messages.value.find(m => m.id === messageId)
  if (!message || !message.imageCandidates || message.selectedCandidateIndex === undefined) {
    return
  }

  const selectedCandidate = message.imageCandidates[message.selectedCandidateIndex]
  if (!selectedCandidate || !selectedCandidate.imageData) {
    return
  }

  // 更新消息：将选中的图片移到 parts 中，移除候选列表
  message.parts = [
    ...message.parts.filter(p => !p.inlineData), // 保留文本部分
    {
      inlineData: {
        mimeType: selectedCandidate.mimeType!,
        data: selectedCandidate.imageData
      },
      thoughtSignature: selectedCandidate.thoughtSignature
    }
  ]

  // 保留所有候选图片到右侧图片列表
  const generationConfigSnapshot = JSON.parse(JSON.stringify(drawingStore.generationConfig))
  message.imageCandidates.forEach((candidate, idx) => {
    if (candidate.imageData && !candidate.error) {
      drawingStore.addGeneratedImage({
        id: `${messageId}-candidate-${idx}`,
        imageData: candidate.imageData,
        mimeType: candidate.mimeType!,
        prompt: candidate.prompt || candidate.text || '',  // 优先使用用户输入的提示词
        timestamp: Date.now(),
        generationConfig: generationConfigSnapshot,
        thoughtSummary: candidate.thoughtSummary,
        thoughtTokens: candidate.thoughtTokens,
        thoughtTrace: candidate.thoughtTrace ? candidate.thoughtTrace.map(item => ({ ...item })) : undefined,
        usageMetadata: candidate.usageMetadata ? JSON.parse(JSON.stringify(candidate.usageMetadata)) : undefined
      })
    }
  })

  // 清除候选状态
  message.imageCandidates = undefined
  message.selectedCandidateIndex = undefined
  message.isAwaitingSelection = false

  nextTick(() => scrollToBottom())
}

// 方法：打开图片预览
const openImagePreview = (imageData: string, mimeType: string) => {
  imagePreview.value = {
    show: true,
    imageData,
    mimeType
  }
}

// 方法：关闭图片预览
const closeImagePreview = () => {
  imagePreview.value = {
    show: false,
    imageData: null,
    mimeType: null
  }
}

// 监听 Esc 键关闭预览
const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && imagePreview.value.show) {
    closeImagePreview()
  }
}

// 组件挂载时添加键盘监听
onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})
onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})

// 方法：重新生成AI回复
const regenerateMessage = (message: DrawingMessage) => {
  const messageIndex = messages.value.findIndex(m => m.id === message.id)
  if (messageIndex === -1) return

  // 删除当前AI消息及其之后的所有消息
  const messagesToRemove = messages.value.slice(messageIndex)
  messagesToRemove.forEach(m => {
    drawingStore.deleteMessage(m.id)
  })

  // 触发重新生成（不需要重新添加用户消息，它已经在历史中了）
  // 使用特殊的 regenerate 事件，父组件会直接调用 API 而不添加新的用户消息
  emit('regenerate')
}

// 方法：重新发送用户消息
const resendUserMessage = (message: DrawingMessage) => {
  // 删除当前消息及其之后的所有消息
  const messageIndex = messages.value.findIndex(m => m.id === message.id)
  if (messageIndex !== -1) {
    const messagesToRemove = messages.value.slice(messageIndex)
    messagesToRemove.forEach(m => {
      drawingStore.deleteMessage(m.id)
    })
  }

  // 重新发送
  const textParts = message.parts.filter(p => p.text).map(p => p.text)
  const imageParts = message.parts.filter(p => p.inlineData)

  const text = textParts.join('\n')
  const images = imageParts.map(p => ({
    mimeType: p.inlineData!.mimeType,
    data: p.inlineData!.data
  }))

  emit('send', text, images)
}

const shouldShowThoughtSummary = (message: DrawingMessage) => {
  return isTextModel.value && !!message.thoughtSummary?.trim()
}

// 方法：翻译文本
const translateText = async (targetLanguage: 'en' | 'zh') => {
  const text = inputText.value.trim()
  if (!text) {
    alert('请先输入要翻译的文本')
    return
  }

  // 检查是否有可用的提供商和模型
  const provider = drawingStore.getCurrentProvider()
  const model = drawingStore.getCurrentModel()

  if (!provider || !provider.apiKey) {
    alert('请先在设置中配置 AI 提供商和 API Key')
    return
  }

  if (!model) {
    alert('请先选择一个模型')
    return
  }

  try {
    isTranslating.value = true
    showTranslateMenu.value = false

    // 构建翻译提示词
    const translatePrompt = targetLanguage === 'en'
      ? `请将以下文本翻译成英文，只返回翻译结果，不要有任何解释或额外内容：\n\n${text}`
      : `请将以下文本翻译成中文，只返回翻译结果，不要有任何解释或额外内容：\n\n${text}`

    // 创建临时对话历史用于翻译
    const translateHistory = [{
      id: `translate-${Date.now()}`,
      role: 'user' as const,
      parts: [{ text: translatePrompt }],
      timestamp: Date.now()
    }]

    // 使用 Gemini 服务进行翻译
    const { GeminiDrawingService } = await import('@/services/geminiDrawingService')
    const service = new GeminiDrawingService(provider.apiKey, provider.baseURL)

    // 使用非流式API获取翻译结果（静默模式，不输出日志）
    const response = await service.generateContent(
      model.id,
      translateHistory,
      {
        ...drawingStore.generationConfig,
        temperature: 0.3,  // 降低温度以获得更准确的翻译
        maxOutputTokens: 2048
      },
      false,  // 不需要图像生成
      undefined,  // 不需要中断信号
      true,  // 静默模式，不输出日志
      undefined
    )

    // 提取翻译结果
    if (response.candidates && response.candidates.length > 0) {
      const candidate = response.candidates[0]
      if (candidate.content && candidate.content.parts) {
        const translatedText = candidate.content.parts
          .filter(p => p.text)
          .map(p => p.text)
          .join('')
          .trim()

        if (translatedText) {
          inputText.value = translatedText
        } else {
          alert('翻译失败：未获得有效结果')
        }
      }
    }
  } catch (error: any) {
    console.error('翻译失败:', error)
    alert(`翻译失败: ${error.message || '未知错误'}`)
  } finally {
    isTranslating.value = false
  }
}

const openSystemPromptModal = () => {
  systemPromptDraft.value = drawingStore.systemPrompt || ''
  showSystemPromptModal.value = true
}

const handleSystemPromptSave = () => {
  drawingStore.setSystemPrompt(systemPromptDraft.value.trim())
  drawingStore.saveSettings()
  showSystemPromptModal.value = false
}

// 方法：触发文件选择
const triggerFileSelect = () => {
  fileInputRef.value?.click()
}

// 方法：处理文件选择
const handleFileSelect = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const files = target.files
  if (!files) return

  await processFiles(Array.from(files))
  target.value = ''
}

// 方法：处理文件(只支持图片)
const processFiles = async (files: File[]) => {
  let currentCount = attachments.value.length
  let currentSize = getAttachmentsSize()

  for (const file of files) {
    if (currentCount >= MAX_IMAGE_COUNT) {
      alert(`每个提示最多上传 ${MAX_IMAGE_COUNT} 张图片。请删除部分附件后重试。`)
      break
    }

    // 只支持图片
    if (!file.type.startsWith('image/')) {
      alert(`不支持的文件类型: ${file.name}。绘图模块只支持图片格式。`)
      continue
    }

    // 检查图片格式(只支持Gemini支持的格式)
    const supportedFormats = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    if (!supportedFormats.includes(file.type)) {
      alert(`不支持的图片格式: ${file.name}。仅支持 JPG, PNG, GIF, WebP。`)
      continue
    }

    // 检查大小(最大 7MB)
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      alert(`图片 ${file.name} 大小为 ${(file.size / (1024 * 1024)).toFixed(2)}MB，超过 ${MAX_IMAGE_SIZE_BYTES / (1024 * 1024)}MB 限制。`)
      continue
    }

    if (currentSize + file.size > MAX_REQUEST_SIZE_BYTES) {
      alert(`添加 ${file.name} 后，总上传大小将达到 ${formatMB(currentSize + file.size)}MB，超过 ${formatMB(MAX_REQUEST_SIZE_BYTES)}MB 限制。请删除部分附件或选择更小的图片。`)
      continue
    }

    // 创建预览
    const preview = URL.createObjectURL(file)
    const mimeType = getFileMimeType(file)
    const data = await fileToBase64(file)

    attachments.value.push({
      id: `${Date.now()}-${Math.random()}`,
      name: file.name,
      size: file.size,
      file,
      preview,
      mimeType,
      data
    })

    currentCount++
    currentSize += file.size
  }
}

// 方法：移除附件
const removeAttachment = (index: number) => {
  const attachment = attachments.value[index]
  URL.revokeObjectURL(attachment.preview)
  attachments.value.splice(index, 1)
}

// 方法：清空附件
const clearAttachments = () => {
  attachments.value.forEach(att => URL.revokeObjectURL(att.preview))
  attachments.value = []
}

// 方法：全局拖拽处理
const handleGlobalDragEnter = (event: DragEvent) => {
  event.preventDefault()

  // 如果正在拖拽附件排序，忽略全局拖拽事件
  if (draggingIndex.value !== null) {
    return
  }

  if (event.dataTransfer?.items) {
    for (let i = 0; i < event.dataTransfer.items.length; i++) {
      if (event.dataTransfer.items[i].kind === 'file') {
        isGlobalDragging.value = true
        break
      }
    }
  }
}

const handleGlobalDragOver = (event: DragEvent) => {
  event.preventDefault()

  // 如果正在拖拽附件排序，忽略全局拖拽事件
  if (draggingIndex.value !== null) {
    return
  }

  isGlobalDragging.value = true
}

const handleGlobalDragLeave = (event: DragEvent) => {
  event.preventDefault()
  const target = event.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const x = event.clientX
  const y = event.clientY

  if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
    isGlobalDragging.value = false
  }
}

const handleGlobalDrop = async (event: DragEvent) => {
  event.preventDefault()
  isGlobalDragging.value = false

  // 如果正在拖拽附件排序，忽略全局drop（避免重复上传）
  if (draggingIndex.value !== null) {
    return
  }

  const files = Array.from(event.dataTransfer?.files || [])
  if (files.length > 0) {
    await processFiles(files)
  }
}

// 方法：拖拽排序
const handleDragStart = (index: number, event: DragEvent) => {
  draggingIndex.value = index
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
  }
}

const handleDragEnd = () => {
  draggingIndex.value = null
}

const handleDragOver = (event: DragEvent) => {
  event.preventDefault()
  event.stopPropagation() // 阻止冒泡到全局
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
}

const handleDrop = (event: DragEvent) => {
  event.preventDefault()
  event.stopPropagation() // 阻止冒泡到全局

  if (draggingIndex.value === null) return

  const target = event.target as HTMLElement
  const dropTarget = target.closest('[draggable="true"]')
  if (!dropTarget) return

  const allItems = Array.from(dropTarget.parentElement?.children || [])
  const dropIndex = allItems.indexOf(dropTarget)

  if (dropIndex === -1 || dropIndex === draggingIndex.value) return

  // 重新排序
  const items = [...attachments.value]
  const [removed] = items.splice(draggingIndex.value, 1)
  items.splice(dropIndex, 0, removed)
  attachments.value = items

  draggingIndex.value = null
}

// 方法：发送消息
const sendMessage = async () => {
  if (isGenerating.value) return
  if (hasAwaitingSelection.value) return  // 如果有待选择的候选图片，不允许发送
  if (!inputText.value.trim()) return

  const text = inputText.value.trim()

  if (attachments.value.length > MAX_IMAGE_COUNT) {
    alert(`每个提示最多上传 ${MAX_IMAGE_COUNT} 张图片，请删除部分附件后再发送。`)
    return
  }

  const textBytes = text ? new TextEncoder().encode(text).length : 0
  const totalPayload = getAttachmentsSize() + textBytes
  if (totalPayload > MAX_REQUEST_SIZE_BYTES) {
    alert(`文本与图片合计约 ${formatMB(totalPayload)}MB，超过 ${formatMB(MAX_REQUEST_SIZE_BYTES)}MB 请求限制。请精简内容或减少附件。`)
    return
  }

  const images = attachments.value.map(att => ({
    mimeType: att.mimeType,
    data: att.data
  }))

  // 清空输入
  inputText.value = ''

  // 清空附件
  clearAttachments()

  // 发送事件
  emit('send', text, images)
}

// 方法：键盘事件
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    sendMessage()
  }
}

// 方法：关闭翻译菜单（点击外部时）
const closeTranslateMenu = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  if (!target.closest('.translate-menu-container')) {
    showTranslateMenu.value = false
  }
}

// 监听点击外部关闭翻译菜单
watch(showTranslateMenu, (newValue) => {
  if (newValue) {
    setTimeout(() => {
      document.addEventListener('click', closeTranslateMenu)
    }, 0)
  } else {
    document.removeEventListener('click', closeTranslateMenu)
  }
})

// 方法：清空对话
const handleClearChat = () => {
  // 如果正在生成中，立即中断并重置
  if (isGenerating.value) {
    emit('clear')  // 通知父组件中断请求
    drawingStore.isGenerating = false  // 立即停止生成状态
    drawingStore.clearConversation()
    drawingStore.clearImages()
    drawingStore.streamingThought = ''
    clearAttachments()
    inputText.value = ''
    return
  }

  // 如果没有对话，不需要操作
  if (messages.value.length === 0) return

  // 非生成状态，需要确认
  if (confirm('确定要重新开始吗？这将清空所有对话历史和生成的图片。')) {
    emit('clear')  // 通知父组件
    drawingStore.clearConversation()
    drawingStore.clearImages()
    drawingStore.streamingThought = ''
    clearAttachments()
    inputText.value = ''
  }
}
</script>

<style scoped>
/* 滚动条样式 */
.overflow-y-auto::-webkit-scrollbar {
  width: 8px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 4px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background: #555;
}

/* 附件预览滚动条 */
.overflow-x-auto::-webkit-scrollbar {
  height: 6px;
}

.overflow-x-auto::-webkit-scrollbar-track {
  background: #f1f1f1;
}

.overflow-x-auto::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 3px;
}

.scrollbar-thin::-webkit-scrollbar {
  height: 4px;
}

.scrollbar-thumb-gray-300::-webkit-scrollbar-thumb {
  background: #d1d5db;
}

.scrollbar-track-gray-100::-webkit-scrollbar-track {
  background: #f3f4f6;
}
</style>
