<script setup lang="ts">
// 首页：事件列表（移植自 pages/index/*）。
// 渐变头部 + 总数/下一个 + 分类筛选 + 左滑置顶/删除 + 长按菜单 + 下拉刷新 + 本地缓存秒开。
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { listEvents, updateEvent, deleteEvent } from '../lib/events'
import { decorateEvent, type CountdownEvent, type DecodedEvent } from '../lib/date'
import { CATEGORIES } from '../lib/config'
import { showToast, showModal, showActionSheet } from '../ui/ui'

const CACHE_KEY = 'events_cache'
const ACTION_RPX = 160 // 左滑露出的操作区宽度（rpx），运行时换算成 px

const router = useRouter()

const scrollEl = ref<HTMLElement | null>(null)

const data = reactive({
  loaded: false,
  list: [] as DecodedEvent[],
  allList: [] as DecodedEvent[],
  filters: [{ value: '', label: '全部' }].concat(CATEGORIES),
  activeFilter: '',
  total: 0,
  nextUp: null as null | { title: string; num: string; prefix: string; suffix: string },
  openIndex: -1,
})

const actionWidth = ref(1.6 * 64) // 1.6rem * 默认 64px；运行时按实际 font-size 校正

function applyList(raw: CountdownEvent[]): void {
  const all = raw.map(decorateEvent)
  const next = all.find((e) => e.direction !== 'countup' && e.days >= 0)
  const list = data.activeFilter ? all.filter((e) => e.category === data.activeFilter) : all
  data.allList = all
  data.list = list
  data.total = all.length
  data.openIndex = -1
  data.nextUp = next
    ? { title: next.title, num: next.num, prefix: next.prefix || '', suffix: next.suffix || '' }
    : null
}

async function loadEvents(force = false): Promise<void> {
  if (!force && data.loaded) {
    try {
      const cached = localStorage.getItem(CACHE_KEY)
      if (cached) {
        const parsed = JSON.parse(cached) as CountdownEvent[]
        if (parsed.length) applyList(parsed)
      }
    } catch {
      /* 缓存损坏忽略 */
    }
  }

  try {
    // 登录即服务：已登录读云端 / 未登录读 localStorage（events.ts 内部分发）。
    const events = await listEvents()
    localStorage.setItem(CACHE_KEY, JSON.stringify(events))
    applyList(events)
    data.loaded = true
  } catch (err) {
    console.warn('[index] 加载失败', err)
    data.loaded = true
    if (!data.allList.length) {
      showToast({ title: err instanceof Error ? err.message : '加载失败', icon: 'none' })
    }
  }
}

function onFilter(value: string): void {
  data.activeFilter = value
  applyList(data.allList)
}

// ---------- 卡片交互 ----------

/** 滑动状态（按卡片下标追踪）。 */
const swipe = reactive<{
  startX: number
  startY: number
  lastX: number
  touchIndex: number | undefined
  moved: boolean
  justSwiped: boolean
}>({ startX: 0, startY: 0, lastX: 0, touchIndex: undefined, moved: false, justSwiped: false })

let longPressTimer: ReturnType<typeof setTimeout> | null = null

function onCardPointerDown(event: PointerEvent, index: number): void {
  swipe.startX = event.clientX
  swipe.startY = event.clientY
  swipe.touchIndex = index
  swipe.moved = false
  swipe.lastX = data.list[index]?.offset ?? 0
  // 长按菜单
  clearLongPress()
  longPressTimer = setTimeout(() => {
    const item = data.list[index]
    if (!item) return
    void onLongPress(item)
  }, 600)
}

function onCardPointerMove(event: PointerEvent): void {
  if (swipe.touchIndex === undefined) return
  const dx = event.clientX - swipe.startX
  const dy = event.clientY - swipe.startY
  if (!swipe.moved && Math.abs(dy) > Math.abs(dx)) {
    // 纵向滚动意图：取消长按，不拦截
    clearLongPress()
    return
  }
  swipe.moved = true
  clearLongPress()

  const min = -actionWidth.value
  let x = (swipe.lastX ?? 0) + dx
  if (x > 0) x = 0
  if (x < min) x = min
  if (Math.abs(x - (swipe.lastX ?? 0)) < 2) return

  const idx = swipe.touchIndex
  const cur = data.list[idx]?.offset ?? 0
  if (Math.abs(x - cur) < 3) return
  data.list[idx] = { ...data.list[idx]!, offset: x }
}

