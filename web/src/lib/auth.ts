/**
 * 登录状态管理（登录即服务版）。
 *
 * 原「设备身份 device_id 自动登录」迁移为「adep 平台三方登录（OIDC）」：
 * - 未登录：数据存 localStorage（见 events.ts），用户信息页显示 [登录以同步数据]；
 * - 已登录：会话由 oidc.ts 持久化，ensureLogin() 恢复会话并拉云端用户（/auth/me）。
 * 不再有静默设备登录；token 全权归 OIDC 会话（oidc.ts），request.ts 请求时自取。
 */
import { request } from './request'
import { hasSession } from './oidc'
import * as oidc from './oidc'

const USER_KEY = 'countdown_user'

export interface AppUser {
  id: string
  nickname: string
  avatar_url: string
  created_at: string
}

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

/** 是否处于 OIDC 登录态（有持久化会话）。 */
export function isLoggedIn(): boolean {
  return hasSession()
}

/**
 * 恢复登录：有 OIDC 会话 → 拉取云端用户并缓存；未登录返回 null（不强制登录）。
 * 供页面/启动调用；token 有效性由 request 层刷新兜底。
 */
export async function ensureLogin(): Promise<AppUser | null> {
  if (!isLoggedIn()) return null
  try {
    const data = await request<{ user: AppUser }>('/api/auth/me', { retry: false })
    saveUser(data.user)
    return data.user
  } catch {
    return null
  }
}

/** 清理本地用户缓存（OIDC 会话不动）。 */
export function clearSession(): void {
  localStorage.removeItem(USER_KEY)
}

/** 退出登录：清 OIDC 会话 + 本地用户缓存。 */
export function logout(): void {
  clearSession()
  void oidc.logout()
}
