<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div class="bg-white rounded-lg max-w-md w-full p-6">
      <h3 class="text-lg font-semibold mb-4">选择提供商类型</h3>

      <div class="space-y-3">
        <!-- Gemini -->
        <button
          @click="$emit('select', 'google')"
          class="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-left"
        >
          <div class="font-medium text-gray-900">Gemini</div>
          <div class="text-sm text-gray-600 mt-1">
            支持图像生成的 Gemini 模型
          </div>
        </button>

        <!-- OpenAI Compatible -->
        <button
          @click="$emit('select', 'openai')"
          class="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-left"
        >
          <div class="font-medium text-gray-900">OpenAI 兼容</div>
          <div class="text-sm text-gray-600 mt-1">
            适用于 OpenAI 协议兼容的绘图服务
          </div>
        </button>

        <!-- 自定义 -->
        <button
          @click="$emit('select', 'custom')"
          class="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-left"
        >
          <div class="font-medium text-gray-900">自定义提供商</div>
          <div class="text-sm text-gray-600 mt-1">
            配置自定义 Gemini API 或兼容服务
          </div>
        </button>
      </div>

      <div class="mt-6 flex justify-end">
        <button
          @click="$emit('close')"
          class="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
        >
          取消
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineEmits<{
  'select': ['google' | 'openai' | 'custom']
  'close': []
}>()
</script>
