/**
 * OIDC 登录（登录即服务）：接入 adep 平台三方登录（授权码 + PKCE S256）。
 *
 * 协议面全部走平台 OIDC 端点（`AUTH_ISSUER/.well-known/openid-configuration` 发现、
 * `/oauth/register` 动态客户端注册、`/oauth/token` 交换/刷新、`/oauth/revoke` 吊销）。
 * 会话自管（localStorage）：SPA 刷新不丢；access token 过期自动刷新（轮换一次性语义）；
 * refresh 失效即清会话 → 回退未登录态（数据层切 localStorage，见 events.ts）。
 *
 * ⚠️ 不用 SDK 的 `restoreSession`：npm 已发布的 @adep/auth-client@0.2.2 未含该 API
 * （平台 publish frontend 从 registry 安装），故刷新在此自行实现（OIDC 标准端点，
 * discovery 文档经 SDK 拉取，本地缓存避免每请求一次）。
 */
import { createAuthClient, type AuthClient, type OidcDiscovery, type SessionState } from '@adep/auth-client'
import { AUTH_ISSUER } from './config'

/** 客户端注册信息缓存键（redirect_uri 变化时重新注册，幂等返回既有 client_id）。 */
const CLIENT_KEY = 'countdown_oidc_client'
/** 会话缓存键（access/refresh/id token + 过期时间 + userinfo）。 */
const SESSION_KEY = 'countdown_oidc_session'
/** 待回调的授权参数（PKCE verifier + state），sessionStorage（关标签页即失效）。 */
const PENDING_KEY = 'countdown_oidc_pending'
/** discovery 缓存键（SDK 实例内存缓存不够跨实例，这里落盘避免每次构造都拉）。 */
const DISCOVERY_KEY = 'countdown_oidc_discovery'
const DISCOVERY_TTL_MS = 5 * 60 * 1000

export interface OidcPending {
  state: string
  codeVerifier: string
}

export interface OidcDiscoveryCache {
  document: OidcDiscovery
  fetchedAt: number
}

/** 回调地址：SPA 同源路径（白名单三类回调之一：回环 / 平台应用子域，见 oauth/store.ts）。 */
export function getRedirectUri(): string {
  return `${window.location.origin}/oauth/callback`
}

function clientName(): string {
  return 'countdown-web'
}

// ---------- 客户端注册（RFC 7591 动态注册，公共客户端无 secret）----------

