/**
 * 路径归一化：平台网关 / CLI dev 传给函数的 ctx.path 是完整 pathname（含
 * functions_prefix /api，见 AGENTS.md v1.57 边界说明）。这里剥掉前缀，函数内
 * 一律按「前缀后路径」匹配（/events、/auth/login 等）。
 */
export function routePath(ctxPath: string): string {
  if (ctxPath === '/api') return '/'
  if (ctxPath.startsWith('/api/')) return ctxPath.slice(4)
  return ctxPath
}
