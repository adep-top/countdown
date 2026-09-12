/**
 * 服务端日期/排序/响应信封单元测试（移植逻辑的回归保护）。
 * 运行：npm run test
 */
import { describe, it, expect } from 'vitest'
import { isValidDate, calcDays, toDTO, sortEvents, type EventRow } from './date'
import { ok, fail, CODE } from './response'

describe('isValidDate', () => {
  it('接受合法 YYYY-MM-DD', () => {
    expect(isValidDate('2026-09-20')).toBe(true)
    expect(isValidDate('2024-02-29')).toBe(true)
  })
  it('拒绝非法日期与格式', () => {
    expect(isValidDate('2026-13-01')).toBe(false)
    expect(isValidDate('2026-02-30')).toBe(false)
    expect(isValidDate('2026/09/20')).toBe(false)
    expect(isValidDate('')).toBe(false)
    expect(isValidDate(null)).toBe(false)
  })
})

describe('calcDays（北京时间自然日）', () => {
  it('倒计时：未来为正，当天为 0', () => {
    const today = new Date()
    const beijing = new Date(today.getTime() + 8 * 3600_000)
    const todayStr = `${beijing.getUTCFullYear()}-${String(beijing.getUTCMonth() + 1).padStart(2, '0')}-${String(
      beijing.getUTCDate()
    ).padStart(2, '0')}`
    expect(calcDays(todayStr)).toBe(0)
  })
  it('过去日期为负；countup 取绝对值', () => {
    expect(calcDays('2020-01-01')).toBeLessThan(0)
    expect(calcDays('2020-01-01', 'countup')).toBeGreaterThan(0)
  })
  it('非法日期返回 0', () => {
    expect(calcDays('bad-date')).toBe(0)
  })
})

describe('toDTO + sortEvents', () => {
  const base = {
    id: '1',
    user_id: 'u1',
    title: '事件',
    target_date: '2030-01-01',
    note: null,
    category: null,
    direction: 'countdown',
    is_pinned: 0,
    sort_order: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  } as EventRow

  it('toDTO 补默认值并算 days', () => {
    const dto = toDTO(base)
    expect(dto.note).toBe('')
    expect(dto.category).toBe('other')
    expect(dto.is_pinned).toBe(false)
    expect(dto.days).toBeGreaterThan(0)
  })

  it('排序：置顶优先，其余按剩余天数升序（过去排最后）', () => {
    const far = { ...base, id: 'far', target_date: '2031-01-01' } as EventRow
    const near = { ...base, id: 'near', target_date: '2026-10-01' } as EventRow
    const past = { ...base, id: 'past', target_date: '2020-01-01' } as EventRow
    const pinnedFar = { ...far, id: 'pinnedFar', is_pinned: 1 } as EventRow
    const sorted = sortEvents([far, near, past, pinnedFar].map((r) => toDTO(r)))
    expect(sorted.map((e) => e.id)).toEqual(['pinnedFar', 'near', 'far', 'past'])
  })
})

describe('响应信封', () => {
  it('ok 返回 200 + 业务信封', () => {
    const env = ok({ a: 1 })
    expect(env.__adepHttp.status).toBe(200)
    expect(env.__adepHttp.body).toEqual({ code: 0, data: { a: 1 }, message: 'ok' })
  })
  it('fail 映射 HTTP 状态', () => {
    expect(fail(CODE.NO_AUTH, 'x').__adepHttp.status).toBe(401)
    expect(fail(CODE.BAD_PARAM, 'x').__adepHttp.status).toBe(400)
    expect(fail(CODE.NOT_FOUND, 'x').__adepHttp.status).toBe(404)
  })
})