/** 取已注册 client_id；缺省动态注册并缓存（幂等，同 redirect_uris 命中既有）。 */
export async function ensureClientId(): Promise<string> {
  const cached = localStorage.getItem(CLIENT_KEY)
  if (cached && cached.length > 0) return cached

  const uri = getRedirectUri()
  const res = await fetch(`${AUTH_ISSUER.replace(/\/+$/, '')}/oauth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_name: clientName(), redirect_uris: [uri] }),
  })
  if (!res.ok) {
    throw new Error(`OAuth 客户端注册失败（HTTP ${res.status}），请确认平台已启动且回调在白名单内：${uri}`)
  }
  const data = (await res.json()) as { client_id?: string }
  if (typeof data.client_id !== 'string' || data.client_id.length === 0) {
    throw new Error('OAuth 客户端注册响应缺少 client_id')
  }
  localStorage.setItem(CLIENT_KEY, data.client_id)
  return data.client_id
}

// ---------- SDK 实例 ----------

async function authClient(): Promise<AuthClient> {
  const clientId = await ensureClientId()
  return createAuthClient({
    issuer: AUTH_ISSUER,
    clientId,
    redirectUri: getRedirectUri(),
    scopes: ['openid', 'profile', 'email'],
  })
}

/** discovery 文档（带落盘缓存；SDK 实例内存缓存不跨实例）。 */
async function getDiscoveryCached(): Promise<OidcDiscovery> {
  const cached = localStorage.getItem(DISCOVERY_KEY)
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as OidcDiscoveryCache
      if (Date.now() - parsed.fetchedAt < DISCOVERY_TTL_MS) return parsed.document
    } catch {
      /* 缓存损坏忽略 */
    }
  }
  const client = await authClient()
  const document = await client.getDiscovery()
  localStorage.setItem(
    DISCOVERY_KEY,
    JSON.stringify({ document, fetchedAt: Date.now() } satisfies OidcDiscoveryCache)
  )
  return document
}

// ---------- 会话 ----------

export function loadSession(): SessionState | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as SessionState) : null
  } catch {
    return null
  }
}

function saveSession(session: SessionState): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

function clearStoredSession(): void {
  localStorage.removeItem(SESSION_KEY)
}

/** 是否处于 OIDC 登录态（有持久化会话即视为已登录；token 有效性由请求时刷新兜底）。 */
export function hasSession(): boolean {
  return loadSession() !== null
}

/** 请求用的 Bearer token：会话存在且未过期 → 直接用；过期 → 刷新；均失败 → ''（未登录）。 */
export async function getRequestToken(): Promise<string> {
  const session = loadSession()
  if (session === null) return ''
  if (Date.now() < session.expiresAt) return session.accessToken
  try {
    const refreshed = await refreshAccessToken(session)
    saveSession(refreshed)
    return refreshed.accessToken
  } catch {
    // refresh 失效 / 网络异常：清会话回退未登录态（数据层切 localStorage），不阻塞请求。
    clearStoredSession()
    return ''
  }
}

/** 刷新 access token（轮换一次性语义：响应里的新 refresh 替换旧的）。 */
async function refreshAccessToken(session: SessionState): Promise<SessionState> {
  if (!session.refreshToken) throw new Error('无 refresh token')
  const discovery = await getDiscoveryCached()
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: session.refreshToken,
    client_id: (await ensureClientId()) as string,
  })
  const res = await fetch(discovery.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  if (!res.ok) throw new Error(`token 刷新失败（HTTP ${res.status}）`)
  const data = (await res.json()) as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
  }
  if (typeof data.access_token !== 'string') throw new Error('token 刷新响应缺少 access_token')
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? session.refreshToken,
    idToken: session.idToken,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
    userInfo: session.userInfo,
  }
}

/** 立即强制刷新（token 已被服务端吊销但本地未过期的场景；失败清会话返回 null）。 */
export async function forceRefreshToken(): Promise<string | null> {
  const session = loadSession()
  if (session === null) return null
  try {
    const refreshed = await refreshAccessToken(session)
    saveSession(refreshed)
    return refreshed.accessToken
  } catch {
    clearStoredSession()
    return null
  }
}

// ---------- 登录 / 回调 / 登出 ----------

/** 发起登录：构建授权 URL 并整页跳转平台授权页。 */
export async function startLogin(): Promise<void> {
  const client = await authClient()
  const result = await client.buildAuthorizeUrl()
  const pending: OidcPending = { state: result.state, codeVerifier: result.codeVerifier }
  sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending))
  window.location.href = result.url
}

/**
 * 处理授权回调（/oauth/callback?code=..&state=..）：校验 state → 换 token → 持久化会话。
 * 返回是否成功（失败=state 不匹配或交换失败，调用方提示并回退）。
 */
export async function handleOidcCallback(code: string, state: string): Promise<SessionState | null> {
  const raw = sessionStorage.getItem(PENDING_KEY)
  if (!raw) return null
  let pending: OidcPending
  try {
    pending = JSON.parse(raw) as OidcPending
  } catch {
    return null
  }
  sessionStorage.removeItem(PENDING_KEY)

  const client = await authClient()
  const session = await client.handleCallback(code, pending.codeVerifier, pending.state, state)
  saveSession(session)
  return session
}

/** 登出：本地清会话（可选回跳平台登出页；RP-Initiated Logout 依赖 id_token）。 */
export async function logout(options?: { performRpInitiatedLogout?: boolean }): Promise<string | null> {
  const session = loadSession()
  const doRp = options?.performRpInitiatedLogout ?? false
  clearStoredSession()
  if (!doRp || !session) return null
  const client = await authClient()
  return client.logout({
    performRpInitiatedLogout: true,
    ...(session.idToken ? { idTokenHint: session.idToken } : {}),
  })
}
