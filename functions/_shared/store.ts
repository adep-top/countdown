/**
 * 数据访问层（移植自 cf-backend src/db/queries.ts + src/db/client.ts）。
 *
 * 迁移点：Cloudflare D1 的 prepare().bind().run()/all() → adep `cloud.db` 链式
 * builder（等价 SQLite 子集；sim 引擎与平台项目库同一套实现，见
 * `packages/runtime/src/database/builder`）。表结构由 functions/schema.sql 声明，
 * 部署前用 `adep db migrate` 建表；本地 dev（adep dev / vite 插件）的 sim 引擎
 * 访问时会自动建表。
 */
import type { CloudDb, SqlValue } from '@adep/types'

/** users 表行（读出的行字段可空，写时补全） */
export interface UserRow {
  id: string
  device_id: string
  nickname: string | null
  avatar_url: string | null
  created_at: string | null
  updated_at: string | null
}

/** events 表行（读出的行字段可空，写时补全） */
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

/** 行对象 → builder 可接受的 SqlValue 记录（结构兼容即可，内部都是基本类型）。 */
function sql(row: Record<string, unknown>): Record<string, SqlValue> {
  return row as unknown as Record<string, SqlValue>
}

/** 新建用户行的完整形状（写入专用）。 */
export interface NewUserRow {
  id: string
  device_id: string
  nickname: string
  avatar_url: string
  created_at: string
  updated_at: string
}

/** 新建事件行的完整形状（写入专用）。 */
export interface NewEventRow {
  id: string
  user_id: string
  title: string
  target_date: string
  note: string
  category: string
  direction: 'countdown' | 'countup'
  is_pinned: 0 | 1
  sort_order: number
  created_at: string
  updated_at: string
}

// ---------- users ----------

export async function findUserByDeviceId(db: CloudDb, deviceId: string): Promise<UserRow | null> {
  const row = await db.table('users').where('device_id', deviceId).first()
  return (row as unknown as UserRow | undefined) ?? null
}

export async function findUserById(db: CloudDb, id: string): Promise<UserRow | null> {
  const row = await db.table('users').where('id', id).first()
  return (row as unknown as UserRow | undefined) ?? null
}

export async function createUser(db: CloudDb, row: NewUserRow): Promise<void> {
  await db.table('users').insert(sql(row as unknown as Record<string, unknown>))
}

// ---------- events ----------

export async function listEvents(db: CloudDb, userId: string): Promise<EventRow[]> {
  const rows = await db.table('events').where('user_id', userId).get()
  return (rows as unknown as EventRow[]) ?? []
}

export async function findEventById(
  db: CloudDb,
  id: string,
  userId: string
): Promise<EventRow | null> {
  const row = await db.table('events').where('id', id).where('user_id', userId).first()
  return (row as unknown as EventRow | undefined) ?? null
}

export async function countEvents(db: CloudDb, userId: string): Promise<number> {
  // cloud.db 的 count() 返回 number（builder 内部取 SELECT count(*) AS n 的 n）
  const n = await db.table('events').where('user_id', userId).count()
  return typeof n === 'number' ? n : Number(n ?? 0)
}

export async function insertEvent(db: CloudDb, row: NewEventRow): Promise<void> {
  await db.table('events').insert(sql(row as unknown as Record<string, unknown>))
}

export async function updateEvent(
  db: CloudDb,
  id: string,
  userId: string,
  patch: Partial<NewEventRow>
): Promise<void> {
  await db
    .table('events')
    .where('id', id)
    .where('user_id', userId)
    .update(sql(patch as unknown as Record<string, unknown>))
}

export async function deleteEvent(db: CloudDb, id: string, userId: string): Promise<void> {
  await db.table('events').where('id', id).where('user_id', userId).delete()
}
