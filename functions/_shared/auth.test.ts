/**
 * 请求鉴权单元测试：OIDC 身份（ctx.user → `oidc:<平台用户 id>` 映射）与
 * device_id 双来源（登录即服务，见 _shared/auth.ts）。
 * 运行：npm run test
 */
import { describe, it, expect } from 'vitest'
import type { CloudDb, FunctionContext } from '@adep/types'
import {
  parseBearer,
  requireUser,
  isEnvelope,
  OIDC_DEVICE_PREFIX,
  deviceIdOfOidcUser,
} from './auth'
import { findUserByDeviceId } from './store'
import type { UserRow } from './store'
import type { AdepHttpEnvelopeLike } from './auth'

/** 内存 CloudDb 桩：只实现 store.ts / requireUser 用到的操作（users 表 where+first/insert）。 */
function makeMemoryDb(seed: UserRow[] = []): { db: CloudDb; users: UserRow[] } {
  const users: UserRow[] = [...seed]
  const db = {
    table(name: string) {
      let filters: Array<[string, unknown]> = []
      const chain = {
        select(): unknown {
          return chain
        },
        owned(): unknown {
          return chain
        },
        where(col: string, value: unknown): unknown {
          filters = [...filters, [col, value]]
          return chain
        },
        async first(): Promise<Record<string, unknown> | null> {
          const hit = users.find((u) => filters.every(([col, v]) => (u as unknown as Record<string, unknown>)[col] === v))
          return hit === undefined ? null : { ...hit }
        },
        async insert(row: Record<string, unknown>): Promise<void> {
          users.push(row as unknown as UserRow)
        },
      }
      void name
      return chain
    },
  } as unknown as CloudDb
  return { db, users }
}

/** 组装最小 FunctionContext（cloud 带 db，其余字段按缺省）。 */
function ctxOf(db: CloudDb, overrides: Partial<FunctionContext> = {}): FunctionContext {
  return {
    method: 'GET',
    path: '/auth/me',
    query: {},
    headers: {},
    body: undefined,
    files: [],
    cloud: { db } as FunctionContext['cloud'],
    user: null,
    ...overrides,
  }
}

function envelopeBody(r: { user: UserRow } | AdepHttpEnvelopeLike): {
  status: number
  body?: unknown
} {
  if (isEnvelope(r)) return (r as AdepHttpEnvelopeLike).__adepHttp
  throw new Error('expected envelope')
}

describe('deviceIdOfOidcUser', () => {
  it('以 `oidc:` 前缀 + 平台用户 id 组成本地 device_id', () => {
    expect(deviceIdOfOidcUser({ id: 'plat-123' })).toBe(`${OIDC_DEVICE_PREFIX}plat-123`)
  })
})

describe('requireUser · OIDC 身份（ctx.user）', () => {
  it('首次访问自动建行（映射到 oidc:<平台用户 id>，昵称取 ctx.user.name）', async () => {
    const { db, users } = makeMemoryDb()
    const ctx = ctxOf(db, { user: { id: 'plat-1', name: '小明', email: 'm@x.com' } })

    const r = await requireUser(db, ctx)
    expect(isEnvelope(r)).toBe(false)
    if (isEnvelope(r)) return
    expect(r.user.device_id).toBe('oidc:plat-1')
    expect(r.user.nickname).toBe('小明')
    expect(users).toHaveLength(1)

    // 已建行：再次访问复用同一行，不重复建
    const again = await requireUser(db, ctx)
    expect(isEnvelope(again)).toBe(false)
    if (isEnvelope(again)) return
    expect(again.user.id).toBe(r.user.id)
    expect(users).toHaveLength(1)
  })

  it('缺 name 时昵称回退「平台用户」', async () => {
    const { db, users } = makeMemoryDb()
    const r = await requireUser(db, ctxOf(db, { user: { id: 'plat-2' } }))
    expect(isEnvelope(r)).toBe(false)
    if (isEnvelope(r)) return
    expect(r.user.nickname).toBe('平台用户')
    expect(users).toHaveLength(1)
  })

  it('已存在的 OIDC 映射行直接命中（不查 device Bearer）', async () => {
    const existing: UserRow = {
      id: 'local-9',
      device_id: 'oidc:plat-9',
      nickname: '老用户',
      avatar_url: '',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    }
    const { db, users } = makeMemoryDb([existing])
    const r = await requireUser(db, ctxOf(db, { user: { id: 'plat-9' } }))
    expect(isEnvelope(r)).toBe(false)
    if (isEnvelope(r)) return
    expect(r.user.id).toBe('local-9')
    expect(users).toHaveLength(1)
  })
})

describe('requireUser · 设备身份（Bearer device_id）', () => {
  it('合法 device_id 命中用户', async () => {
    const row: UserRow = {
      id: 'local-1',
      device_id: 'dev-abc-123',
      nickname: '本地用户',
      avatar_url: '',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    }
    const { db } = makeMemoryDb([row])
    const ctx = ctxOf(db, {
      headers: { authorization: 'Bearer dev-abc-123' },
      user: null,
    })
    const r = await requireUser(db, ctx)
    expect(isEnvelope(r)).toBe(false)
    if (isEnvelope(r)) return
    expect(r.user.id).toBe('local-1')
  })

  it('无凭据 → 40001 信封', async () => {
    const { db } = makeMemoryDb()
    const r = await requireUser(db, ctxOf(db))
    expect(isEnvelope(r)).toBe(true)
    const e = envelopeBody(r)
    expect(e.status).toBe(401)
  })

  it('token 查无用户 → 40001 信封', async () => {
    const { db } = makeMemoryDb()
    const r = await requireUser(db, ctxOf(db, { headers: { authorization: 'Bearer ghost' } }))
    expect(isEnvelope(r)).toBe(true)
    const e = envelopeBody(r)
    expect(e.status).toBe(401)
  })
})

describe('parseBearer', () => {
  it('大小写 / 多余空格容错', () => {
    const mk = () => makeMemoryDb().db
    expect(parseBearer(ctxOf(mk(), { headers: { authorization: 'Bearer abc' } }))).toBe('abc')
    expect(parseBearer(ctxOf(mk(), { headers: { Authorization: '  bearer   xyz ' } }))).toBe('xyz')
    expect(parseBearer(ctxOf(mk()))).toBe('')
  })
})

describe('store · OIDC 映射行可被查询', () => {
  it('findUserByDeviceId 能找到 oidc: 前缀行（函数层与数据层一致）', async () => {
    const { db, users } = makeMemoryDb()
    const ctx = ctxOf(db, { user: { id: 'plat-7', name: '测' } })
    const r = await requireUser(db, ctx)
    expect(isEnvelope(r)).toBe(false)
    if (isEnvelope(r)) return
    const found = await findUserByDeviceId(db, r.user.device_id)
    expect(found?.id).toBe(r.user.id)
    expect(users.some((u) => u.device_id.startsWith('oidc:'))).toBe(true)
  })
})
