// 应用级 vitest 配置：测试 functions/ 与 web/src 的纯逻辑。
// 运行：npm run test（应用根）
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['functions/**/*.test.ts', 'web/src/**/*.test.ts'],
  },
})
