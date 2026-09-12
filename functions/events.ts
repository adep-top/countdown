/**
 * 云函数：events —— 事件 CRUD（移植自 cf-backend src/routes/events.ts）。
 *
 * 路由（归一化后）：
 *   GET    /events?category=xxx   → { events }（置顶优先，其余按剩余天数升序）
 *   POST   /events                → 创建（上限 200 个）
 *   GET    /events/:id            → { event }
 *   PUT    /events/:id            → 局部更新
 *   DELETE /events/:id            → 删除
 * 鉴权：Bearer device_id（见 _shared/auth.ts）。
 */
import type { FunctionContext } from '@adep/types'
import { ok, fail, CODE } from './_shared/response'
import { requireUser, isEnvelope } from './_shared/auth'
import { routePath } from './_shared/route'
import { isValidDate, toDTO, sortEvents, nowIso, type EventRow } from './_shared/date'
import {
  findEventById,
  insertEvent,
  updateEvent,
  deleteEvent,
  listEvents,
  countEvents,
  type NewEventRow,
} from './_shared/store'

const CATEGORIES = new Set(['other', 'birthday', 'anniversary', 'exam', 'holiday'])
const MAX_EVENTS = 200

function normalizeBody<T>(ctx: FunctionContext): T {
  if (ctx.body && typeof ctx.body === 'object') return ctx.body as T
  return {} as T
}

export default async function handle(ctx: FunctionContext) {
  const db = ctx.cloud.db
  if (!db) return fail(CODE.SERVER_ERROR, '数据库未就绪，请先执行 adep db start 并建表')

  const authed = await requireUser(db, ctx)
  if (isEnvelope(authed)) return authed
  const { user } = authed

  const path = routePath(ctx.path)
  const method = String(ctx.method ?? 'GET').toUpperCase()

  // GET /events
  if (path === '/events' && method === 'GET') {
    const category = ctx.query?.category
    let events = (await listEvents(db, user.id)).map((row) => toDTO(row as unknown as EventRow))
    if (typeof category === 'string' && category && CATEGORIES.has(category)) {
      events = events.filter((e) => e.category === category)
    }
    return ok({ events: sortEvents(events) })
  }

  // POST /events
  if (path === '/events' && method === 'POST') {
    const body = normalizeBody<{
      title?: unknown
      target_date?: unknown
      note?: unknown
      category?: unknown
      direction?: unknown
      is_pinned?: unknown
    }>(ctx)

    const title = typeof body.title === 'string' ? body.title.trim() : ''
    const target_date = typeof body.target_date === 'string' ? body.target_date : ''
    const note = typeof body.note === 'string' ? body.note.trim() : ''
    const category = typeof body.category === 'string' ? body.category : 'other'
    const direction = body.direction === 'countup' ? 'countup' : 'countdown'
    const is_pinned = !!body.is_pinned

    if (!title) return fail(CODE.BAD_PARAM, '请填写事件名称')
    if (title.length > 50) return fail(CODE.BAD_PARAM, '名称不能超过 50 个字')
    if (!isValidDate(target_date)) return fail(CODE.BAD_PARAM, '请选择目标日期')
    if (note.length > 200) return fail(CODE.BAD_PARAM, '备注不能超过 200 个字')
    if (!CATEGORIES.has(category)) return fail(CODE.BAD_PARAM, '分类不合法')

    const count = await countEvents(db, user.id)
    if (count >= MAX_EVENTS) return fail(CODE.LIMIT_EXCEEDED, `最多创建 ${MAX_EVENTS} 个事件`)

    const now = nowIso()
    const event: NewEventRow = {
      id: crypto.randomUUID(),
      user_id: user.id,
      title,
      target_date,
      note,
      category,
      direction,
      is_pinned: is_pinned ? 1 : 0,
      sort_order: 0,
      created_at: now,
      updated_at: now,
    }
    await insertEvent(db, event)
    return ok({ event: toDTO(event) }, '创建成功')
  }

  // GET /events/:id
  const matchId = /^\/events\/([^/]+)$/.exec(path)
  if (matchId && method === 'GET') {
    const event = await findEventById(db, matchId[1], user.id)
    if (!event) return fail(CODE.NOT_FOUND, '事件不存在')
    return ok({ event: toDTO(event as unknown as EventRow) })
  }

  // PUT /events/:id
  if (matchId && method === 'PUT') {
    const event = await findEventById(db, matchId[1], user.id)
    if (!event) return fail(CODE.NOT_FOUND, '事件不存在')

    const body = normalizeBody<{
      title?: unknown
      target_date?: unknown
      note?: unknown
      category?: unknown
      direction?: unknown
      is_pinned?: unknown
    }>(ctx)

    const patch: Partial<NewEventRow> = {}
    const { title, target_date, note, category, direction, is_pinned } = body
    if (title !== undefined) {
      if (typeof title !== 'string' || !title.trim()) return fail(CODE.BAD_PARAM, '请填写事件名称')
      if (title.trim().length > 50) return fail(CODE.BAD_PARAM, '名称不能超过 50 个字')
      patch.title = title.trim()
    }
    if (target_date !== undefined) {
      if (typeof target_date !== 'string' || !isValidDate(target_date)) {
        return fail(CODE.BAD_PARAM, '请选择目标日期')
      }
      patch.target_date = target_date
    }
    if (note !== undefined) {
      if (typeof note !== 'string') return fail(CODE.BAD_PARAM, '备注格式不合法')
      if (note.trim().length > 200) return fail(CODE.BAD_PARAM, '备注不能超过 200 个字')
      patch.note = note.trim()
    }
    if (category !== undefined) {
      if (typeof category !== 'string' || !CATEGORIES.has(category)) {
        return fail(CODE.BAD_PARAM, '分类不合法')
      }
      patch.category = category
    }
    if (direction !== undefined) {
      if (direction !== 'countdown' && direction !== 'countup') {
        return fail(CODE.BAD_PARAM, '计时方式不合法')
      }
      patch.direction = direction
    }
    if (is_pinned !== undefined) {
      patch.is_pinned = is_pinned ? 1 : 0
    }

    patch.updated_at = nowIso()
    await updateEvent(db, event.id, user.id, patch)
    const fresh = await findEventById(db, event.id, user.id)
    return ok({ event: toDTO((fresh ?? event) as unknown as EventRow) }, '已保存')
  }

  // DELETE /events/:id
  if (matchId && method === 'DELETE') {
    const event = await findEventById(db, matchId[1], user.id)
    if (!event) return fail(CODE.NOT_FOUND, '事件不存在')
    await deleteEvent(db, event.id, user.id)
    return ok({ id: event.id }, '已删除')
  }

  return fail(CODE.NOT_FOUND, '接口不存在')
}
