<script setup lang="ts">
// OIDC 授权回调（/oauth/callback）：平台授权后整页跳回本页（带 code + state）。
// 换 token → 持久化会话 → 把 localStorage 数据并入云端 → 回用户信息页。
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { handleOidcCallback } from '../lib/oidc'
import { syncLocalEvents } from '../lib/events'
import { showToast } from '../ui/ui'

const route = useRoute()
const router = useRouter()

onMounted(() => {
  void (async () => {
    const code = typeof route.query.code === 'string' ? route.query.code : ''
    const state = typeof route.query.state === 'string' ? route.query.state : ''
    try {
      if (!code || !state) throw new Error('回调缺少 code/state')
      const session = await handleOidcCallback(code, state)
      if (session === null) throw new Error('回调校验失败（state 不匹配或授权已过期）')
      // 登录成功：把 localStorage 数据并入云端（去重），成功即清空本地。
      const n = await syncLocalEvents()
      if (n > 0) showToast({ title: `已同步 ${n} 条本地数据`, icon: 'success' })
    } catch (err) {
      showToast({ title: err instanceof Error ? err.message : '登录失败', icon: 'none' })
    }
    router.replace('/profile')
  })()
})
</script>

<template>
  <div class="page">
    <div class="loading">登录中…</div>
  </div>
</template>

<style scoped>
.page {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.loading {
  font-size: 0.3rem;
  color: #9aa3b2;
}
</style>
