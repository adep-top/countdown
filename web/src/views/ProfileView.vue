<script setup lang="ts">
// 我的（移植自 pages/profile/*）。
// 登录即服务：未登录 → 用户卡片 + [登录以同步数据]（数据在 localStorage，见 events.ts）；
// 已登录 → 云端用户信息 + 分类统计 + 退出登录。
import { computed, onMounted, reactive } from 'vue'
import { request } from '../lib/request'
import { ensureLogin, getUser, logout, isLoggedIn } from '../lib/auth'
import { startLogin } from '../lib/oidc'
import { listEvents } from '../lib/events'
import { CATEGORY_LABEL } from '../lib/config'
import { showModal, showToast } from '../ui/ui'

const CACHE_KEY = 'events_cache'
const VERSION = '1.0.0'

const data = reactive({
  user: null as null | {
    id: string
    nickname: string
    avatar_url: string
    created_at: string
  },
  eventCount: 0,
  maxEvents: 200,
  stats: [] as Array<{ label: string; value: number }>,
})

const loggedIn = computed(() => isLoggedIn())

const apiHost = computed(() => {
  const url = new URL(window.location.href)
  return url.host || ''
})

function formatCreatedAt(raw: string | undefined): string {
  if (!raw) return ''
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

async function loadStats(): Promise<void> {
  data.user = getUser()
  if (!isLoggedIn()) {
    // 未登录：数据在 localStorage，不请求云端；展示本地事件数。
    const local = await listEvents()
    data.eventCount = local.length
    data.maxEvents = 200
    data.stats = []
    return
  }
  try {
    await ensureLogin()
    const [me, events] = await Promise.all([
      request<{
        user: { id: string; nickname: string; avatar_url: string; created_at: string }
        event_count: number
        max_events: number
      }>('/api/auth/me', { retry: false }),
      listEvents(),
    ])
    const counter: Record<string, number> = {}
    events.forEach((e) => {
      const key = e.category || 'other'
      counter[key] = (counter[key] ?? 0) + 1
    })
    const stats = Object.keys(counter).map((k) => ({
      label: CATEGORY_LABEL[k] ?? '日常',
      value: counter[k] as number,
    }))
    data.user = me.user
    data.eventCount = me.event_count
    data.maxEvents = me.max_events
    data.stats = stats
  } catch (err) {
    console.warn('[profile] 加载失败', err)
  }
}

/** 登录：整页跳平台授权页（回调回 /profile 后自动同步本地数据）。 */
function onLogin(): void {
  void startLogin().catch((err: unknown) => {
    showToast({ title: err instanceof Error ? err.message : '登录失败', icon: 'none' })
  })
}

async function onClearCache(): Promise<void> {
  const ok = await showModal({
    title: '清空本地缓存',
    content: '只会清除本机的临时缓存，云端数据不受影响。',
    confirmText: '清空',
  })
  if (!ok) return
  localStorage.removeItem(CACHE_KEY)
  showToast({ title: '已清空', icon: 'success' })
}

async function onLogout(): Promise<void> {
  const ok = await showModal({
    title: '退出登录',
    content: '退出后本机登录状态将被清除；未登录期间数据保存在本机浏览器。',
    confirmText: '退出',
  })
  if (!ok) return
  logout()
  localStorage.removeItem(CACHE_KEY)
  showToast({ title: '已退出', icon: 'success' })
  setTimeout(() => {
    window.location.href = '/profile'
  }, 400)
}

async function onCopyHost(): Promise<void> {
  try {
    await navigator.clipboard.writeText(apiHost.value)
    showToast({ title: '已复制', icon: 'success' })
  } catch {
    showToast({ title: '复制失败', icon: 'none' })
  }
}

onMounted(() => {
  void loadStats()
})
</script>

<template>
  <div class="page">
    <header class="header">
      <div class="nav">
        <span class="nav-title">我的</span>
      </div>

      <div class="user-card">
        <div class="avatar">
          <span class="avatar-text">日</span>
        </div>
        <div class="user-info">
          <div class="user-name">{{ data.user?.nickname || '本地用户' }}</div>
          <div v-if="data.user?.created_at" class="user-meta">
            注册于 {{ formatCreatedAt(data.user.created_at) }}
          </div>
          <div v-else-if="!loggedIn" class="user-meta">数据仅保存在本机浏览器</div>
        </div>
        <div class="user-count">
          <div class="count-num">{{ data.eventCount }}</div>
          <div class="count-label">/ {{ data.maxEvents }} 个</div>
        </div>
      </div>
    </header>

    <div class="page-scroll body">
      <!-- 未登录：引导登录（登录后回调自动同步本地数据到云端） -->
      <div v-if="!loggedIn" class="login-banner">
        <button class="login-btn" @click="onLogin">登录以同步数据</button>
        <div class="login-tip">登录 adep 账号后，本机数据将同步到云端</div>
      </div>

      <div v-if="data.stats.length > 0" class="panel">
        <div class="panel-title">分类统计</div>
        <div class="stats">
          <div v-for="stat in data.stats" :key="stat.label" class="stat">
            <div class="stat-num">{{ stat.value }}</div>
            <div class="stat-label">{{ stat.label }}</div>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="cell" @click="onClearCache">
          <span class="cell-title">清空本地缓存</span>
          <span class="arrow">›</span>
        </div>
        <div class="cell" @click="onCopyHost">
          <span class="cell-title">服务地址</span>
          <span class="cell-value">{{ apiHost }}</span>
        </div>
        <div class="cell">
          <span class="cell-title">版本</span>
          <span class="cell-value">v{{ VERSION }}</span>
        </div>
      </div>

      <div class="tips">
        <div class="tips-title">数据存储说明</div>
        <div class="tips-text">
          未登录时事件保存在本机浏览器（localStorage）；登录 adep 账号后自动同步到云端，
          换设备登录同一账号即可继续查看。清缓存不会丢失云端数据。
        </div>
      </div>

      <button v-if="loggedIn" class="logout" @click="onLogout">退出登录</button>
    </div>
  </div>
</template>

<style scoped>
.page {
  height: 100%;
  padding-bottom: calc(1.8rem + env(safe-area-inset-bottom));
}

.header {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10;
  background: linear-gradient(135deg, #3b6ef6, #6a8dff);
  border-bottom-left-radius: 0.4rem;
  border-bottom-right-radius: 0.4rem;
  padding-bottom: 0.28rem;
}

.nav {
  display: flex;
  align-items: center;
  height: 0.88rem;
  padding-left: 0.4rem;
}

.nav-title {
  color: #ffffff;
  font-size: 0.36rem;
  font-weight: 600;
}

.user-card {
  margin: 0.08rem 0.32rem 0;
  padding: 0.32rem;
  background: rgba(255, 255, 255, 0.16);
  border-radius: 0.24rem;
  display: flex;
  align-items: center;
}

.avatar {
  width: 1.04rem;
  height: 1.04rem;
  border-radius: 50%;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.avatar-text {
  color: #3b6ef6;
  font-size: 0.4rem;
  font-weight: 600;
}

.user-info {
  flex: 1;
  margin-left: 0.24rem;
  min-width: 0;
}

.user-name {
  color: #ffffff;
  font-size: 0.32rem;
  font-weight: 600;
}

.user-meta {
  margin-top: 0.1rem;
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.24rem;
}

.user-count {
  text-align: right;
  flex-shrink: 0;
}

.count-num {
  color: #ffffff;
  font-size: 0.44rem;
  font-weight: 700;
  line-height: 1;
}

.count-label {
  margin-top: 0.08rem;
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.22rem;
}

.body {
  padding: 3.2rem 0.32rem 0;
}

.panel {
  background: #ffffff;
  border-radius: 0.24rem;
  padding: 0.08rem 0.32rem;
  margin-bottom: 0.24rem;
  box-shadow: 0 0.08rem 0.24rem rgba(31, 36, 48, 0.05);
}

.panel-title {
  padding: 0.24rem 0 0.08rem;
  font-size: 0.26rem;
  color: #9aa3b2;
}

.stats {
  display: flex;
  flex-wrap: wrap;
  padding-bottom: 0.2rem;
}

.stat {
  width: 25%;
  text-align: center;
  padding: 0.16rem 0;
}

.stat-num {
  font-size: 0.4rem;
  font-weight: 700;
  color: #3b6ef6;
}

.stat-label {
  margin-top: 0.08rem;
  font-size: 0.22rem;
  color: #9aa3b2;
}

.cell {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.3rem 0;
  border-bottom: 1px solid #f0f2f7;
  cursor: pointer;
}

.cell:last-child {
  border-bottom: none;
}

.cell-title {
  font-size: 0.28rem;
  color: #1f2430;
}

.cell-value {
  font-size: 0.26rem;
  color: #9aa3b2;
  max-width: 52%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.arrow {
  color: #c4c9d4;
  font-size: 0.36rem;
}

.tips {
  padding: 0.08rem 0.08rem 0.32rem;
}

.tips-title {
  font-size: 0.26rem;
  color: #6b7385;
  font-weight: 500;
}

.tips-text {
  margin-top: 0.12rem;
  font-size: 0.24rem;
  color: #a0a8b8;
  line-height: 1.7;
}

.logout {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 0.92rem;
  background: #ffffff;
  color: #ff5a5f;
  font-size: 0.3rem;
  border-radius: 999rem;
  border: 1px solid #ffd9da;
  cursor: pointer;
}

.login-banner {
  background: #ffffff;
  border-radius: 0.24rem;
  padding: 0.32rem;
  margin-bottom: 0.24rem;
  text-align: center;
  box-shadow: 0 0.08rem 0.24rem rgba(31, 36, 48, 0.05);
}

.login-btn {
  width: 100%;
  height: 0.92rem;
  background: linear-gradient(135deg, #3b6ef6, #6a8dff);
  color: #ffffff;
  font-size: 0.3rem;
  font-weight: 600;
  border-radius: 999rem;
  border: none;
  box-shadow: 0 0.1rem 0.24rem rgba(59, 110, 246, 0.28);
  cursor: pointer;
}

.login-tip {
  margin-top: 0.16rem;
  font-size: 0.24rem;
  color: #9aa3b2;
}
</style>
