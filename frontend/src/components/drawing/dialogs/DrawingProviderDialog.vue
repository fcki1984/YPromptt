<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div class="bg-white rounded-lg max-w-md w-full p-6">
      <h3 class="text-lg font-semibold mb-4">
        {{ editing ? '编辑提供商' : '添加提供商' }}
      </h3>

      <form @submit.prevent="$emit('save')">
        <div class="space-y-4">
          <!-- 提供商名称 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              提供商名称
            </label>
            <input
              :value="name"
              @input="$emit('update:name', ($event.target as HTMLInputElement).value)"
              type="text"
              placeholder="例如: Gemini"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <!-- API URL -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              API URL
              <span class="text-xs text-gray-500">(可选，留空使用默认)</span>
            </label>
            <input
              :value="baseUrl"
              @input="$emit('update:baseUrl', ($event.target as HTMLInputElement).value)"
              type="url"
              :placeholder="getDefaultBaseUrl(providerType)"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p class="mt-1 text-xs text-gray-500">
              默认: {{ getDefaultBaseUrl(providerType) }}
            </p>
          </div>

          <!-- API Key -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              API 密钥
            </label>
            <!-- 隐藏的用户名字段，用于消除浏览器密码表单警告 -->
            <input
              type="text"
              name="username"
              autocomplete="username"
              style="display: none;"
              aria-hidden="true"
              tabindex="-1"
            />
            <input
              :value="apiKey"
              @input="$emit('update:apiKey', ($event.target as HTMLInputElement).value)"
              type="password"
              name="api-key"
              placeholder="输入你的 API 密钥"
              autocomplete="new-password"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </form>

      <div class="mt-6 flex justify-end space-x-3">
        <button
          @click="$emit('close')"
          class="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
        >
          取消
        </button>
        <button
          @click="$emit('save')"
          class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          {{ editing ? '保存' : '添加' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  editing: boolean
  providerType: 'google' | 'openai' | 'custom'
  name: string
  baseUrl: string
  apiKey: string
  getDefaultBaseUrl: (type: string) => string
}>()

defineEmits<{
  'update:name': [value: string]
  'update:baseUrl': [value: string]
  'update:apiKey': [value: string]
  'save': []
  'close': []
}>()
</script>
