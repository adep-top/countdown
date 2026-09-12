/**
 * 请求鉴权（移植自 cf-backend src/middleware/auth.ts + src/lib/jwt.ts 的语义）。
 *
 * 迁移点：微信 code2Session → openid → JWT 的身份链路，替换为 adep web 端
 * 「设备身份 device_id」作为 Bearer 凭据（前端持久化于 localStorage，见
 * web/src/lib/device.ts）。device_id 即用户表唯一键，等价 API Key：查得到 → 身份成立。
 *
 * 失败返回与小程序后端一致的业务码 40001（前端 request.ts 会据此静默重登）。
 */
import type { CloudDb, FunctionContext } from '@adep/types'
import { fail, CODE } from './response'
import { findUserByDeviceId, type UserRow } from './store'

/** 解析 Authorization: Bearer xxx（带前导大小写/多余空格容错） */
export function parseBearer(ctx: FunctionContext): string {
  const header = ctx.headers?.authorization ?? ctx.headers?.Authorization ?? ''
  const match = /^Bearer\s+(.+)$/i.exec(String(header).trim())
  return match?.[1]?.trim() ?? ''
}

/** 从请求头解析出用户；缺凭据/用户不存在 → 40001 响应信封。 */
export async function requireUser(
  db: CloudDb,
  ctx: FunctionContext
): Promise<{ user: UserRow } | AdepHttpEnvelopeLike> {
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
