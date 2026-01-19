<template>
  <div>
    <div class="mb-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-medium">AI服务提供商</h3>
        <button
          @click="$emit('show-add-provider-type')"
          class="flex items-center space-x-1 px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
        >
          <Plus class="w-4 h-4" />
          <span>添加提供商</span>
        </button>
      </div>

      <!-- API配置说明 -->
      <div class="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div class="text-sm text-blue-700 space-y-2">
          <div><strong>Gemini：</strong>API URL填写 <code class="bg-blue-100 px-1 rounded text-xs">https://generativelanguage.googleapis.com/v1beta</code></div>
          <div><strong>OpenAI 兼容：</strong>API URL填写 <code class="bg-blue-100 px-1 rounded text-xs">https://api.openai.com/v1</code> 或代理服务地址</div>
          <div class="text-xs text-blue-600 mt-2">Nano Banana Pro: gemini-3-pro-image-preview</div>
          <div class="text-xs text-blue-600 mt-2">Nano Banana: gemini-2.5-flash-image </div>
        </div>
      </div>

      <div v-if="providers.length === 0" class="text-center py-8 text-gray-500">
        <SettingsIcon class="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p>还没有配置任何AI提供商</p>
        <p class="text-sm">点击上方按钮添加您的第一个AI服务</p>
      </div>

      <div v-else class="space-y-4">
        <div
          v-for="provider in providers"
          :key="provider.id"
          class="border rounded-lg p-4"
        >
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center space-x-3">
              <h4 class="font-medium">{{ provider.name }}</h4>
              <CheckCircle v-if="provider.apiKey" class="w-4 h-4 text-green-600" title="已配置" />
            </div>
            <div class="flex items-center space-x-2">
              <button
                @click="$emit('edit-provider', provider)"
                class="text-blue-500 hover:text-blue-700"
                title="编辑提供商"
              >
                <SettingsIcon class="w-4 h-4" />
              </button>
              <button
                @click="$emit('delete-provider', provider.id)"
                class="text-red-500 hover:text-red-700"
                title="删除提供商"
              >
                <Trash2 class="w-4 h-4" />
              </button>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">API密钥</label>
              <form @submit.prevent>
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
                  v-model="provider.apiKey"
                  type="password"
                  name="api-key"
                  placeholder="输入API密钥"
                  autocomplete="new-password"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  @input="$emit('save')"
                />
              </form>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                API URL
                <span class="text-xs text-gray-500">(可选，留空使用默认)</span>
              </label>
              <input
                v-model="provider.baseURL"
                type="url"
                :placeholder="getDefaultBaseUrl(provider.type || 'google')"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                @input="$emit('save')"
              />
            </div>
          </div>

          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="text-sm font-medium text-gray-700">可用模型</label>
              <button
                @click="$emit('show-add-model', provider.id)"
                class="text-sm text-blue-500 hover:text-blue-700"
              >
                添加模型
              </button>
            </div>
            <div class="space-y-2 max-h-32 overflow-y-auto">
              <div
                v-for="model in provider.models"
                :key="model.id"
                class="flex items-center justify-between p-2 bg-gray-50 rounded"
              >
                <div class="flex items-center space-x-2">
                  <span class="text-sm font-medium">{{ model.name }}</span>
                  <span v-if="model.supportsImage" class="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                    支持图像
                  </span>
                  <span class="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                    {{ getApiTypeLabel(model.apiType) }}
                  </span>
                </div>

                <div class="flex items-center space-x-1">
                  <button
                    @click="$emit('edit-model', provider.id, model)"
                    class="text-blue-500 hover:text-blue-700"
                    title="编辑模型"
                  >
                    <SettingsIcon class="w-3 h-3" />
                  </button>
                  <button
                    @click="$emit('delete-model', provider.id, model.id)"
                    class="text-red-500 hover:text-red-700"
                    title="删除模型"
                  >
                    <X class="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Settings as SettingsIcon, Plus, CheckCircle, Trash2, X } from 'lucide-vue-next'
import type { DrawingProvider } from '@/stores/drawingStore'

defineProps<{
  providers: DrawingProvider[]
  getDefaultBaseUrl: (type: string) => string
}>()

defineEmits<{
  'show-add-provider-type': []
  'edit-provider': [provider: DrawingProvider]
  'delete-provider': [providerId: string]
  'show-add-model': [providerId: string]
  'edit-model': [providerId: string, model: any]
  'delete-model': [providerId: string, modelId: string]
  'save': []
}>()

const apiTypeLabels: Record<string, string> = {
  google: 'Google',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  custom: '自定义'
}

const getApiTypeLabel = (apiType?: string) => {
  if (!apiType) {
    return 'Google'
  }
  return apiTypeLabels[apiType] || apiType
}
</script>
