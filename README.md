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
│       ├── lib/          # config / date / request / auth / events / oidc（OIDC 登录 + 数据层）
│       ├── ui/           # TabBar + Toast/Modal/ActionSheet（web 版 wx 组件）
│       └── views/        # HomeView / EditView / ProfileView + OidcCallbackView
├── functions/            # 云函数（移植自 cf-backend）
│   ├── auth.ts           # GET /auth/me（OIDC 身份优先，device 身份兼容）
│   ├── events.ts         # 事件 CRUD（置顶/排序/分类过滤/200 上限）
│   ├── schema.sql        # 建表 DDL（adep db migrate 使用）
│   └── _shared/          # response / date / store / auth / route
└── docs/porting-notes.md # 移植映射与迁移决策
```

## 本地开发

前置：Node.js >= 18。依赖全部来自 npm registry（无需 pnpm workspace / adep 平台）。

```bash
npm install

# 一条命令起全部：vite(5173) + 进程内 adep dev 模拟运行时(8787)
# 前端 /api/* 由 vite 代理到模拟运行时，函数改动即热重载
npm run dev          # 打开 http://127.0.0.1:5173
```

模拟运行时的数据库落在 `.adep/sim/db.json`（sim 引擎访问自动建表，无需手动建表）。

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

## 独立部署（Docker，不依赖 adep 平台）

工程自带 Docker 配置，可在任意装 Docker 的机器上自托管，无需 adep 平台。

**架构**：单容器 = `adep serve`（本地模拟运行时，与平台同源执行器）承载云函数
（`/api/*`）+ 静态托管前端（`web/dist` 挂到 `/`）+ 本地持久化（`.adep/sim/` 卷）。
启动时自动应用 `functions/schema.sql` 建表（IF NOT EXISTS 幂等），数据挂卷不丢。

```bash
# 构建并启动（默认 http://localhost:8787）
docker compose up -d --build

# 或手动运行
docker build -t countdown .
docker run -d --name countdown -p 8787:8787 -v countdown-data:/app/.adep countdown
```

| 文件                     | 作用                                        |
| ------------------------ | ------------------------------------------- |
| `Dockerfile`             | 多阶段构建：vite build 前端 → 运行时镜像    |
| `compose.yaml`           | 单实例编排 + 数据卷 + 健康检查（/healthz）  |
| `.dockerignore`          | 构建上下文忽略清单（防宿主产物/密钥进镜像） |
| `.env.example`           | 环境变量示例（复制为 `.env` 按需修改）      |

本地不装 Docker 也能跑（依赖已由 `npm install` 装好，`adep` 来自 devDependencies）：

```bash
npm run start   # = adep serve --host 0.0.0.0 --schema functions/schema.sql --static ./web/dist --spa
```

先 `npm run build` 生成 `web/dist` 再 `npm run start`，浏览器访问 `http://127.0.0.1:8787`。

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

## 接入平台登录（登录即服务）

登录走 **adep 平台三方登录（OIDC 授权码 + PKCE）**，而非本应用自建账号体系：

- 协议面全部走平台 OIDC 端点（`/.well-known/openid-configuration` 发现、`/oauth/register`
  动态客户端注册、`/oauth/token` 交换/刷新、`/oauth/revoke` 吊销），客户端逻辑见
  `web/src/lib/oidc.ts`（消费 SDK `@adep/auth-client`）。
- **数据双态**：未登录 → 存浏览器 localStorage（`web/src/lib/events.ts`），用户信息页显示
  [登录以同步数据]；登录后自动切云端，`OidcCallbackView` 回调时把本地数据并入云端（按
  title+target_date 去重，成功即清空本地）。
- **身份透传**：云函数从网关解析的 `ctx.user`（OIDC 身份，映射到本地 `oidc:<平台用户 id>`）
  或设备身份 `device_id` 双来源取用户（`functions/_shared/auth.ts`）。
- **回调白名单**：`http://127.0.0.1:{端口}/oauth/callback`（回环）与
  `http(s)://<app>.<平台域>/oauth/callback`（平台部署应用子域）均可（见平台 `oauth/store.ts`）。

### 本地开发

平台 dev 默认 `http://127.0.0.1:3000/api`（`web/src/lib/config.ts` 的 `AUTH_ISSUER` 缺省值），
`npm run dev` 开箱即可点 [登录以同步数据] 走完整授权流程。

### 生产部署

`VITE_AUTH_ISSUER` 指向平台部署域的 issuer（如 `https://auth.adep.example.com/api`），
且回调地址（`origin + /oauth/callback`）必须在平台 oauth 白名单内。

## 与原始小程序的差异（有意为之）

| 小程序                 | web 移植                                   | 说明                                             |
| ---------------------- | ------------------------------------------ | ------------------------------------------------ |
| wx.login → openid      | adep 平台 OIDC 三方登录（授权码 + PKCE）   | 登录即服务：复用平台账号，未登录回退本地存储     |
| JWT（server 签发）     | Bearer = OAuth access token（网关解析）    | 未登录时 device_id 兼容（旧数据不丢）            |
| rpx 布局（750 设计稿） | rem（1rem = 100rpx）                       | 应用壳限宽 480px 手机式画布，视觉等比            |
| 下拉刷新（系统手势）   | 触摸下拉（pointer 事件实现）               | 桌面端也可用鼠标拖拽下拉                         |
| 系统导航栏             | 页面内渐变导航栏                           | 视觉对齐小程序                                   |
