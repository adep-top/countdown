/**
 * 统一响应信封（逐行移植自 cf-backend src/lib/response.ts，输出 adep `__adepHttp` 信封）。
 *
 * 小程序后端用 Hono 返回 `{code, data, message}` + HTTP 状态；adep 云函数返回
 * `__adepHttp` 信封即可获得同样的 status/body 语义（ADR-0024 / CF-010，
 * 本地 dev 与平台网关同一套识别逻辑）。
 */
import type { AdepHttpEnvelope } from '@adep/types'

export const CODE = {
  OK: 0,
  NO_AUTH: 40001,
  BAD_PARAM: 40002,
  NOT_FOUND: 40003,
  LIMIT_EXCEEDED: 40004,
  SERVER_ERROR: 50000,
} as const

export type CodeValue = (typeof CODE)[keyof typeof CODE]

const HTTP_STATUS: Record<number, number> = {
  0: 200,
  40001: 401,
  40002: 400,
  40003: 404,
  40004: 409,
  50000: 500,
}

export interface ApiBody<T> {
  code: number
  data: T | null
  message: string
}

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' }

function envelope<T>(body: ApiBody<T>, status: number): AdepHttpEnvelope {
  return {
    __adepHttp: {
      status,
      headers: JSON_HEADERS,
      body,
    },
  }
}

export function ok<T>(data: T, message = 'ok'): AdepHttpEnvelope {
  return envelope({ code: CODE.OK, data, message }, 200)
}

export function fail(code: CodeValue, message: string): AdepHttpEnvelope {
  return envelope({ code, data: null, message }, HTTP_STATUS[code] ?? 400)
}
