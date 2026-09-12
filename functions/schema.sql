-- 倒数日应用数据库 Schema（移植自 cf-backend migrations/0001_initial.sql）。
-- 用法：adep db migrate functions/schema.sql（平台侧建表）；
-- 本地 dev（adep dev / vite 插件）的 sim 引擎访问时自动建表，无需手动执行。
-- 每行一条语句，以分号结尾（migrate 按行拆分逐条执行）。

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL UNIQUE,
  nickname TEXT NOT NULL DEFAULT '本地用户',
  avatar_url TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  target_date TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'other',
  direction TEXT NOT NULL DEFAULT 'countdown',
  is_pinned INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_user ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_users_device ON users(device_id);
