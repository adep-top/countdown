# countdown（倒数日 / 纪念日）

微信小程序「倒数日」移植为 **adep 应用**。界面与交互对齐原始小程序（渐变头部、左滑置顶/删除、长按菜单、下拉刷新、自定义 TabBar），数据层由小程序后端（Cloudflare Workers + D1）移植为 adep 云函数 + 项目数据库。

- 小程序源码：`/Users/yunke/WorkBuddy/countdown`（`miniprogram/` 前端 + `cf-backend/` 后端）
- 移植说明：见 [`docs/porting-notes.md`](docs/porting-notes.md)

## 目录结构

```
apps/countdown/
├── adep.config.ts        # 项目配置（name=countdown，functions_prefix=/api）
├── package.json          # 应用级脚本（dev / test / deploy / db:init …）
├── web/                  # 前端源码（Vue 3 + Vite，平台可独立构建）
│   ├── package.json      # 前端依赖（平台 bun install + vite build 使用）
│   ├── vite.config.ts    # vue() + adep() 全栈插件（一条命令起前端 + 模拟运行时）
│   └── src/
│       ├── lib/          # config / date / request / auth / device（移植自 utils/）
│       ├── ui/           # TabBar + Toast/Modal/ActionSheet（web 版 wx 组件）
│       └── views/        # HomeView / EditView / ProfileView（移植自 pages/）
├── functions/            # 云函数（移植自 cf-backend）
│   ├── auth.ts           # POST /auth/login、GET /auth/me
│   ├── events.ts         # 事件 CRUD（置顶/排序/分类过滤/200 上限）
│   ├── schema.sql        # 建表 DDL（adep db migrate 使用）
│   └── _shared/          # response / date / store / auth / route
└── docs/porting-notes.md # 移植映射与迁移决策
```

## 本地开发

前置：仓库根 `pnpm install` 已装好（apps/countdown 复用仓库根的依赖）。

```bash
# 一条命令起全部：vite(5173) + 进程内 adep dev 模拟运行时(8787)
# 前端 /api/* 由 vite 代理到模拟运行时，函数改动即热重载
cd apps/countdown
npm run dev          # 打开 http://127.0.0.1:5173
```

模拟运行时的数据库落在 `apps/countdown/.adep/sim/db.json`（sim 引擎访问自动建表，无需手动建表）。

### 常用脚本

| 命令                       | 作用                                                |
| -------------------------- | --------------------------------------------------- |
| `npm run dev`              | 本地全栈开发（vite + 模拟运行时，热重载）           |
| `npm run test`             | 运行函数/工具 vitest 测试                           |
| `npm run db:init`          | 平台侧启动项目数据库并应用 `functions/schema.sql`   |
| `npm run deploy`           | 全量发布到平台：函数 + 前端（含自动同步 web/ 源码） |
| `npm run deploy:functions` | 只发布云函数                                        |
| `npm run deploy:frontend`  | 只发布前端                                          |
| `npm run doctor`           | 环境自检                                            |

## 部署到本地 adep 平台

1. 平台已在本机 dev 运行（`http://adep.localhost:3001`），先用账号登录 CLI：
   ```bash
   adep login
   ```
2. 创建项目（幂等，已存在则跳过）：
   ```bash
   adep projects create countdown --name countdown
   ```
3. 初始化数据库并建表：
   ```bash
   npm run db:init
   ```
4. 发布（函数 + 前端）：
   ```bash
   npm run deploy
   ```
5. 访问 `http://countdown.adep.localhost:3001` 测试。

> 平台改进配套：CLI 新增 `adep frontend sync`（上传本地 `web/` 源码为平台前端草稿）
> 与 `adep db migrate <file>`（应用 schema.sql），`adep publish` 全量发布会自动执行。

## 与原始小程序的差异（有意为之）

| 小程序                 | web 移植                                   | 说明                                             |
| ---------------------- | ------------------------------------------ | ------------------------------------------------ |
| wx.login → openid      | 浏览器生成持久 `device_id`（localStorage） | 设备身份即账号，等价 API Key；无登录页，开箱即用 |
| JWT（server 签发）     | Bearer = device_id                         | 迁移说明见 docs/porting-notes.md                 |
| rpx 布局（750 设计稿） | rem（1rem = 100rpx）                       | 应用壳限宽 480px 手机式画布，视觉等比            |
| 下拉刷新（系统手势）   | 触摸下拉（pointer 事件实现）               | 桌面端也可用鼠标拖拽下拉                         |
| 系统导航栏             | 页面内渐变导航栏                           | 视觉对齐小程序                                   |