function onCardPointerUp(): void {
  if (swipe.touchIndex === undefined) return
  clearLongPress()
  const idx = swipe.touchIndex
  const x = data.list[idx]?.offset ?? 0
  const open = x < -actionWidth.value / 2
  const target = open ? -actionWidth.value : 0

  // 同时只允许一个卡片滑开
  if (open && data.openIndex !== -1 && data.openIndex !== idx) {
    data.list[data.openIndex] = { ...data.list[data.openIndex]!, offset: 0 }
  }
  data.list[idx] = { ...data.list[idx]!, offset: target }
  data.openIndex = open ? idx : -1

  swipe.justSwiped = swipe.moved
  swipe.touchIndex = undefined
  swipe.moved = false
}

function onCardClick(index: number, id: string): void {
  if (swipe.justSwiped) {
    // 刚滑动完，这一下 click 不当作点击
    swipe.justSwiped = false
    return
  }
  if (data.openIndex !== -1) {
    closeAll()
    return
  }
  void router.push(`/edit/${id}`)
}

function closeAll(): void {
  data.list.forEach((item, i) => {
    if (item.offset !== 0) data.list[i] = { ...item, offset: 0 }
  })
  data.openIndex = -1
}

function clearLongPress(): void {
  if (longPressTimer !== null) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}

async function onTogglePin(id: string, pinned: boolean): Promise<void> {
  const next = !pinned
  try {
    await updateEvent(id, { is_pinned: next })
    showToast({ title: next ? '已置顶' : '已取消置顶', icon: 'none' })
    await loadEvents(true)
  } catch (err) {
    showToast({ title: err instanceof Error ? err.message : '操作失败', icon: 'none' })
  }
}

async function onDelete(id: string, title: string): Promise<void> {
  const ok = await showModal({
    title: '删除事件',
    content: `确定删除「${title}」吗？删除后不可恢复。`,
    confirmColor: '#FF5A5F',
    confirmText: '删除',
  })
  if (!ok) return
  try {
    await deleteEvent(id)
    showToast({ title: '已删除', icon: 'success' })
    await loadEvents(true)
  } catch (err) {
    showToast({ title: err instanceof Error ? err.message : '删除失败', icon: 'none' })
  }
}

async function onLongPress(item: DecodedEvent): Promise<void> {
  const index = await showActionSheet({
    itemList: [item.is_pinned ? '取消置顶' : '置顶', '删除'],
    itemColor: '#1F2430',
  })
  if (index === 0) {
    await onTogglePin(item.id, item.is_pinned)
  } else if (index === 1) {
    await onDelete(item.id, item.title)
  }
}

// ---------- 下拉刷新 ----------

const pull = reactive({
  distance: 0, // 下拉偏移 px
  state: 'idle' as 'idle' | 'pulling' | 'ready' | 'refreshing',
})

let pullStartY = 0
let pullTracking = false
let pullMoved = false

function onPullPointerDown(event: PointerEvent): void {
  if (pull.state === 'refreshing') return
  if ((scrollEl.value?.scrollTop ?? 0) <= 0) {
    pullStartY = event.clientY
    pullTracking = true
    pullMoved = false
  }
}

function onPullPointerMove(event: PointerEvent): void {
  if (!pullTracking || pull.state === 'refreshing') return
  const dy = event.clientY - pullStartY
  if (dy <= 0) return
  pullMoved = true
  event.preventDefault()
  pull.distance = Math.min(dy * 0.5, 90)
  pull.state = pull.distance > 50 ? 'ready' : 'pulling'
}

function onPullPointerUp(): void {
  if (!pullTracking) return
  pullTracking = false
  if (pull.state === 'ready') {
    pull.state = 'refreshing'
    pull.distance = 44
    void loadEvents(true).finally(() => {
      pull.state = 'idle'
      pull.distance = 0
    })
  } else if (pullMoved) {
    pull.state = 'idle'
    pull.distance = 0
  }
  pullMoved = false
}

