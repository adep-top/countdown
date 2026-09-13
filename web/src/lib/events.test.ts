/**
 * countdown web 事件数据层单测（登录即服务）：已登录 → 云端 /api/events；
 * 未登录 → localStorage。覆盖列表 / 增删改 / 登录后同步（syncLocalEvents）。
 * 运行：apps/countdown 根下 `npm run test`（app 级 vitest 收集 web 的测试文件）。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { request } from './request'
import type { CountdownEvent } from './date'

// ---- mock 依赖：oidc（登录态开关）与 request（云端响应）----

const mocks = vi.hoisted(() => ({
  loggedIn: false as boolean,
}))

vi.mock('./oidc', () => ({
  hasSession: () => mocks.loggedIn,
  getRequestToken: async () => (mocks.loggedIn ? 'tok' : ''),
  forceRefreshToken: async () => null,
  hasSessionExport: undefined,
  loadSession: () => null,
}))

vi.mock('./request', () => ({
  request: vi.fn(),
}))

import { listEvents, createEvent, updateEvent, deleteEvent, syncLocalEvents, isLoggedIn } from './events'

const LOCAL_KEY = 'countdown_local_events'

// ---- node 环境无 localStorage：装一个内存桩（data 层只在调用时读写）----

class MemoryStorage {
  private store = new Map<string, string>()
  getItem(key: string): string | null {
    return this.store.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value)
  }
  removeItem(key: string): void {
    this.store.delete(key)
  }
  clear(): void {
    this.store.clear()
  }
  get length(): number {
    return this.store.size
  }
  key(index: number): string | null {
    return [...this.store.keys()][index] ?? null
  }
}

// 只在未定义时装（浏览器环境 / jsdom 直接复用）。
const g = globalThis as Record<string, unknown>
if (typeof g.localStorage !== 'object' || g.localStorage === null) {
  Object.defineProperty(g, 'localStorage', { value: new MemoryStorage(), writable: true })
}

/** 读 localStorage 里的本地事件。 */
function readStored(): CountdownEvent[] {
  return JSON.parse(localStorage.getItem(LOCAL_KEY) ?? '[]') as CountdownEvent[]
}

/** 手工构造一条云端事件。 */
function cloudEvent(overrides: Partial<CountdownEvent> = {}): CountdownEvent {
  return {
    id: 'c-1',
    title: '云端事件',
    target_date: '2026-12-31',
    note: '',
    category: 'other',
    direction: 'countdown',
    is_pinned: false,
    sort_order: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    days: 0,
    ...overrides,
  }
}

/** 造一条已存在的本地事件（直接落 localStorage）。 */
function seedLocal(event: CountdownEvent): void {
  localStorage.setItem(LOCAL_KEY, JSON.stringify([event]))
}

const localEvent = (): CountdownEvent =>
  cloudEvent({
    id: 'local-1',
    title: '本地事件',
    target_date: '2026-10-01',
    created_at: '2026-02-01T00:00:00.000Z',
    updated_at: '2026-02-01T00:00:00.000Z',
  })

beforeEach(() => {
  mocks.loggedIn = false
  localStorage.clear()
  vi.clearAllMocks()
})

afterEach(() => {
  localStorage.clear()
})

describe('登录态判定', () => {
  it('isLoggedIn 跟随 OIDC 会话', () => {
    mocks.loggedIn = false
    expect(isLoggedIn()).toBe(false)
    mocks.loggedIn = true
    expect(isLoggedIn()).toBe(true)
  })
})

