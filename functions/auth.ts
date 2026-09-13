/**
 * 云函数：auth —— 登录 / 当前用户（移植自 cf-backend src/routes/auth.ts）。
 *
 * 路由（归一化后，前缀 /api 由 _shared/route.ts 剥除）：
 *   POST /auth/login  { deviceId }       → 取/建用户，返回 { token, expires_in, user }
 *   GET  /auth/me                        → 当前用户 + 事件计数
 *
 * 鉴权双来源（登录即服务，见 _shared/auth.ts）：OIDC 身份（`Authorization: Bearer`
 * OAuth token，网关解析成 ctx.user）优先；未命中回退 device_id 凭据。`/auth/me` 的
 * `auth_mode` 字段据此区分：'oidc' = 平台三方登录 / 'device' = 本地设备身份。
 */
import type { FunctionContext } from '@adep/types'
import { ok, fail, CODE } from './_shared/response'
import {
  findUserByDeviceId,
  findUserById,
  createUser,
  countEvents,
  type NewUserRow,
} from './_shared/store'
import { requireUser, isEnvelope } from './_shared/auth'
import { routePath } from './_shared/route'
import { nowIso } from './_shared/date'

interface UserDTO {
  id: string
  nickname: string
  avatar_url: string
  created_at: string
}

function toUserDTO(row: {
  id: string
  nickname: string | null
  avatar_url: string | null
  created_at: string | null
}): UserDTO {
  return {
    id: row.id,
    nickname: row.nickname ?? '本地用户',
    avatar_url: row.avatar_url ?? '',
    created_at: row.created_at ?? '',
  }
}

export default async function handle(ctx: FunctionContext) {
  const db = ctx.cloud.db
  if (!db) return fail(CODE.SERVER_ERROR, '数据库未就绪，请先执行 adep db start 并建表')

  const path = routePath(ctx.path)
  const method = String(ctx.method ?? 'GET').toUpperCase()

  // POST /auth/login —— 设备身份换登录态（等价 wx.login → code2Session）
  if (path === '/auth/login' && method === 'POST') {
    const body = (ctx.body ?? {}) as Record<string, unknown>
    const deviceId = typeof body.deviceId === 'string' ? body.deviceId.trim() : ''
    if (!deviceId || deviceId.length < 8 || deviceId.length > 128) {
      return fail(CODE.BAD_PARAM, 'deviceId 参数不合法')
    }

    try {
      let user = await findUserByDeviceId(db, deviceId)
      if (!user) {
        const fresh: NewUserRow = {
          id: crypto.randomUUID(),
          device_id: deviceId,
          nickname: '本地用户',
          avatar_url: '',
          created_at: nowIso(),
          updated_at: nowIso(),
        }
        await createUser(db, fresh)
        user = fresh
      }
      return ok({
        token: deviceId, // 设备身份即 Bearer 凭据（等价 API Key；前端持久化于 localStorage）
        expires_in: 7 * 24 * 3600,
        user: toUserDTO(user),
      })
    } catch (err) {
      console.error('[auth/login]', err)
      return fail(CODE.SERVER_ERROR, '登录失败，请稍后重试')
    }
  }

  // GET /auth/me —— 当前用户 + 事件计数
  if (path === '/auth/me' && method === 'GET') {
    const authed = await requireUser(db, ctx)
    if (isEnvelope(authed)) return authed
    const { user } = authed
    const eventCount = await countEvents(db, user.id)
    const fresh = (await findUserById(db, user.id)) ?? user
    return ok({
      user: toUserDTO(fresh),
      event_count: eventCount,
      max_events: 200,
      // 登录即服务：'oidc' = 平台三方登录（网关解析 Bearer → ctx.user）；'device' = 本地设备身份。
      auth_mode: ctx.user !== null ? 'oidc' : 'device',
    })
  }

  return fail(CODE.NOT_FOUND, '接口不存在')
}