// ---------- 生命周期 ----------

onMounted(() => {
  // 左滑操作区宽度按实际 font-size 换算（1.6rem）
  const root = scrollEl.value?.closest('.app') as HTMLElement | null
  if (root) {
    const fs = parseFloat(getComputedStyle(root).fontSize)
    if (Number.isFinite(fs) && fs > 0) actionWidth.value = (ACTION_RPX / 100) * fs
  }

  const el = scrollEl.value
  if (el) {
    // 下拉刷新监听（pointerdown 在 scrollTop=0 时启用，move 阶段 preventDefault 阻止原生滚动）
    el.addEventListener('pointerdown', onPullPointerDown, { passive: true })
    el.addEventListener('pointermove', onPullPointerMove, { passive: false })
    el.addEventListener('pointerup', onPullPointerUp)
    el.addEventListener('pointercancel', onPullPointerUp)
  }

  void loadEvents(false)
})

onUnmounted(() => {
  clearLongPress()
  const el = scrollEl.value
  if (el) {
    el.removeEventListener('pointerdown', onPullPointerDown)
    el.removeEventListener('pointermove', onPullPointerMove)
    el.removeEventListener('pointerup', onPullPointerUp)
    el.removeEventListener('pointercancel', onPullPointerUp)
  }
})

const pullLabel = computed(() => {
  if (pull.state === 'refreshing') return '正在刷新…'
  if (pull.state === 'ready') return '松开刷新'
  return '下拉刷新'
})
</script>

