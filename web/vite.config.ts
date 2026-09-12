// web/vite.config.ts —— 倒数日应用前端（Vue 3 + Vite）。
//
// 本地开发（npm run dev，在 apps/countdown 根执行）：
//   - root 固定为本目录（web/），前端源码从 web/src 加载；
//   - command === 'serve' 时动态加载 @adep/cli/vite：让 vite 在进程内启动 `adep dev`
//     （模拟运行时，cwd = 应用根 apps/countdown，读取 adep.config.ts 与 functions/），
//     并把 /api/* 代理到它——一条命令同时调试前端 + 云函数（函数改动热重载）。
//
// 平台构建（adep publish --only frontend 的服务端 vite build）：
//   - 平台把 web/ 草稿写入临时目录后执行 bun install + vite build，command === 'build'，
//     本配置**不会**加载 @adep/cli/vite（不解析、不安装其运行，平台无需发布版 cli 的
//     ./vite 子路径），保证发布产物可独立构建；devDependencies 里的 @adep/cli 仅本地用。
import { defineConfig, type Plugin } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'

export default defineConfig(async ({ command }) => {
  const plugins: Plugin[] = [vue()]

  if (command === 'serve') {
    // 本地开发：进程内 adep dev + /api 代理（动态 import，构建期不解析该模块）。
    const adep = (await import('@adep/cli/vite')).default
    plugins.push(adep({ cwd: fileURLToPath(new URL('..', import.meta.url)) }) as unknown as Plugin)
  }

  return {
    root: fileURLToPath(new URL('.', import.meta.url)),
    plugins,
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
    server: {
      port: 5173,
      host: '127.0.0.1',
    },
  }
})
