/**
 * 服务端日期工具（移植自 cf-backend src/lib/date.ts）。
 * 与小程序 utils/date.js 算法对齐：天数按「北京时间（UTC+8）自然日」计算。
 */
const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

/** 北京时间今天 YYYY-MM-DD（自然日，不以 UTC 日期为准） */
export function todayStr(): string {
  const now = new Date(Date.now() + 8 * 3600_000)
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth() + 1
  const d = now.getUTCDate()
  return fmt(y, m, d)
}

function fmt(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export function isValidDate(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  if (m < 1 || m > 12 || d < 1 || d > 31) return false
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
}

/** 按北京时间自然日差（正数未来 / 负数过去；countup 取绝对值） */
export function calcDays(
  targetDate: string,
  direction: 'countdown' | 'countup' = 'countdown'
): number {
  if (!isValidDate(targetDate)) return 0
  const target = new Date(`${targetDate}T00:00:00+08:00`).getTime()
  const now = new Date()
  const nowBeijing = new Date(now.getTime() + 8 * 3600_000)
  const todayStart = new Date(
    Date.UTC(nowBeijing.getUTCFullYear(), nowBeijing.getUTCMonth(), nowBeijing.getUTCDate()) -
      8 * 3600_000
  ).getTime()
  const diff = Math.round((target - todayStart) / 86400000)
  return direction === 'countup' ? Math.abs(diff) : diff
}

export function weekdayOf(targetDate: string): string {
  if (!isValidDate(targetDate)) return ''
  const [y, m, d] = targetDate.split('-').map(Number)
  return WEEK[new Date(y, m - 1, d).getDay()]
}

/** 服务器时间 ISO（UTC，存储用） */
export function nowIso(): string {
  return new Date().toISOString()
}

/** 事件行 → DTO（附 days / weekday；is_pinned 布尔化） */
export interface EventRow {
  id: string
  user_id: string
  title: string
  target_date: string
  note: string | null
  category: string | null
  direction: 'countdown' | 'countup' | null
  is_pinned: number | boolean | null
  sort_order: number | null
  created_at: string | null
  updated_at: string | null
}

export interface EventDTO {
  id: string
  title: string
  target_date: string
  note: string
  category: string
  direction: 'countdown' | 'countup'
  is_pinned: boolean
  sort_order: number
  created_at: string
  updated_at: string
  days: number
}

export function toDTO(row: EventRow): EventDTO {
  const direction = row.direction === 'countup' ? 'countup' : 'countdown'
  const dto: EventDTO = {
    id: row.id,
    title: row.title,
    target_date: row.target_date,
    note: row.note ?? '',
    category: row.category ?? 'other',
    direction,
    is_pinned: !!row.is_pinned,
    sort_order: row.sort_order ?? 0,
    created_at: row.created_at ?? '',
    updated_at: row.updated_at ?? '',
    days: 0,
  }
  dto.days = calcDays(row.target_date, direction)
  return dto
}

/** 列表排序：置顶在前，其余按剩余天数升序（过去的天数排在最后） */
export function sortEvents<T extends EventDTO>(events: T[]): T[] {
  return events.toSorted((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1
    const da = a.days >= 0 ? a.days : Number.MAX_SAFE_INTEGER
    const db = b.days >= 0 ? b.days : Number.MAX_SAFE_INTEGER
    return da - db
  })
}