<template>
  <div class="page">
    <!-- 顶部蓝色渐变导航 -->
    <header class="header">
      <div class="nav">
        <span class="nav-title">倒数日</span>
      </div>
      <div class="summary">
        <div class="summary-left">
          <div class="summary-num">{{ data.total }}</div>
          <div class="summary-label">个重要日子</div>
        </div>
        <div class="summary-right" v-if="data.nextUp">
          <div class="summary-label">下一个</div>
          <div class="summary-next">
            <span class="next-title">{{ data.nextUp.title }}</span>
            <span class="next-days"
              >{{ data.nextUp.prefix }}{{ data.nextUp.num }}{{ data.nextUp.suffix }}</span
            >
          </div>
        </div>
      </div>
    </header>

    <!-- 内容区 -->
    <div ref="scrollEl" class="page-scroll body">
      <!-- 下拉刷新指示 -->
      <div class="pull-indicator" :style="{ height: pull.distance + 'px' }">
        <span class="pull-spinner" :class="{ spin: pull.state === 'refreshing' }"></span>
        <span class="pull-text">{{ pullLabel }}</span>
      </div>

      <!-- 分类筛选 -->
      <div v-if="data.total > 0" class="filters">
        <span
          v-for="f in data.filters"
          :key="f.value"
          class="chip"
          :class="{ 'chip-on': data.activeFilter === f.value }"
          @click="onFilter(f.value)"
        >
          {{ f.label }}
        </span>
      </div>

      <!-- 列表 -->
      <div v-if="data.list.length > 0" class="list no-select">
        <div v-for="(item, idx) in data.list" :key="item.id" class="card-row">
          <div class="card-actions">
            <span class="act act-pin" @click.stop="onTogglePin(item.id, item.is_pinned)">{{
              item.is_pinned ? '取消置顶' : '置顶'
            }}</span>
            <span class="act act-del" @click.stop="onDelete(item.id, item.title)">删除</span>
          </div>

          <div
            class="card"
            :style="{ transform: `translateX(${item.offset}px)`, touchAction: 'pan-y' }"
            @pointerdown="onCardPointerDown($event, idx)"
            @pointermove="onCardPointerMove($event)"
            @pointerup="onCardPointerUp"
            @pointercancel="onCardPointerUp"
            @click="onCardClick(idx, item.id)"
          >
            <div class="card-bar" :class="'level-' + item.level"></div>
            <div class="card-main">
              <div class="card-left">
                <div class="card-title">
                  <span class="title-text">{{ item.title }}</span>
                  <span v-if="item.is_pinned" class="pin-tag">置顶</span>
                </div>
                <div class="card-sub">{{ item.sub }} · {{ item.categoryLabel }}</div>
                <div v-if="item.note" class="card-note">{{ item.note }}</div>
              </div>
              <div class="card-right">
                <div class="days">
                  <span v-if="item.prefix" class="days-prefix">{{ item.prefix }}</span>
                  <span class="days-num" :class="'level-' + item.level">{{ item.num }}</span>
                  <span v-if="item.suffix" class="days-unit">{{ item.suffix }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 空态 -->
      <div v-if="data.loaded && data.list.length === 0" class="empty">
        <div class="empty-icon">
          <div class="empty-bar"></div>
          <div class="empty-dot"></div>
        </div>
        <div class="empty-title">{{ data.total > 0 ? '该分类下还没有事件' : '还没有倒数日' }}</div>
        <div class="empty-tip">
          {{ data.total > 0 ? '换个分类看看，或添加一个新的' : '点击下方 + 记录第一个重要日子' }}
        </div>
        <div class="empty-btn" @click="router.push('/edit')">立即添加</div>
      </div>

      <div v-if="data.list.length > 0" class="foot-tip">左滑卡片可置顶 / 删除，长按也有菜单</div>
    </div>
  </div>
</template>

<style scoped>
.page {
  height: 100%;
  padding-bottom: calc(1.6rem + env(safe-area-inset-bottom));
}

/* ---------- 顶部渐变导航 ---------- */
.header {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10;
  background: linear-gradient(135deg, #3b6ef6, #6a8dff);
  border-bottom-left-radius: 0.4rem;
  border-bottom-right-radius: 0.4rem;
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

.summary {
  height: 1.76rem;
  padding: 0 0.4rem 0.28rem;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
}

.summary-num {
  color: #ffffff;
  font-size: 0.66rem;
  font-weight: 700;
  line-height: 1;
}

.summary-label {
  color: rgba(255, 255, 255, 0.82);
  font-size: 0.24rem;
  margin-top: 0.12rem;
}

.summary-right {
  text-align: right;
  max-width: 46%;
}

.summary-next {
  margin-top: 0.08rem;
  color: #ffffff;
  font-size: 0.28rem;
}

.next-title {
  opacity: 0.9;
  margin-right: 0.12rem;
}

.next-days {
  font-weight: 600;
}

/* ---------- 内容区 ---------- */
.body {
  padding-top: 2.64rem;
  padding-bottom: 0.4rem;
}

/* 下拉刷新 */
.pull-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.12rem;
  overflow: hidden;
  color: #9aa3b2;
  font-size: 0.24rem;
}

.pull-spinner {
  width: 0.28rem;
  height: 0.28rem;
  border-radius: 50%;
  border: 0.04rem solid #d7dbe4;
  border-top-color: #3b6ef6;
}

.pull-spinner.spin {
  animation: pull-spin 0.8s linear infinite;
}

@keyframes pull-spin {
  to {
    transform: rotate(360deg);
  }
}

/* ---------- 分类筛选 ---------- */
.filters {
  white-space: nowrap;
  padding: 0.24rem 0 0.04rem;
  overflow-x: auto;
  scrollbar-width: none;
}

.filters::-webkit-scrollbar {
  display: none;
}

.chip {
  display: inline-block;
  padding: 0.12rem 0.28rem;
  margin-right: 0.16rem;
  background: #ffffff;
  border-radius: 999rem;
  font-size: 0.26rem;
  color: #6b7385;
  cursor: pointer;
  user-select: none;
}

.chip:first-child {
  margin-left: 0.32rem;
}

.chip:last-child {
  margin-right: 0.32rem;
}

.chip-on {
  background: linear-gradient(135deg, #3b6ef6, #6a8dff);
  color: #ffffff;
}

/* ---------- 卡片 ---------- */
.list {
  padding: 0.16rem 0.32rem 0;
}

.card-row {
  position: relative;
  margin-bottom: 0.24rem;
  border-radius: 0.2rem;
  overflow: hidden;
}

.card-actions {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 1.6rem;
  display: flex;
}

.act {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-size: 0.26rem;
  cursor: pointer;
}

.act-pin {
  background: #8a94a6;
}

.act-del {
  background: #ff5a5f;
}

.card {
  position: relative;
  z-index: 2;
  background: #ffffff;
  border-radius: 0.2rem;
  box-shadow: 0 0.08rem 0.24rem rgba(31, 36, 48, 0.06);
  transition: transform 0.22s ease;
  cursor: pointer;
}

.card-bar {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 0.08rem;
  border-radius: 0.2rem 0 0 0.2rem;
}

.card-main {
  display: flex;
  align-items: center;
  padding: 0.32rem 0.28rem 0.32rem 0.36rem;
  min-height: 1.4rem;
}

.card-left {
  flex: 1;
  min-width: 0;
}

.card-title {
  display: flex;
  align-items: center;
}

.title-text {
  font-size: 0.32rem;
  font-weight: 600;
  color: #1f2430;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pin-tag {
  margin-left: 0.12rem;
  font-size: 0.2rem;
  color: #3b6ef6;
  background: rgba(59, 110, 246, 0.1);
  padding: 0.04rem 0.1rem;
  border-radius: 0.06rem;
  flex-shrink: 0;
}

.card-sub {
  margin-top: 0.12rem;
  font-size: 0.24rem;
  color: #9aa3b2;
}

.card-note {
  margin-top: 0.1rem;
  font-size: 0.24rem;
  color: #6b7385;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-right {
  margin-left: 0.2rem;
  display: flex;
  align-items: baseline;
}

.days {
  display: flex;
  align-items: baseline;
}

.days-num {
  font-size: 0.58rem;
  font-weight: 700;
  line-height: 1;
}

.days-prefix {
  font-size: 0.22rem;
  margin-right: 0.06rem;
}

.days-unit {
  font-size: 0.24rem;
  margin-left: 0.04rem;
}

.level-normal {
  color: #3b6ef6;
}
.level-soon {
  color: #ff9f43;
}
.level-urgent {
  color: #ff5a5f;
}
.level-today {
  color: #ff5a5f;
}
.level-past {
  color: #a0a8b8;
}

.card-bar.level-normal {
  background: #3b6ef6;
}
.card-bar.level-soon {
  background: #ff9f43;
}
.card-bar.level-urgent {
  background: #ff5a5f;
}
.card-bar.level-today {
  background: #ff5a5f;
}
.card-bar.level-past {
  background: #d7dbe4;
}

/* ---------- 空态 ---------- */
.empty {
  padding: 1.2rem 0.6rem 0;
  text-align: center;
}

.empty-icon {
  width: 1.4rem;
  height: 1.4rem;
  border-radius: 50%;
  background: linear-gradient(135deg, #e8eeff, #f3f6ff);
  margin: 0 auto 0.32rem;
  position: relative;
}

.empty-bar {
  position: absolute;
  left: 0.4rem;
  top: 0.66rem;
  width: 0.6rem;
  height: 0.08rem;
  background: #c7d4ff;
  border-radius: 0.04rem;
}

.empty-dot {
  position: absolute;
  right: 0.36rem;
  top: 0.52rem;
  width: 0.18rem;
  height: 0.18rem;
  border-radius: 50%;
  background: #ff9f43;
}

.empty-title {
  font-size: 0.32rem;
  color: #1f2430;
  font-weight: 600;
}

.empty-tip {
  margin-top: 0.12rem;
  font-size: 0.26rem;
  color: #9aa3b2;
}

.empty-btn {
  margin: 0.4rem auto 0;
  width: 2.8rem;
  height: 0.8rem;
  line-height: 0.8rem;
  border-radius: 999rem;
  background: linear-gradient(135deg, #3b6ef6, #6a8dff);
  color: #ffffff;
  font-size: 0.28rem;
  box-shadow: 0 0.1rem 0.24rem rgba(59, 110, 246, 0.28);
  cursor: pointer;
}

.foot-tip {
  text-align: center;
  color: #b4bac6;
  font-size: 0.22rem;
  padding: 0.2rem 0 0.08rem;
}
</style>
