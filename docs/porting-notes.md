# 移植说明：微信小程序「倒数日」→ adep 应用

> 原仓库：`/Users/yunke/WorkBuddy/countdown`（`miniprogram/` 前端 + `cf-backend/` 后端）
> 本应用：`apps/countdown`（`web/` 前端 + `functions/` 云函数）

## 1. 架构对照

| 原始 | 移植后 | 说明 |
| --- | --- | --- |
| WeChat Mini Program（WXML/WXSS/WXS） | Vue 3 SPA（`web/`） | 页面结构、视觉、交互逐项对齐 |
| Cloudflare Workers（Hono + D1） | adep 云函数（`functions/`） | 同构路由，逐文件移植 |
| D1 `prepare().bind().all()/run()` | adep `cloud.db` 链式 builder | 相同 SQLite 子集；本地 sim / 平台项目库同一实现 |
| `wx.request` 封装（utils/request.js） | `fetch` 封装（web/src/lib/request.ts） | 信封与错误码不变 |
| JWT（微信 openid） | 设备身份 device_id（Bearer） | 见 §2 |

## 2. 登录链路（核心迁移决策）

**原始**：`wx.login()` → code → `code2Session` → openid（微信设备级唯一 ID）→ 服务端签发 JWT → 请求带 `Authorization: Bearer <jwt>` → 40001 时前端清 token 重登。

**移植**：web 无微信，浏览器 localStorage 持久化随机 `device_id` 承担「openid」角色：

1. 前端 `web/src/lib/device.ts` 首次访问生成 `dev_<uuid>` 落 localStorage（清站点数据才变）；
2. `POST /api/auth/login {deviceId}` → 云函数按 `device_id` 取/建用户行，返回 `{ token: deviceId, user }`；
3. 后续请求 `Authorization: Bearer <deviceId>`，云函数 `_shared/auth.ts` 查 users 表验证；
4. 业务码 40001 → 前端 request.ts 清 token 静默重登重试一次。

语义上 device_id 等同 API Key（谁能读到 localStorage 谁能冒充该用户）。这是个人向本地应用，可接受；
如果未来需要更强的鉴权，可换成平台 better-auth（`ctx.user`）+ 跨子域 session，届时仅需改
`functions/_shared/auth.ts` 与前端 request.ts 两处。

## 3. 数据模型（D1 → schema.sql）

- `users`：`device_id` 唯一（原表为 openid 唯一）；
- `events`：列与原迁移一致（title/target_date/note/category/direction/is_pinned/sort_order/时间戳），
  `user_id` 绑定归属，所有查询带 `user_id` 过滤；
- 平台侧用 `adep db migrate functions/schema.sql` 建表；本地 sim 自动建表。

## 4. 前端逐项映射

| 小程序 | web |
| --- | --- |
| `view` / `text` / `scroll-view` | `div` / `span` + `.page-scroll` |
| `picker`（日期） | `<input type="date">` |
| `picker`（分类） | `<select>`（箭头样式对齐） |
| `radio-group` | 自定义 radio（样式对齐） |
| `switch` | 自定义按钮开关 |
| `button` | `<button>`（去默认样式） |
| `wx.showToast` | `ui/ui.ts showToast()` |
| `wx.showModal` | `showModal()`（Promise<boolean>） |
| `wx.showActionSheet` | `showActionSheet()`（Promise<number>） |
| `wx.navigateTo` | vue-router push |
| `wx.setClipboardData` | `navigator.clipboard` |
| 左滑露出操作 | pointer 事件 + `touch-action: pan-y` + CSS transform |
| 长按菜单 | pointerdown 600ms 定时器 |
| 下拉刷新 | pointer 事件实现（scrollTop=0 时追踪 dy，preventDefault） |
| 系统状态栏高度 | 无状态栏，导航高度固定 0.88rem |
| rpx | rem（1rem = 100rpx；`.app` font-size 64px @ 480px 画布，窄窗随视口缩放） |

## 5. 后端逐项映射

| cf-backend | adep |
| --- | --- |
| `app.route('POST', '/auth/login', ...)` | `functions/auth.ts` 内部分发（按 method + 归一化 path） |
| Hono `c.json({code,data,message}, status)` | `_shared/response.ts` 返回 `__adepHttp` 信封（ADR-0024/CF-010） |
| 中间件解析 Bearer | `_shared/auth.ts requireUser()` |
| D1 查询 | `_shared/store.ts`（builder 写法） |
| 北京时间自然日 | `_shared/date.ts`（UTC+8，与前端算法一致） |
| 排序（置顶→剩余天数升序） | `_shared/date.ts sortEvents()` |

## 6. 依赖的平台能力（含本仓库为移植补充的改进）

- **`__adepHttp` 响应信封**（既有）：让函数返回业务信封 + 自定义 status，本地/平台一致；
- **`adep frontend sync`**（本次新增 CLI 命令）：上传本地 `web/` 源码为平台前端草稿。
  移植前平台只能由 Web IDE 写入前端草稿，CLI 开发的本地 `web/` 无法发布——`adep publish` 全量发布
  现在会自动 sync 后再构建；
- **`adep db migrate <file>`**（本次新增 CLI 命令）：按行拆分 `.sql` 逐条执行，应用 `schema.sql`，
  替代手工在 SQL 控制台建表。
