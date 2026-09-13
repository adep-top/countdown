/**
 * 统一请求封装（移植自小程序 utils/request.js）。
 *
 * 差异点：wx.request → fetch；BASE_URL=''（同源 /api/*）；token 来自 OIDC 会话
 * （登录即服务，见 oidc.ts——未登录返回 ''，不带头）；遇业务码 40001（token 失效）
 * → 清本地 token → 有 OIDC 会话则强制刷新后重试一次 → 仍失败抛 NEED_LOGIN。
 * 只返回业务 data（响应信封 {code, data, message} 的 data），失败抛 Error。
 */
import { BASE_URL } from './config'
import { getRequestToken, forceRefreshToken, hasSession } from './oidc'

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  data?: unknown
  retry?: boolean
  silent?: boolean
  header?: Record<string, string>
}

interface ApiBody<T> {
  code: number
  data: T | null
  message: string
}

export class RequestError extends Error {
  code: number
  status: number
  constructor(message: string, code: number, status: number) {
    super(message)
    this.name = 'RequestError'
    this.code = code
    this.status = status
  }
}

/** 特殊错误：token 失效且自动刷新失败，调用方应引导重新登录。 */
export const NEED_LOGIN = 'NEED_LOGIN'

async function doRequest<T>(path: string, options: RequestOptions): Promise<T> {
  const token = await getRequestToken()
  const url = BASE_URL + path
  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.header,
    },
    body: options.data === undefined ? undefined : JSON.stringify(options.data),
  })

  let body: ApiBody<T>
  try {
    body = (await response.json()) as ApiBody<T>
  } catch {
    throw new RequestError(`请求失败(${response.status})`, -1, response.status)
  }

  if (response.status === 200 && body.code === 0) {
    return body.data as T
  }

  if (body.code === 40001) {
    if (options.retry !== false && hasSession()) {
      // 登录即服务：token 失效 → 强制刷新一次后重试（refresh 轮换一次性，失败会清会话）。
      const fresh = await forceRefreshToken()
      if (fresh !== null) {
        return doRequest(path, { ...options, retry: false })
      }
    }
    throw new RequestError(NEED_LOGIN, 40001, 401)
  }

  const msg = body.message || `请求失败(${response.status})`
  if (!options.silent) console.warn('[request]', path, msg)
  throw new RequestError(msg, body.code, response.status)
}

export function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return doRequest<T>(path, options).catch((error: unknown) => {
    // 网络异常 → 与小程序一致的提示
    if (error instanceof TypeError) {
      const e = new RequestError('网络异常，请检查网络后重试', -1, 0)
      throw e
    }
    throw error
  })
}
