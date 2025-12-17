<template>
  <div class="flex flex-col p-2 overflow-hidden xl:h-auto xl:overflow-visible xl:min-h-screen">
    <!-- 通知提示 -->
    <div
      v-if="showNotification"
      class="fixed top-4 right-4 z-50 bg-white border border-gray-200 rounded-lg shadow-lg px-4 py-3 flex items-center gap-2 animate-fade-in"
    >
      <span class="text-sm text-gray-900">{{ notificationMessage }}</span>
    </div>
    
    <!-- 统一顶栏（固定在顶部） -->
    <div class="bg-white rounded-lg shadow-sm p-4 xl:p-6 mb-4 flex-shrink-0 sticky top-2 z-10">
      <div class="flex items-center justify-between gap-2 xl:gap-4">
        <!-- 左侧：标题 -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 xl:gap-3">
            <h1 class="text-lg xl:text-2xl font-bold text-gray-900 truncate">{{ prompt?.title || '提示词详情' }}</h1>
            <span v-if="prompt" class="text-xs xl:text-sm text-gray-500 font-mono flex-shrink-0">v{{ prompt.current_version || '1.0.0' }}</span>
          </div>
          <p class="text-xs xl:text-sm text-gray-500 mt-1 line-clamp-1 xl:line-clamp-none">{{ prompt?.description || '查看和使用社区提示词' }}</p>
        </div>
        
        <!-- 右侧：操作按钮 -->
        <div v-if="prompt" class="flex items-center gap-1.5 xl:gap-2 flex-shrink-0">
          <!-- 移动端：只显示图标 -->
          <button
            @click="handleToggleLike"
            :disabled="!isLoggedIn"
            :class="prompt.is_liked 
              ? 'bg-red-50 text-red-600 hover:bg-red-100 border-red-200' 
              : 'bg-white text-gray-600 hover:bg-gray-50 border-gray-300'"
            class="flex items-center gap-2 px-3 py-2 xl:px-4 text-sm rounded-lg transition-colors border disabled:opacity-50 disabled:cursor-not-allowed"
            :title="prompt.is_liked ? '已点赞' : '点赞'"
          >
            <svg class="w-4 h-4" :fill="prompt.is_liked ? 'currentColor' : 'none'" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            <span class="hidden xl:inline">{{ prompt.is_liked ? '已点赞' : '点赞' }}</span>
          </button>
          
          <button
            @click="handleCopyPrompt"
            class="flex items-center gap-2 px-3 py-2 xl:px-4 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            title="复制"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <span class="hidden xl:inline">复制</span>
          </button>
          
          <button
            @click="handlePractice"
            class="flex items-center gap-2 px-3 py-2 xl:px-4 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            title="演练"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span class="hidden xl:inline">演练</span>
          </button>
        </div>
      </div>
    </div>
    
    <!-- 加载状态 -->
    <div v-if="isLoading" class="flex-1 bg-white rounded-lg shadow-sm flex items-center justify-center">
      <div class="flex items-center gap-2 text-gray-500">
        <div class="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <span>加载中...</span>
      </div>
    </div>
    
    <!-- 主内容区 -->
    <div v-else-if="prompt" class="flex flex-col xl:flex-row gap-4 overflow-y-auto xl:overflow-visible">
      <!-- 左侧主内容 -->
      <div class="flex-1 bg-white rounded-lg shadow-sm flex flex-col">
        <div class="p-4 xl:p-6 space-y-4 xl:space-y-6">
          <!-- 基本信息 -->
          <div>
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div class="flex items-center gap-2 xl:gap-3">
                <img 
                  v-if="prompt.author_avatar" 
                  :src="prompt.author_avatar" 
                  :alt="prompt.author_name"
                  class="w-9 h-9 xl:w-10 xl:h-10 rounded-full object-cover"
                />
                <div v-else class="w-9 h-9 xl:w-10 xl:h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-sm font-semibold">
                  {{ (prompt.author_name || '?')[0].toUpperCase() }}
                </div>
                <div>
                  <div class="text-sm xl:text-base font-medium text-gray-900">{{ prompt.author_name }}</div>
                  <div class="text-xs text-gray-500">{{ formatDate(prompt.create_time) }}</div>
                </div>
              </div>
              
              <span 
                :class="prompt.prompt_type === 'system' 
                  ? 'bg-purple-100 text-purple-700' 
                  : 'bg-blue-100 text-blue-700'"
                class="px-2.5 py-1 xl:px-3 text-xs xl:text-sm font-semibold rounded-full flex-shrink-0"
              >
                {{ prompt.prompt_type === 'system' ? '系统提示词' : '用户提示词' }}
              </span>
            </div>
            
            <!-- 统计和标签 -->
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 xl:gap-4 text-xs xl:text-sm text-gray-600 pb-3 xl:pb-4 border-b">
              <!-- 左侧：统计信息 -->
              <div class="flex items-center gap-3 xl:gap-4">
                <span class="flex items-center gap-1">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  {{ prompt.view_count }} 浏览
                </span>
                <span class="flex items-center gap-1">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  {{ prompt.like_count }} 点赞
                </span>
                <span class="flex items-center gap-1">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  {{ prompt.comment_count }} 评论
                </span>
              </div>
              
              <!-- 右侧：标签 -->
              <div v-if="prompt.tags" class="flex flex-wrap gap-1.5 xl:gap-2 sm:justify-end">
                <span 
                  v-for="tag in (prompt.tags || '').split(',').filter(Boolean)"
                  :key="tag"
                  class="px-2 py-0.5 xl:px-2.5 xl:py-1 text-xs bg-gray-100 text-gray-700 rounded-full"
                >
                  {{ tag }}
                </span>
              </div>
            </div>
          </div>
          
          <!-- 系统提示词（可折叠）-->
          <section v-if="prompt.system_prompt" class="mb-6">
            <button 
              @click="expandedSections.system = !expandedSections.system"
              class="w-full flex items-center gap-2 px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"
            >
              <svg 
                class="w-4 h-4 text-gray-500 transition-transform duration-200"
                :class="{ 'rotate-90': expandedSections.system }"
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
              
              <svg class="w-4 h-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              
              <span class="flex-1 text-left font-medium text-gray-900">系统提示词</span>
              
            </button>
            
            <div 
              v-show="expandedSections.system" 
              class="mt-2 p-4 bg-gray-50 rounded-lg border border-dashed border-gray-300"
            >
              <pre class="font-mono text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{{ prompt.system_prompt }}</pre>
              <button
                @click="copySystemPrompt"
                class="mt-3 text-xs text-gray-600 hover:text-gray-900 flex items-center gap-1 transition-colors"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                复制系统提示词
              </button>
            </div>
          </section>
          
          <!-- 对话历史（可折叠）-->
          <section v-if="conversationMessages.length > 0" class="mb-6">
            <button 
              @click="expandedSections.conversation = !expandedSections.conversation"
              class="w-full flex items-center gap-2 px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"
            >
              <svg 
                class="w-4 h-4 text-gray-500 transition-transform duration-200"
                :class="{ 'rotate-90': expandedSections.conversation }"
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
              
              <svg class="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              
              <span class="flex-1 text-left font-medium text-gray-900">对话上下文</span>
              
              <span class="text-xs text-gray-500 bg-blue-100 text-blue-700 px-2 py-1 rounded">
                {{ conversationMessages.length }} 条消息
              </span>
            </button>
            
            <div 
              v-show="expandedSections.conversation" 
              class="mt-2 p-4 bg-white rounded-lg border border-gray-200 space-y-3"
            >
              <!-- 对话气泡时间线 -->
              <div 
                v-for="(msg, idx) in conversationMessages" 
                :key="idx"
                class="flex gap-3"
                :class="{ 'flex-row-reverse': msg.role === 'user' }"
              >
                <!-- 头像 -->
                <div class="flex-shrink-0">
                  <div 
                    class="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                    :class="msg.role === 'user' ? 'bg-blue-500' : 'bg-purple-500'"
                  >
                    {{ msg.role === 'user' ? '👤' : '🤖' }}
                  </div>
                </div>
                
                <!-- 消息气泡 -->
                <div 
                  class="flex-1 max-w-[80%] p-3 rounded-lg"
                  :class="msg.role === 'user' 
                    ? 'bg-blue-50 border border-blue-200' 
                    : 'bg-gray-50 border border-gray-200'"
                >
                  <div class="text-sm text-gray-800 whitespace-pre-wrap">{{ msg.content }}</div>
                </div>
              </div>
            </div>
          </section>

          <!-- 提示词内容 -->
          <div>
            <div class="flex items-center justify-between mb-3">
              <h3 class="text-lg font-semibold text-gray-900">提示词内容</h3>
            </div>
            <pre class="max-h-64 xl:min-h-96 p-4 whitespace-pre-wrap font-mono text-sm text-gray-800 leading-relaxed overflow-auto bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg border border-gray-200">{{ prompt.final_prompt }}</pre>
          </div>
          
          <!-- 评论区 -->
          <div>
            <h3 class="text-base xl:text-lg font-semibold text-gray-900 mb-3 xl:mb-4">评论 ({{ comments.length }})</h3>
            
            <!-- 发表评论 -->
            <div v-if="isLoggedIn" class="mb-4">
              <!-- 回复提示 -->
              <div v-if="replyToComment" class="mb-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
                <span class="text-xs xl:text-sm text-blue-700">
                  回复 <span class="font-medium">@{{ replyToComment.user_name }}</span>
                </span>
                <button
                  @click="handleCancelReply"
                  class="text-blue-600 hover:text-blue-800 text-xs xl:text-sm"
                >
                  取消
                </button>
              </div>
              
              <textarea
                v-model="newComment"
                placeholder="写下你的评论..."
                class="w-full p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                rows="3"
              ></textarea>
              <div class="flex justify-end mt-2">
                <button
                  @click="handleSubmitComment"
                  :disabled="!newComment.trim()"
                  class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {{ replyToComment ? '发表回复' : '发表评论' }}
                </button>
              </div>
            </div>
            
            <div v-else class="mb-4 p-3 xl:p-4 bg-gray-50 rounded-lg text-center text-xs xl:text-sm text-gray-600 border border-gray-200">
              登录后可以发表评论
            </div>
            
            <!-- 评论列表 -->
            <div class="space-y-4 xl:space-y-6">
              <div v-if="comments.length === 0" class="text-center text-gray-500 py-6 xl:py-8 text-xs xl:text-sm">
                暂无评论，快来发表第一条评论吧！
              </div>
              
              <!-- 顶层评论 -->
              <div
                v-for="commentGroup in commentTree"
                :key="commentGroup.id"
                class="border-b border-gray-100 pb-4 xl:pb-6 last:border-0"
              >
                <!-- 主评论 -->
                <div class="flex gap-2 xl:gap-3">
                  <img 
                    v-if="commentGroup.user_avatar" 
                    :src="commentGroup.user_avatar" 
                    :alt="commentGroup.user_name"
                    class="w-8 h-8 xl:w-10 xl:h-10 rounded-full object-cover flex-shrink-0"
                  />
                  <div v-else class="w-8 h-8 xl:w-10 xl:h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-xs xl:text-sm font-semibold flex-shrink-0">
                    {{ (commentGroup.user_name || '?')[0].toUpperCase() }}
                  </div>
                  
                  <div class="flex-1 min-w-0">
                    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 gap-2">
                      <div class="flex items-center gap-2 flex-wrap">
                        <span class="text-sm xl:text-base font-semibold text-gray-900">{{ commentGroup.user_name }}</span>
                        <span class="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded">#{{ commentGroup.floor }}</span>
                        <span class="text-xs xl:text-sm text-gray-500">{{ formatDate(commentGroup.create_time) }}</span>
                        <span v-if="commentGroup.is_edited" class="text-xs text-gray-400">(已编辑)</span>
                      </div>
                      
                      <!-- 操作按钮 -->
                      <div class="flex items-center gap-2 xl:gap-3">
                        <button
                          v-if="isLoggedIn"
                          @click="handleReplyComment(commentGroup)"
                          class="text-xs xl:text-sm text-gray-500 hover:text-blue-600 flex items-center gap-1 transition-colors"
                        >
                          <svg class="w-3.5 h-3.5 xl:w-4 xl:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                          </svg>
                          回复
                        </button>
                        
                        <button
                          v-if="canDeleteComment(commentGroup)"
                          @click="handleDeleteComment(commentGroup.id)"
                          class="text-xs xl:text-sm text-gray-500 hover:text-red-600 flex items-center gap-1 transition-colors"
                        >
                          <svg class="w-3.5 h-3.5 xl:w-4 xl:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          删除
                        </button>
                      </div>
                    </div>
                    
                    <p class="text-gray-800 text-sm xl:text-base leading-relaxed mb-3">{{ commentGroup.content }}</p>
                    
                    <!-- 回复列表（递归渲染） -->
                    <div v-if="commentGroup.replies && commentGroup.replies.length > 0" class="mt-3 xl:mt-4 space-y-3 xl:space-y-4">
                      <div class="border-l-2 border-gray-200 pl-3 xl:pl-4 space-y-3 xl:space-y-4">
                        <CommentReplyItem
                          v-for="reply in commentGroup.replies"
                          :key="reply.id"
                          :comment="reply"
                          :depth="1"
                          @reply="handleReplyComment"
                          @delete="handleDeleteComment"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 右侧边栏（PC端固定位置，移动端放底部） -->
      <div class="w-full xl:w-80 flex-shrink-0 space-y-4 xl:self-start xl:sticky xl:top-2">
        <!-- 访问足迹 -->
        <div v-if="visitors.length > 0" class="bg-white rounded-lg shadow-sm p-4">
          <h3 class="text-sm font-semibold text-gray-900 mb-3">最近访问</h3>
          <div class="flex flex-wrap gap-2">
            <div
              v-for="visitor in visitors"
              :key="visitor.user_id"
              :title="`${visitor.user_name} - ${formatDate(visitor.visit_time)}`"
            >
              <img 
                v-if="visitor.user_avatar" 
                :src="visitor.user_avatar" 
                :alt="visitor.user_name"
                class="w-9 h-9 rounded-full object-cover border-2 border-white hover:border-blue-400 transition-colors cursor-pointer"
              />
              <div v-else class="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-xs font-semibold border-2 border-white hover:border-blue-400 transition-colors cursor-pointer">
                {{ (visitor.user_name || '?')[0].toUpperCase() }}
              </div>
            </div>
          </div>
        </div>
        
        <!-- 演练快照分享 -->
        <div v-if="playgroundShares.length > 0" class="bg-white rounded-lg shadow-sm p-4">
          <h3 class="text-sm font-semibold text-gray-900 mb-3">演练快照分享</h3>
          <div class="space-y-2">
            <div
              v-for="share in playgroundShares"
              :key="share.share_code"
              class="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-green-300 transition-all cursor-pointer group"
              @click="handleNavigateToShare(share.share_code)"
            >
              <h4 class="font-medium text-gray-900 text-sm mb-1.5 group-hover:text-green-600 line-clamp-2">
                {{ share.title || '未命名快照' }}
              </h4>
              <div class="flex items-center justify-between text-xs text-gray-500">
                <span>{{ share.creator_name }}</span>
                <span class="flex items-center gap-1">
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  {{ share.view_count }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- 作者其他作品 -->
        <div v-if="authorPrompts.length > 0" class="bg-white rounded-lg shadow-sm p-4">
          <h3 class="text-sm font-semibold text-gray-900 mb-3">他的更多分享</h3>
          <div class="space-y-2">
            <div
              v-for="item in authorPrompts"
              :key="item.id"
              class="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-blue-300 transition-all cursor-pointer group"
              @click="$router.push(`/community/prompts/${item.id}`)"
            >
              <h4 class="font-medium text-gray-900 text-sm mb-1.5 group-hover:text-blue-600 line-clamp-2">
                {{ item.title }}
              </h4>
              <p class="text-xs text-gray-600 line-clamp-2 mb-2">{{ item.description }}</p>
              <div class="flex items-center justify-between text-xs text-gray-500">
                <div class="flex items-center gap-3">
                  <span class="flex items-center gap-1">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    {{ item.view_count }}
                  </span>
                  <span class="flex items-center gap-1">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                    {{ item.like_count }}
                  </span>
                  <span class="flex items-center gap-1">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    {{ item.comment_count }}
                  </span>
                </div>
                <span class="font-mono text-gray-400">v{{ item.current_version || '1.0.0' }}</span>
              </div>
            </div>
          </div>
        </div>
        
      </div>
    </div>
    
    <!-- 错误状态 -->
    <div v-else class="flex-1 bg-white rounded-lg shadow-sm flex items-center justify-center">
      <div class="text-center">
        <svg class="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p class="text-gray-600 mb-4">提示词不存在或未公开</p>
        <button
          @click="$router.back()"
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          返回
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import CommentReplyItem from '@/components/CommentReplyItem.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

const prompt = ref<any>(null)
const comments = ref<any[]>([])
const authorPrompts = ref<any[]>([])
const visitors = ref<any[]>([])
const playgroundShares = ref<any[]>([])
const isLoading = ref(true)
const newComment = ref('')
const replyToComment = ref<any>(null)
const showNotification = ref(false)
const notificationMessage = ref('')

// 折叠区域状态
const expandedSections = ref({
  system: false,      // 系统提示词默认折叠
  conversation: false // 对话历史默认折叠
})

const isLoggedIn = computed(() => authStore.isLoggedIn)
const currentUserId = computed(() => authStore.user?.id)

// 获取提示词详情
const fetchPromptDetail = async () => {
  try {
    isLoading.value = true
    const promptId = route.params.id
    const token = localStorage.getItem('yprompt_token')
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    
    const response = await fetch(`${API_BASE_URL}/api/community/prompts/${promptId}`, {
      headers
    })
    
    const result = await response.json()
    
    if (result.code === 200) {
      prompt.value = result.data
      await Promise.all([
        fetchComments(),
        fetchAuthorPrompts(),
        fetchVisitors(),
        fetchPlaygroundShares()
      ])
    }
  } catch (error) {
    console.error('获取提示词详情失败:', error)
  } finally {
    isLoading.value = false
  }
}

// 获取评论
const fetchComments = async () => {
  try {
    const promptId = route.params.id
    const response = await fetch(`${API_BASE_URL}/api/community/prompts/${promptId}/comments`)
    const result = await response.json()
    
    if (result.code === 200) {
      comments.value = result.data.items
    }
  } catch (error) {
    console.error('获取评论失败:', error)
  }
}

// 构建楼中楼评论树（递归查找所有子评论）
const commentTree = computed(() => {
  // 筛选出顶层评论（没有parent_id的）
  const topLevelComments = comments.value.filter(c => !c.parent_id)
  
  // 递归函数：为评论查找所有回复
  const findReplies = (commentId: number): any[] => {
    const directReplies = comments.value.filter(c => c.parent_id === commentId)
    return directReplies.map(reply => ({
      ...reply,
      replies: findReplies(reply.id) // 递归查找子回复
    }))
  }
  
  // 为每个顶层评论构建回复树，并添加楼层号
  return topLevelComments.map((comment, index) => ({
    ...comment,
    floor: index + 1,
    replies: findReplies(comment.id)
  }))
})

// 获取作者其他作品
const fetchAuthorPrompts = async () => {
  try {
    const promptId = route.params.id
    const response = await fetch(`${API_BASE_URL}/api/community/prompts/${promptId}/author-prompts?limit=6`)
    const result = await response.json()
    
    if (result.code === 200) {
      authorPrompts.value = result.data
    }
  } catch (error) {
    console.error('获取作者其他作品失败:', error)
  }
}

// 获取最近访问者
const fetchVisitors = async () => {
  try {
    const promptId = route.params.id
    const response = await fetch(`${API_BASE_URL}/api/community/prompts/${promptId}/visitors?limit=12`)
    const result = await response.json()
    
    if (result.code === 200) {
      visitors.value = result.data
    }
  } catch (error) {
    console.error('获取访问者列表失败:', error)
  }
}

// 获取相关操练场快照
const fetchPlaygroundShares = async () => {
  try {
    const promptId = route.params.id
    const response = await fetch(`${API_BASE_URL}/api/community/prompts/${promptId}/playground-shares?limit=5`)
    const result = await response.json()
    
    if (result.code === 200) {
      playgroundShares.value = result.data
    }
  } catch (error) {
    console.error('获取操练场快照失败:', error)
  }
}

// 点赞/取消点赞
const handleToggleLike = async () => {
  try {
    const token = localStorage.getItem('yprompt_token')
    if (!token) return
    
    const response = await fetch(`${API_BASE_URL}/api/community/prompts/${prompt.value.id}/like`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    })
    
    const result = await response.json()
    
    if (result.code === 200) {
      prompt.value.is_liked = result.data.is_liked
      prompt.value.like_count = result.data.like_count
    }
  } catch (error) {
    console.error('点赞失败:', error)
  }
}

