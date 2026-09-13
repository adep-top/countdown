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
 * 本地开发默认本机平台 dev（PORT=3000）；生产部署用 VITE_AUTH_ISSUER 指向平台
 * 部署域名（如 https://auth.adep.example.com/api，README「接入平台登录」）。
 */
export const AUTH_ISSUER = (import.meta.env.VITE_AUTH_ISSUER as string | undefined) ?? 'http://127.0.0.1:3000/api'

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
