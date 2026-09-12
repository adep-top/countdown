/**
 * 日期工具（逐行移植自小程序 utils/date.js，算法与云函数侧 _shared/date.ts 保持一致）。
 * 天数按「本地时区自然日」计算；云函数侧按北京时间（UTC+8）计算——用户在中国大陆时两者一致。
 */
import { CATEGORY_LABEL } from './config'

const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

/** 今天（本地时区）YYYY-MM-DD */
export function todayStr(): string {
  const d = new Date()
  return fmt(d.getFullYear(), d.getMonth() + 1, d.getDate())
}

export function fmt(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export function isValidDate(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  if (m < 1 || m > 12 || d < 1 || d > 31) return false
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
}

/** 距目标日期的自然日差；正数日返回绝对值 */
export function calcDays(
  targetDate: string,
  direction: 'countdown' | 'countup' = 'countdown'
): number {
  if (!isValidDate(targetDate)) return 0
  const [y, m, d] = targetDate.split('-').map(Number)
  const target = new Date(y, m - 1, d).getTime()
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const diff = Math.round((target - today) / 86400000)
  return direction === 'countup' ? Math.abs(diff) : diff
}

export function weekdayOf(targetDate: string): string {
  if (!isValidDate(targetDate)) return ''
  const [y, m, d] = targetDate.split('-').map(Number)
  return WEEK[new Date(y, m - 1, d).getDay()]
}

/** 2026-09-13 -> 9月13日 */
export function shortLabel(targetDate: string): string {
  if (!isValidDate(targetDate)) return ''
  const [, m, d] = targetDate.split('-').map(Number)
  return `${m}月${d}日`
}

/**
 * 根据天数返回展示等级（与小程序一致）
 * normal >30 蓝 | soon 7-30 橙 | urgent <7 红 | today 当天 红 | past 已过 灰
 */
export function levelOf(days: number, direction: 'countdown' | 'countup' = 'countdown'): string {
  if (direction === 'countup') return 'normal'
  if (days < 0) return 'past'
  if (days === 0) return 'today'
  if (days < 7) return 'urgent'
  if (days <= 30) return 'soon'
  return 'normal'
}

/** 天数文案与前后缀 */
export function daysText(
  days: number,
  direction: 'countdown' | 'countup' = 'countdown'
): { num: string; prefix: string; suffix: string; tip: string } {
  if (direction === 'countup') {
    return { num: String(days), prefix: '已经', suffix: '天', tip: '天啦' }
  }
  if (days === 0) return { num: '今天', prefix: '', suffix: '', tip: '就是今天' }
  if (days > 0) return { num: String(days), prefix: '还有', suffix: '天', tip: '' }
  return { num: String(-days), prefix: '已过', suffix: '天', tip: '' }
}

/** 事件 DTO（云函数 /events 返回带 days 的形状）。 */
export interface CountdownEvent {
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

/** 列表展示装饰：补齐等级 / 文案 / 副标题 / 分类名（移植自 index.js decorate）。 */
export function decorateEvent(item: CountdownEvent): DecodedEvent {
  const days =
    typeof item.days === 'number' ? item.days : calcDays(item.target_date, item.direction)
  const t = daysText(days, item.direction)
  return {
    ...item,
    offset: 0,
    days,
    level: levelOf(days, item.direction),
    num: t.num,
    prefix: t.prefix,
    suffix: t.suffix,
    tip: t.tip,
    sub: `${item.target_date} ${weekdayOf(item.target_date)}`,
    categoryLabel: CATEGORY_LABEL[item.category] ?? '日常',
  }
}

export interface DecodedEvent extends CountdownEvent {
  /** 左滑偏移（px），用于卡片滑动动画 */
  offset: number
  level: string
  num: string
  prefix: string
  suffix: string
  tip: string
  sub: string
  categoryLabel: string
}
