// vite.config.ts —— 项目根 vite 配置（CLI-014 全栈开发体验）。
// adep() 是 @adep/cli/vite 的云函数 vite 插件：dev 时内置 adep dev server 并按
// adep.config.ts 的 functions_prefix（默认 /api）把 /api/* 请求代理到云函数。
// adep() 只代理 /{prefix}/*，不参与 vite build。build 产物 → site/。
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import adep from '@adep/cli/vite'

export default defineConfig({
  plugins: [vue(), adep()],
  build: {
    outDir: 'site',
  },
})
