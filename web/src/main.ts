// web/src/main.ts —— 应用入口（移植自小程序 app.js：启动即静默登录）。
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { ensureLogin } from './lib/auth'

// 启动静默登录（等价小程序 app.js onLaunch 的 ensureLogin()），失败不阻塞渲染，
// 页面请求时会再次 ensureLogin / 自动重登。
void ensureLogin().catch((err: unknown) => {
  console.warn('[app] 自动登录失败，将在页面重试', err)
})

createApp(App).use(router).mount('#app')
