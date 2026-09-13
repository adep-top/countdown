/**
 * 请求鉴权（移植自 cf-backend src/middleware/auth.ts + src/lib/jwt.ts 的语义）。
 *
 * 双身份来源（登录即服务，接线见 apps/countdown README「接入平台登录」）：
 *   1. OIDC 身份（优先）：网关把 `Authorization: Bearer <oauth token>` 解析成
 *      `ctx.user`（平台用户，见 server/wiring.ts resolveUser）。本地 users 表的
 *      device_id 复用为 `oidc:<平台用户 id>` 关联（零迁移，无需改表），首次访问自动建行。
 *   2. 设备身份（兼容旧客户端 / API 调用）：`POST /auth/login` 换取 device_id 作 Bearer
 *      凭据（web 前端已迁移 OIDC 登录，不再使用）。device_id 即用户表唯一键，等价 API
 *      Key：查得到 → 身份成立。
 *
 * 失败返回与小程序后端一致的业务码 40001（前端 request.ts 会据此静默重登）。
 */
import type { CloudDb, FunctionContext } from '@adep/types'
import { fail, CODE } from './response'
import { findUserByDeviceId, createUser, type NewUserRow, type UserRow } from './store'
import { nowIso } from './date'

/** OIDC 用户在本地 users 表 device_id 的存储前缀（`oidc:<平台用户 id>`）。 */
export const OIDC_DEVICE_PREFIX = 'oidc:'

/** 平台用户（ctx.user）→ 本地 device_id（零迁移复用唯一键）。 */
export function deviceIdOfOidcUser(user: { id: string }): string {
  return `${OIDC_DEVICE_PREFIX}${user.id}`
}

/** 解析 Authorization: Bearer xxx（带前导大小写/多余空格容错） */
export function parseBearer(ctx: FunctionContext): string {
  const header = ctx.headers?.authorization ?? ctx.headers?.Authorization ?? ''
  const match = /^Bearer\s+(.+)$/i.exec(String(header).trim())
  return match?.[1]?.trim() ?? ''
}

/**
 * 从请求解析出用户；缺凭据/用户不存在 → 40001 响应信封。
 *
 * 登录即服务：OIDC 身份（ctx.user）优先——网关已把 OAuth Bearer 解析成平台用户，
 * 本地行以 `oidc:<平台用户 id>` 关联，缺行即建（幂等；昵称仅建行时写入，不回写）；
 * 未命中再回退 device_id 凭据（web 端未登录的本地身份）。
 */
export async function requireUser(
  db: CloudDb,
  ctx: FunctionContext
): Promise<{ user: UserRow } | AdepHttpEnvelopeLike> {
  if (ctx.user !== null) {
    const deviceId = deviceIdOfOidcUser(ctx.user)
    let user = await findUserByDeviceId(db, deviceId)
    if (user === null) {
      const fresh: NewUserRow = {
        id: crypto.randomUUID(),
        device_id: deviceId,
        nickname: ctx.user.name ?? '平台用户',
        avatar_url: '',
        created_at: nowIso(),
        updated_at: nowIso(),
      }
      await createUser(db, fresh)
      user = fresh
    }
    return { user }
  }

  const token = parseBearer(ctx)
  if (!token) return fail(CODE.NO_AUTH, '未登录')
  const user = await findUserByDeviceId(db, token)
  if (!user) return fail(CODE.NO_AUTH, '登录已失效，请重新登录')
  return { user }
}

/** 判断返回是否响应信封（用于 requireUser 收窄）。 */
export function isEnvelope<T>(value: T | AdepHttpEnvelopeLike): value is AdepHttpEnvelopeLike {
  return typeof value === 'object' && value !== null && '__adepHttp' in value
}

export interface AdepHttpEnvelopeLike {
  __adepHttp: { status: number; body?: unknown }
}
