<template>
  <div class="flex gap-3">
    <!-- 头像 -->
    <img 
      v-if="comment.user_avatar" 
      :src="comment.user_avatar" 
      :alt="comment.user_name"
      :class="avatarSize"
      class="rounded-full object-cover flex-shrink-0"
    />
    <div 
      v-else 
      :class="avatarSize"
      class="rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center text-white font-semibold flex-shrink-0"
    >
      {{ (comment.user_name || '?')[0].toUpperCase() }}
    </div>
    
    <div class="flex-1 min-w-0">
      <!-- 用户信息和操作按钮 -->
      <div class="flex items-center justify-between gap-2 mb-1 flex-wrap">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="font-medium text-gray-900" :class="nameSize">{{ comment.user_name }}</span>
          <!-- 显示被回复的用户 -->
          <template v-if="comment.parent_user_name">
            <span class="text-gray-400">回复</span>
            <span class="text-blue-600 font-medium" :class="nameSize">@{{ comment.parent_user_name }}</span>
          </template>
          <span :class="timeSize" class="text-gray-500">{{ formatDate(comment.create_time) }}</span>
          <span v-if="comment.is_edited" class="text-xs text-gray-400">(已编辑)</span>
        </div>
        
        <!-- 操作按钮 -->
        <div class="flex items-center gap-2 flex-shrink-0">
          <button
            v-if="isLoggedIn"
            @click="$emit('reply', comment)"
            :class="buttonSize"
            class="text-gray-500 hover:text-blue-600 flex items-center gap-1 transition-colors"
          >
            <svg :class="iconSize" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
            回复
          </button>
          
          <button
            v-if="canDelete"
            @click="$emit('delete', comment.id)"
            :class="buttonSize"
            class="text-gray-500 hover:text-red-600 flex items-center gap-1 transition-colors"
          >
            <svg :class="iconSize" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            删除
          </button>
        </div>
      </div>
      
      <!-- 评论内容 -->
      <p class="text-gray-700 leading-relaxed" :class="contentSize">{{ comment.content }}</p>
      
      <!-- 递归渲染子回复 -->
      <div v-if="comment.replies && comment.replies.length > 0" class="mt-3 space-y-3">
        <div :class="borderClass">
          <CommentReplyItem
            v-for="reply in comment.replies"
            :key="reply.id"
            :comment="reply"
            :depth="depth + 1"
            @reply="$emit('reply', $event)"
            @delete="$emit('delete', $event)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from '@/stores/authStore'

interface Comment {
  id: number
  user_id: number
  user_name: string
  user_avatar?: string
  parent_user_name?: string
  content: string
  is_edited: boolean
  create_time: string
  replies?: Comment[]
}

const props = defineProps<{
  comment: Comment
  depth: number
}>()

defineEmits<{
  reply: [comment: Comment]
  delete: [commentId: number]
}>()

const authStore = useAuthStore()

const isLoggedIn = computed(() => authStore.isLoggedIn)
const canDelete = computed(() => {
  if (!isLoggedIn.value) return false
  return props.comment.user_id === authStore.user?.id || authStore.user?.is_admin
})

// 根据嵌套深度调整样式
const avatarSize = computed(() => {
  if (props.depth >= 3) return 'w-6 h-6 text-xs'
  if (props.depth === 2) return 'w-7 h-7 text-xs'
  return 'w-8 h-8 text-sm'
})

const nameSize = computed(() => {
  if (props.depth >= 3) return 'text-xs'
  if (props.depth === 2) return 'text-sm'
  return 'text-sm'
})

const timeSize = computed(() => {
  return props.depth >= 2 ? 'text-xs' : 'text-xs'
})

const contentSize = computed(() => {
  if (props.depth >= 3) return 'text-xs'
  if (props.depth === 2) return 'text-sm'
  return 'text-sm'
})

const buttonSize = computed(() => {
  return props.depth >= 2 ? 'text-xs' : 'text-xs'
})

const iconSize = computed(() => {
  return props.depth >= 2 ? 'w-3 h-3' : 'w-3.5 h-3.5'
})

const borderClass = computed(() => {
  // 最多显示3层缩进，超过则不再缩进
  if (props.depth >= 3) return 'space-y-3'
  return 'border-l-2 border-gray-200 pl-4 space-y-3'
})

// 格式化日期（自动处理时区）
const formatDate = (dateStr: string) => {
  if (!dateStr) return ''
  
  let date: Date
  if (dateStr.endsWith('Z') || dateStr.includes('+')) {
    date = new Date(dateStr)
  } else {
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
</script>
