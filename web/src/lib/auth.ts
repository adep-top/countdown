/**
 * 登录状态管理（移植自小程序 utils/auth.js）。
 *
 * 流程：ensureLogin() → 有 token 直接返回缓存 user；否则拿设备身份 device_id
 * POST /auth/login 换 token + user（等价小程序的 wx.login → code2Session）。
 * 并发只发一次登录请求（loginPromise 复用）。
 */
import { request } from './request'
import { getDeviceId, resetDeviceId } from './device'
import { getToken, setToken, clearToken, TOKEN_KEY } from './request'

const USER_KEY = 'countdown_user'

export interface AppUser {
  id: string
  nickname: string
  avatar_url: string
  created_at: string
}

export interface LoginResult {
  token: string
  expires_in: number
  user: AppUser
}

let loginPromise: Promise<AppUser> | null = null

export function getUser(): AppUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as AppUser) : null
  } catch {
    return null
  }
}

function saveUser(user: AppUser): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearSession(): void {
  clearToken()
  localStorage.removeItem(USER_KEY)
}

/** 登录：设备身份 → 云函数建/取用户 → 落 token + user。 */
export async function login(): Promise<AppUser> {
  const deviceId = getDeviceId()
  const data = await request<LoginResult>('/api/auth/login', {
    method: 'POST',
    data: { deviceId },
    retry: false,
  })
  setToken(data.token)
  saveUser(data.user)
  return data.user
}

/** 有 token 直接返回，否则登录；并发只发一次请求。 */
export function ensureLogin(): Promise<AppUser | null> {
  if (getToken()) return Promise.resolve(getUser())
  if (loginPromise) return loginPromise
  loginPromise = login().then(
    (user) => {
      loginPromise = null
      return user
    },
    (err: unknown) => {
      loginPromise = null
      throw err
    }
  )
  return loginPromise
}

/** 退出登录：清除本地登录态与事件缓存；下次打开自动用新身份重新登录（云端数据保留）。 */
export function logout(): void {
  clearSession()
  resetDeviceId()
}

export { getToken, TOKEN_KEY }
