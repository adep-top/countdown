// web/src/main.ts —— 应用入口（登录即服务版）。
// 启动静默恢复 OIDC 会话：有会话则拉云端用户（预热缓存），未登录不发请求、
// 不阻塞渲染（数据层切 localStorage，见 events.ts）。
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { ensureLogin } from './lib/auth'

// 本地开发把 localhost 归一为 127.0.0.1：平台回环白名单只放行字面量 127.0.0.1
// （见 server/domains/auth/oauth/store.ts 的 LOOPBACK_CALLBACK_RE），且 OAuth 全程需
// 同源往返——PKCE state 存 sessionStorage、会话存 localStorage，都按 origin 隔离。
// 打开 localhost:5173 时直接整页跳到 127.0.0.1:5173，避免授权回调落到另一 origin
// 导致 sessionStorage 读不到 PENDING、会话丢失（登录后仍是未登录态）。
if (window.location.hostname === 'localhost') {
  const normalized = new URL(window.location.href)
  normalized.hostname = '127.0.0.1'
  window.location.replace(normalized.toString())
}

void ensureLogin().catch((err: unknown) => {
  console.warn('[app] 会话恢复失败，将在页面重试', err)
})

createApp(App).use(router).mount('#app')
