// web/src/main.ts —— 应用入口（登录即服务版）。
// 启动静默恢复 OIDC 会话：有会话则拉云端用户（预热缓存），未登录不发请求、
// 不阻塞渲染（数据层切 localStorage，见 events.ts）。
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { ensureLogin } from './lib/auth'

void ensureLogin().catch((err: unknown) => {
  console.warn('[app] 会话恢复失败，将在页面重试', err)
})

createApp(App).use(router).mount('#app')
