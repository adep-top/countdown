/**
 * 全局配置（移植自小程序 utils/config.js）。
 *
 * BASE_URL 为 ''：与页面同源。本地开发由 @adep/cli/vite 代理 /api/* 到模拟运行时；
 * 部署后由平台网关把 /api/* 路由到云函数。云函数路径即 /api/{fn}（adep.config.ts
 * functions_prefix=/api），故请求统一写 '/api/...'。
 */
export const BASE_URL = ''

/**
 * 平台 OIDC 授权服务器 issuer（登录即服务）：三方登录走平台 /oauth/* 端点。
 *
 * 解析优先级：
 * 1. 构建期注入 `VITE_AUTH_ISSUER`（生产部署显式指定）；
 * 2. 浏览器运行时从应用子域推导：应用部署在 `<project>.<platform-domain>`，
 *    去掉第一级子域即得到平台域名，issuer = `${origin 平台部分}/api`；
 * 3. 本地开发默认 `http://127.0.0.1:3000/api`（vite dev 5173 端口 + 平台 dev 3000）。
 *
 * 平台构建前端时不注入 VITE_AUTH_ISSUER，故运行时推导是平台部署的主路径。
 */
function detectAuthIssuer(): string {
  const envIssuer = import.meta.env.VITE_AUTH_ISSUER as string | undefined
  if (envIssuer && envIssuer.length > 0) return envIssuer

  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname
    const parts = hostname.split('.')
    const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)
    // 应用子域形态：<project>.<platform-domain>，至少 3 段且不是 IP
    if (!isIp && parts.length >= 3) {
      const platformHost = parts.slice(1).join('.')
      const port = window.location.port ? `:${window.location.port}` : ''
      return `${window.location.protocol}//${platformHost}${port}/api`
    }
  }

  return 'http://127.0.0.1:3000/api'
}

export const AUTH_ISSUER = detectAuthIssuer()

export const MAX_EVENTS = 200

export const CATEGORIES = [
  { value: 'other', label: '日常' },
  { value: 'birthday', label: '生日' },
  { value: 'anniversary', label: '纪念日' },
  { value: 'exam', label: '考试' },
  { value: 'holiday', label: '节日' },
] as const

export type CategoryValue = (typeof CATEGORIES)[number]['value']

export const CATEGORY_LABEL: Record<string, string> = {
  other: '日常',
  birthday: '生日',
  anniversary: '纪念日',
  exam: '考试',
  holiday: '节日',
}

/** 云函数统一响应信封（移植自 cf-backend lib/response.ts）。 */
export interface ApiBody<T> {
  code: number
  data: T | null
  message: string
}

/** 业务错误码（与 cf-backend 一致）。 */
export const CODE = {
  OK: 0,
  NO_AUTH: 40001,
  BAD_PARAM: 40002,
  NOT_FOUND: 40003,
  LIMIT_EXCEEDED: 40004,
  SERVER_ERROR: 50000,
} as const
