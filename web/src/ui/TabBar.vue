<script setup lang="ts">
// 自定义 TabBar（移植自 custom-tab-bar/index.*）：首页 / ＋（新增）/ 我的。
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const tabs = [
  { path: '/', text: '首页' },
  { path: '/profile', text: '我的' },
]

function selectedIndex(): number {
  const path = route.path
  if (path.startsWith('/profile')) return 1
  return 0
}

function switchTab(path: string): void {
  if (route.path === path) return
  router.push(path)
}

function onAdd(): void {
  router.push('/edit')
}
</script>

<template>
  <div class="tabbar">
    <div class="tabbar-inner">
      <div class="tab" :class="{ on: selectedIndex() === 0 }" @click="switchTab('/')">
        <svg
          class="icon"
          viewBox="0 0 24 24"
          fill="none"
          :stroke="selectedIndex() === 0 ? '#3B6EF6' : '#9AA3B2'"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M3 10.4 12 3.5l9 6.9" />
          <path d="M5.5 9.6V20a1 1 0 0 0 1 1H10v-5h4v5h3.5a1 1 0 0 0 1-1V9.6" />
        </svg>
        <span class="tab-text">首页</span>
      </div>

      <div class="plus-wrap" @click="onAdd">
        <div class="plus">
          <div class="bar bar-h"></div>
          <div class="bar bar-v"></div>
        </div>
      </div>

      <div class="tab" :class="{ on: selectedIndex() === 1 }" @click="switchTab('/profile')">
        <svg
          class="icon"
          viewBox="0 0 24 24"
          fill="none"
          :stroke="selectedIndex() === 1 ? '#3B6EF6' : '#9AA3B2'"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="8" r="3.6" />
          <path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" />
        </svg>
        <span class="tab-text">我的</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tabbar {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 999;
  background: #ffffff;
  box-shadow: 0 -0.04rem 0.2rem rgba(31, 36, 48, 0.06);
  padding-bottom: env(safe-area-inset-bottom);
}

.tabbar-inner {
  height: 1rem;
  display: flex;
  align-items: center;
  position: relative;
}

.tab {
  flex: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.tab-text {
  margin-top: 0.04rem;
  font-size: 0.22rem;
  color: #9aa3b2;
  line-height: 1;
}

.tab.on .tab-text {
  color: #3b6ef6;
  font-weight: 500;
}

.icon {
  width: 0.44rem;
  height: 0.44rem;
}

.plus-wrap {
  width: 1.2rem;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.plus {
  width: 0.92rem;
  height: 0.92rem;
  margin-top: -0.34rem;
  border-radius: 50%;
  background: linear-gradient(135deg, #3b6ef6, #6a8dff);
  box-shadow: 0 0.08rem 0.2rem rgba(59, 110, 246, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  cursor: pointer;
  transition: transform 0.12s ease;
}

.plus:active {
  transform: scale(0.94);
}

.bar {
  position: absolute;
  background: #ffffff;
  border-radius: 0.04rem;
}

.bar-h {
  width: 0.36rem;
  height: 0.06rem;
}

.bar-v {
  width: 0.06rem;
  height: 0.36rem;
}
</style>
