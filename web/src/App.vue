<script setup lang="ts">
// 应用根：路由视图 + 底部 TabBar（首页/我的显示，编辑页隐藏）+ 浮层宿主。
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import TabBar from './ui/TabBar.vue'
import UiHost from './ui/UiHost.vue'

const route = useRoute()

const showTabBar = computed(() => {
  return !route.path.startsWith('/edit')
})
</script>

<template>
  <div class="app">
    <router-view />
    <TabBar v-if="showTabBar" />
    <UiHost />
  </div>
</template>

<style>
@import './styles/app.css';
</style>