describe('未登录：全部落 localStorage', () => {
  it('listEvents 读本地（不请求云端）', async () => {
    seedLocal(localEvent())
    const list = await listEvents()
    expect(list).toHaveLength(1)
    expect(list[0]?.id).toBe('local-1')
    expect(request).not.toHaveBeenCalled()
  })

  it('createEvent 落本地并补全字段', async () => {
    const created = await createEvent({ title: '新事件', target_date: '2026-11-11' })
    expect(created.id).toBeTypeOf('string')
    expect(readStored()).toHaveLength(1)
    expect(readStored()[0]?.title).toBe('新事件')
    expect(request).not.toHaveBeenCalled()
  })

  it('updateEvent / deleteEvent 操作本地行', async () => {
    seedLocal(localEvent())
    const updated = await updateEvent('local-1', { title: '改名' })
    expect(updated.title).toBe('改名')
    expect(readStored()[0]?.title).toBe('改名')

    await deleteEvent('local-1')
    expect(readStored()).toHaveLength(0)
    expect(request).not.toHaveBeenCalled()
  })
})

describe('已登录：走云端', () => {
  beforeEach(() => {
    mocks.loggedIn = true
  })

  it('listEvents 拉云端并返回 events 数组', async () => {
    vi.mocked(request).mockResolvedValue({ events: [cloudEvent()] })
    const list = await listEvents()
    expect(list).toHaveLength(1)
    expect(list[0]?.id).toBe('c-1')
    expect(request).toHaveBeenCalledWith('/api/events')
  })

  it('云端拉取失败 → 回退本地缓存（不抛错）', async () => {
    seedLocal(localEvent())
    vi.mocked(request).mockRejectedValue(new Error('网络异常'))
    const list = await listEvents()
    expect(list).toHaveLength(1)
    expect(list[0]?.id).toBe('local-1')
  })

  it('createEvent 调云端 POST', async () => {
    vi.mocked(request).mockResolvedValue({ event: cloudEvent() })
    await createEvent({ title: 'x', target_date: '2026-12-01' })
    expect(request).toHaveBeenCalledWith(
      '/api/events',
      expect.objectContaining({ method: 'POST', data: { title: 'x', target_date: '2026-12-01' } })
    )
  })

  it('deleteEvent 调云端 DELETE', async () => {
    vi.mocked(request).mockResolvedValue(null)
    await deleteEvent('c-1')
    expect(request).toHaveBeenCalledWith('/api/events/c-1', expect.objectContaining({ method: 'DELETE' }))
  })
})

describe('syncLocalEvents：登录后把本地并入云端', () => {
  it('未登录 → 0 且不请求', async () => {
    mocks.loggedIn = false
    seedLocal(localEvent())
    expect(await syncLocalEvents()).toBe(0)
    expect(request).not.toHaveBeenCalled()
  })

  it('已登录：本地全部上传 → 返回条数并清空本地', async () => {
    mocks.loggedIn = true
    seedLocal(localEvent())

    // 云端为空：每个本地事件都新增（request 依次应答列表与每次 POST）。
    vi.mocked(request)
      .mockResolvedValueOnce({ events: [] })
      .mockResolvedValueOnce({ event: cloudEvent({ id: 'synced-1' }) })

    const n = await syncLocalEvents()
    expect(n).toBe(1)
    expect(readStored()).toHaveLength(0)
    expect(request).toHaveBeenCalledWith('/api/events', { retry: false })
    expect(request).toHaveBeenCalledWith(
      '/api/events',
      expect.objectContaining({ method: 'POST', data: expect.objectContaining({ title: '本地事件' }) })
    )
  })

  it('已登录：与云端重复的事件跳过上传（按 title+target_date 去重）', async () => {
    mocks.loggedIn = true
    const dup = cloudEvent({ id: 'local-dup', title: '本地事件', target_date: '2026-10-01' })
    seedLocal(dup)

    // 云端已有同 title+target_date 的事件。
    vi.mocked(request).mockResolvedValue({
      events: [cloudEvent({ id: 'c-dup', title: '本地事件', target_date: '2026-10-01' })],
    })

    const n = await syncLocalEvents()
    expect(n).toBe(0)
    // 仍视为全部并入 → 清空本地（重复的云端已存在）。
    expect(readStored()).toHaveLength(0)
  })
})
