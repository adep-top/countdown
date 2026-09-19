/**
 * 事件数据层（登录即服务）：已登录（OIDC）→ 云端 /api/events；未登录 → localStorage。
 * 本地事件形状与云端 DTO 一致（web/src/lib/date.ts 的 CountdownEvent），保证登录后
 * 同步（syncLocalEvents）可直接并入云端：按 (title, target_date) 去重，成功即清空本地。
 *
 * 未登录的增删改全部落 localStorage（本机可见）；登录后切云端，localStorage 数据
 * 由 ProfileView 的 [登录以同步数据] 触发上传合并。
 */
import { request } from './request'
import { hasSession } from './oidc'
import type { CountdownEvent } from './date'

const LOCAL_KEY = 'countdown_local_events'

/** 新建/编辑载荷（云端 /api/events 接受的字段）。 */
export interface EventInput {
  title: string
  target_date: string
  note?: string
  category?: string
  direction?: 'countdown' | 'countup'
  is_pinned?: boolean
}

/** 是否已登录（OIDC 会话存在）。 */
export function isLoggedIn(): boolean {
  return hasSession()
}

function readLocal(): CountdownEvent[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    return raw ? (JSON.parse(raw) as CountdownEvent[]) : []
  } catch {
    return []
  }
}

function writeLocal(list: CountdownEvent[]): void {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(list))
}

function nowIso(): string {
  return new Date().toISOString()
}

function localSort(list: CountdownEvent[]): CountdownEvent[] {
  return list.toSorted((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1
    return (a.created_at ?? '').localeCompare(b.created_at ?? '')
  })
}

/** 列表：登录 → 云端（失败回退本地）；未登录 → localStorage。 */
export async function listEvents(): Promise<CountdownEvent[]> {
  if (!isLoggedIn()) return readLocal()
  try {
    const res = await request<{ events: CountdownEvent[] }>('/api/events')
    return res.events ?? []
  } catch {
    // 登录态失效 / 网络异常：回退本地缓存，云端数据下次刷新再取。
    return readLocal()
  }
}

/** 详情：登录 → 云端；未登录 → 本地。查无返回 null。 */
export async function getEvent(id: string): Promise<CountdownEvent | null> {
  if (!isLoggedIn()) {
    return readLocal().find((e) => e.id === id) ?? null
  }
  try {
    const res = await request<{ event: CountdownEvent }>(`/api/events/${id}`)
    return res.event ?? null
  } catch {
    return null
  }
}

/** 新建：登录 → 云端；未登录 → 本地（随机 id，created_at 落盘）。 */
export async function createEvent(input: EventInput): Promise<CountdownEvent> {
  if (isLoggedIn()) {
    const res = await request<{ event: CountdownEvent }>('/api/events', {
      method: 'POST',
      data: input,
      retry: false,
    })
    return res.event
  }
  const now = nowIso()
  const event: CountdownEvent = {
    id: crypto.randomUUID(),
    title: input.title,
    target_date: input.target_date,
    note: input.note ?? '',
    category: input.category ?? 'other',
    direction: input.direction ?? 'countdown',
    is_pinned: input.is_pinned ?? false,
    sort_order: 0,
    created_at: now,
    updated_at: now,
    days: 0,
  }
  writeLocal(localSort([...readLocal(), event]))
  return event
}

/** 编辑：登录 → 云端；未登录 → 本地。查无抛错。 */
export async function updateEvent(id: string, input: EventInput): Promise<CountdownEvent> {
  if (isLoggedIn()) {
    const res = await request<{ event: CountdownEvent }>(`/api/events/${id}`, {
      method: 'PUT',
      data: input,
      retry: false,
    })
    return res.event
  }
  const list = readLocal()
  const idx = list.findIndex((e) => e.id === id)
  if (idx === -1) throw new Error('事件不存在')
  const updated: CountdownEvent = {
    ...list[idx]!,
    ...input,
    note: input.note ?? list[idx]!.note,
    category: input.category ?? list[idx]!.category,
    direction: input.direction ?? list[idx]!.direction,
    is_pinned: input.is_pinned ?? list[idx]!.is_pinned,
    updated_at: nowIso(),
  }
  list[idx] = updated
  writeLocal(localSort(list))
  return updated
}

/** 删除：登录 → 云端；未登录 → 本地。 */
export async function deleteEvent(id: string): Promise<void> {
  if (isLoggedIn()) {
    await request(`/api/events/${id}`, { method: 'DELETE', retry: false })
    return
  }
  writeLocal(readLocal().filter((e) => e.id !== id))
}

/**
 * 登录后同步：把 localStorage 事件并入云端（按 title+target_date 去重），成功清空本地。
 * 返回新上传条数；已登录但云端拉取失败 → 抛错（本地保留，下次再试）。
 */
export async function syncLocalEvents(): Promise<number> {
  if (!isLoggedIn()) return 0
  const local = readLocal()
  if (local.length === 0) return 0

  const cloud = await request<{ events: CountdownEvent[] }>('/api/events', { retry: false })
  const cloudKeys = new Set((cloud.events ?? []).map(keyOf))
  let uploaded = 0
  // 有意的 no-await-in-loop（AGENTS.md §9）：逐条串行上传，避免并发打爆 200 上限竞态。
  /* oxlint-disable no-await-in-loop */
  for (const e of local) {
    if (cloudKeys.has(keyOf(e))) continue
    await createEvent({
      title: e.title,
      target_date: e.target_date,
      note: e.note,
      category: e.category,
      direction: e.direction,
      is_pinned: e.is_pinned,
    })
    cloudKeys.add(keyOf(e))
    uploaded++
  }
  /* oxlint-enable no-await-in-loop */
  // 全部并入（重复的也已存在云端）→ 清空本地。
  writeLocal([])
  return uploaded
}

function keyOf(e: { title: string; target_date: string }): string {
  return `${e.title}|${e.target_date}`
}

/** 事件列表缓存键（首页秒开用；退出登录/切换账号时一并清掉）。 */
export const EVENTS_CACHE_KEY = 'events_cache'

/**
 * 清空本机缓存数据：本地未同步草稿 + 列表缓存。
 * 退出登录 / 切换账号时调用，避免上一个用户的数据残留在本机浏览器。
 * 不动 OIDC 会话与 OAuth 客户端注册（见 auth.logout）。
 */
export function clearLocalData(): void {
  localStorage.removeItem(LOCAL_KEY)
  localStorage.removeItem(EVENTS_CACHE_KEY)
}