// 显示通知
const notify = (message: string) => {
  notificationMessage.value = message
  showNotification.value = true
  setTimeout(() => {
    showNotification.value = false
  }, 2000)
}

// 复制提示词
const handleCopyPrompt = async () => {
  try {
    await navigator.clipboard.writeText(prompt.value.final_prompt)
    notify('✅ 已复制到剪贴板')
  } catch (error) {
    console.error('复制失败:', error)
    notify('❌ 复制失败')
  }
}

// 一键演练
const handlePractice = () => {
  router.push({
    path: '/playground',
    query: { promptId: prompt.value.id }
  })
}

// 跳转到操练场快照分享页
const handleNavigateToShare = (shareCode: string) => {
  router.push(`/playground/share/${shareCode}`)
}

// 回复评论
const handleReplyComment = (comment: any) => {
  replyToComment.value = comment
  newComment.value = `@${comment.user_name} `
}

// 取消回复
const handleCancelReply = () => {
  replyToComment.value = null
  newComment.value = ''
}

// 发表评论
const handleSubmitComment = async () => {
  try {
    const token = localStorage.getItem('yprompt_token')
    if (!token) return
    
    const response = await fetch(`${API_BASE_URL}/api/community/prompts/${prompt.value.id}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ 
        content: newComment.value,
        parent_id: replyToComment.value?.id || null
      })
    })
    
    const result = await response.json()
    
    if (result.code === 200) {
      newComment.value = ''
      replyToComment.value = null
      prompt.value.comment_count++
      await fetchComments()
      notify('✅ 评论成功')
    }
  } catch (error) {
    console.error('发表评论失败:', error)
    notify('❌ 评论失败')
  }
}

// 删除评论
const handleDeleteComment = async (commentId: number) => {
  if (!confirm('确定要删除这条评论吗？')) return
  
  try {
    const token = localStorage.getItem('yprompt_token')
    if (!token) return
    
    const response = await fetch(`${API_BASE_URL}/api/community/comments/${commentId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    
    const result = await response.json()
    
    if (result.code === 200) {
      prompt.value.comment_count--
      await fetchComments()
    }
  } catch (error) {
    console.error('删除评论失败:', error)
  }
}

// 判断是否可以删除评论
const canDeleteComment = (comment: any) => {
  if (!isLoggedIn.value) return false
  return comment.user_id === currentUserId.value || 
         prompt.value.user_id === currentUserId.value ||
         authStore.user?.is_admin
}

// 提取对话消息
const conversationMessages = computed(() => {
  if (!prompt.value || !prompt.value.conversation_history) return []
  
  try {
    const messages = typeof prompt.value.conversation_history === 'string' 
      ? JSON.parse(prompt.value.conversation_history) 
      : prompt.value.conversation_history
    return Array.isArray(messages) ? messages : []
  } catch (error) {
    console.error('解析对话消息失败:', error)
    return []
  }
})

// 复制系统提示词
const copySystemPrompt = async () => {
  if (!prompt.value || !prompt.value.system_prompt) return
  try {
    await navigator.clipboard.writeText(prompt.value.system_prompt)
    notify('✅ 已复制系统提示词')
  } catch (error) {
    console.error('复制失败:', error)
    notify('❌ 复制失败')
  }
}

// 格式化日期（自动处理时区）
const formatDate = (dateStr: string) => {
  if (!dateStr) return ''
  
  // 如果后端返回的是UTC时间，需要转换为本地时间
  let date: Date
  if (dateStr.endsWith('Z') || dateStr.includes('+')) {
    // ISO格式，直接解析
    date = new Date(dateStr)
  } else {
    // 假设是UTC时间字符串，添加Z后缀
    date = new Date(dateStr + 'Z')
  }
  
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days < 30) return `${days}天前`
  
  return date.toLocaleDateString('zh-CN')
}

// 监听路由参数变化，重新加载数据
watch(() => route.params.id, (newId) => {
  if (newId) {
    fetchPromptDetail()
  }
})

onMounted(() => {
  fetchPromptDetail()
})
</script>

<style scoped>
@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in {
  animation: fade-in 0.3s ease-out;
}
</style>
