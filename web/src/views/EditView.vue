<script setup lang="ts">
// 添加 / 编辑事件（移植自 pages/edit/*）。
// 实时天数预览 + 表单（名称/日期/分类/计时方式/备注/置顶）+ 保存/删除。
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getEvent, createEvent, updateEvent, deleteEvent } from '../lib/events'
import { calcDays, daysText, levelOf, isValidDate, todayStr, weekdayOf } from '../lib/date'
import { CATEGORIES, CATEGORY_LABEL } from '../lib/config'
import { showToast, showModal } from '../ui/ui'

const route = useRoute()
const router = useRouter()

const id = typeof route.params.id === 'string' ? route.params.id : ''
const isEdit = !!id

const form = reactive({
  title: '',
  target_date: todayStr(),
  note: '',
  category: 'other',
  direction: 'countdown' as 'countdown' | 'countup',
  is_pinned: false,
})

const categoryIndex = ref(0)
const dateStart = '1900-01-01'
const dateEnd = '2100-12-31'
const submitting = ref(false)
const deleting = ref(false)

const preview = computed(() => {
  if (!isValidDate(form.target_date)) return null
  const days = calcDays(form.target_date, form.direction)
  const t = daysText(days, form.direction)
  return {
    level: levelOf(days, form.direction),
    text: `${t.prefix}${t.num}${t.suffix}`,
    sub: `${form.target_date} ${weekdayOf(form.target_date)} · ${CATEGORY_LABEL[form.category] ?? '日常'}`,
  }
})

async function loadEvent(): Promise<void> {
  if (!id) return
  try {
    const e = await getEvent(id)
    if (!e) {
      showToast({ title: '事件不存在', icon: 'none' })
      setTimeout(() => router.back(), 800)
      return
    }
    const idx = Math.max(
      0,
      CATEGORIES.findIndex((c) => c.value === e.category)
    )
    form.title = e.title
    form.target_date = e.target_date
    form.note = e.note || ''
    form.category = e.category || 'other'
    form.direction = e.direction || 'countdown'
    form.is_pinned = !!e.is_pinned
    categoryIndex.value = idx
  } catch (err) {
    showToast({ title: err instanceof Error ? err.message : '加载失败', icon: 'none' })
    setTimeout(() => router.back(), 800)
  }
}

if (id) void loadEvent()

async function onSave(): Promise<void> {
  if (submitting.value) return
  const title = form.title.trim()

  if (!title) {
    showToast({ title: '请填写事件名称', icon: 'none' })
    return
  }
  if (title.length > 50) {
    showToast({ title: '名称不能超过 50 个字', icon: 'none' })
    return
  }
  if (!isValidDate(form.target_date)) {
    showToast({ title: '请选择目标日期', icon: 'none' })
    return
  }
  if (form.note.length > 200) {
    showToast({ title: '备注不能超过 200 个字', icon: 'none' })
    return
  }

  const payload = {
    title,
    target_date: form.target_date,
    note: form.note.trim(),
    category: form.category,
    direction: form.direction,
    is_pinned: !!form.is_pinned,
  }

  submitting.value = true
  try {
    if (isEdit) {
      await updateEvent(id, payload)
    } else {
      await createEvent(payload)
    }
    showToast({ title: isEdit ? '已保存' : '已添加', icon: 'success' })
    setTimeout(() => router.back(), 600)
  } catch (err) {
    submitting.value = false
    showToast({ title: err instanceof Error ? err.message : '保存失败', icon: 'none' })
  }
}

async function onDelete(): Promise<void> {
  if (!id || deleting.value) return
  const ok = await showModal({
    title: '删除事件',
    content: `确定删除「${form.title}」吗？删除后不可恢复。`,
    confirmColor: '#FF5A5F',
    confirmText: '删除',
  })
  if (!ok) return
  deleting.value = true
  try {
    await deleteEvent(id)
    showToast({ title: '已删除', icon: 'success' })
    setTimeout(() => router.back(), 600)
  } catch (err) {
    deleting.value = false
    showToast({ title: err instanceof Error ? err.message : '删除失败', icon: 'none' })
  }
}

function goBack(): void {
  router.back()
}
</script>

<template>
  <div class="page">
    <!-- 顶部导航（web 版原生导航栏） -->
    <header class="nav">
      <button class="nav-back" @click="goBack">‹</button>
      <span class="nav-title">{{ isEdit ? '编辑事件' : '添加事件' }}</span>
      <span class="nav-side"></span>
    </header>

    <div class="page-scroll">
      <!-- 实时预览 -->
      <div v-if="preview" class="preview" :class="'level-' + preview.level">
        <div class="pv-text">{{ preview.text }}</div>
        <div class="pv-sub">{{ preview.sub }}</div>
      </div>

      <div class="form">
        <div class="group">
          <div class="label">事件名称</div>
          <input class="input" v-model="form.title" placeholder="例如：小明的生日" maxlength="50" />
        </div>

        <div class="group">
          <div class="label">目标日期</div>
          <input
            class="input picker-input"
            type="date"
            v-model="form.target_date"
            :min="dateStart"
            :max="dateEnd"
          />
        </div>

        <div class="group">
          <div class="label">分类</div>
          <div class="picker">
            <select v-model="form.category" class="picker-select">
              <option v-for="c in CATEGORIES" :key="c.value" :value="c.value">{{ c.label }}</option>
            </select>
            <span class="arrow">›</span>
          </div>
        </div>

        <div class="group">
          <div class="label">计时方式</div>
          <div class="radio-group">
            <label
              class="radio"
              :class="{ on: form.direction === 'countdown' }"
              @click="form.direction = 'countdown'"
            >
              <span class="radio-dot" :class="{ checked: form.direction === 'countdown' }"></span>
              <span>倒数日</span>
            </label>
            <label
              class="radio"
              :class="{ on: form.direction === 'countup' }"
              @click="form.direction = 'countup'"
            >
              <span class="radio-dot" :class="{ checked: form.direction === 'countup' }"></span>
              <span>正数日</span>
            </label>
          </div>
          <div class="hint">倒数日 = 距离目标还有多少天；正数日 = 从那天起已经过了多少天</div>
        </div>

        <div class="group">
          <div class="label">备注 <span class="opt">选填</span></div>
          <textarea
            class="textarea"
            v-model="form.note"
            placeholder="写点什么…"
            maxlength="200"
            rows="3"
          />
          <div class="counter">{{ form.note.length }}/200</div>
        </div>

        <div class="group group-row">
          <div>
            <div class="label">置顶显示</div>
            <div class="hint">置顶的事件排在列表最前面</div>
          </div>
          <button
            class="switch"
            :class="{ on: form.is_pinned }"
            @click="form.is_pinned = !form.is_pinned"
          >
            <span class="switch-knob"></span>
          </button>
        </div>
      </div>

      <div class="footer">
        <button class="btn btn-save" :disabled="submitting" @click="onSave">
          {{ submitting ? '保存中…' : isEdit ? '保存修改' : '创建事件' }}
        </button>
        <button v-if="isEdit" class="btn btn-del" :disabled="deleting" @click="onDelete">
          {{ deleting ? '删除中…' : '删除事件' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  height: 100%;
  padding-bottom: calc(0.6rem + env(safe-area-inset-bottom));
}

.nav {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10;
  height: 0.88rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(135deg, #3b6ef6, #6a8dff);
  padding: 0 0.2rem;
}

.nav-back {
  width: 0.72rem;
  height: 100%;
  color: #ffffff;
  font-size: 0.56rem;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
}

.nav-title {
  color: #ffffff;
  font-size: 0.34rem;
  font-weight: 600;
}

.nav-side {
  width: 0.72rem;
}

.page-scroll {
  padding-top: 0.88rem;
}

/* ---------- 预览 ---------- */
.preview {
  margin: 0.24rem 0.32rem 0.08rem;
  padding: 0.36rem 0.4rem;
  border-radius: 0.24rem;
  background: linear-gradient(135deg, #3b6ef6, #6a8dff);
  box-shadow: 0 0.12rem 0.28rem rgba(59, 110, 246, 0.24);
  text-align: center;
}

.preview.level-past {
  background: linear-gradient(135deg, #a0a8b8, #b9c0cc);
  box-shadow: 0 0.12rem 0.28rem rgba(160, 168, 184, 0.24);
}

.pv-text {
  display: block;
  color: #ffffff;
  font-size: 0.56rem;
  font-weight: 700;
  line-height: 1.2;
}

.pv-sub {
  display: block;
  margin-top: 0.12rem;
  color: rgba(255, 255, 255, 0.85);
  font-size: 0.24rem;
}

/* ---------- 表单 ---------- */
.form {
  margin: 0.24rem 0.32rem 0;
  background: #ffffff;
  border-radius: 0.24rem;
  padding: 0.08rem 0.32rem;
  box-shadow: 0 0.08rem 0.24rem rgba(31, 36, 48, 0.05);
}

.group {
  padding: 0.28rem 0;
  border-bottom: 1px solid #f0f2f7;
}

.group:last-child {
  border-bottom: none;
}

.group-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.label {
  font-size: 0.28rem;
  color: #1f2430;
  font-weight: 500;
  margin-bottom: 0.16rem;
}

.group-row .label {
  margin-bottom: 0.08rem;
}

.opt {
  font-size: 0.22rem;
  color: #b4bac6;
  font-weight: 400;
}

.input,
.textarea {
  width: 100%;
  font-size: 0.3rem;
  color: #1f2430;
}

.input::placeholder,
.textarea::placeholder {
  color: #b4bac6;
}

.textarea {
  min-height: 0.8rem;
  line-height: 1.6;
  resize: none;
}

.picker-input {
  cursor: pointer;
}

.picker {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.3rem;
  color: #1f2430;
  position: relative;
}

.picker-select {
  width: 100%;
  font-size: 0.3rem;
  color: #1f2430;
  appearance: none;
  -webkit-appearance: none;
  background: transparent;
  cursor: pointer;
  padding: 0.06rem 0;
}

.arrow {
  color: #c4c9d4;
  font-size: 0.36rem;
  pointer-events: none;
  position: absolute;
  right: 0;
}

.radio-group {
  display: flex;
}

.radio {
  display: flex;
  align-items: center;
  margin-right: 0.48rem;
  padding: 0.12rem 0.24rem;
  border-radius: 999rem;
  background: #f5f7fb;
  font-size: 0.28rem;
  color: #6b7385;
  cursor: pointer;
  user-select: none;
}

.radio.on {
  background: rgba(59, 110, 246, 0.1);
  color: #3b6ef6;
}

.radio-dot {
  width: 0.32rem;
  height: 0.32rem;
  border-radius: 50%;
  border: 2px solid #c4c9d4;
  margin-right: 0.08rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.radio-dot.checked {
  border-color: #3b6ef6;
}

.radio-dot.checked::after {
  content: '';
  width: 0.14rem;
  height: 0.14rem;
  border-radius: 50%;
  background: #3b6ef6;
}

.hint {
  margin-top: 0.14rem;
  font-size: 0.22rem;
  color: #b4bac6;
  line-height: 1.5;
}

.counter {
  margin-top: 0.08rem;
  text-align: right;
  font-size: 0.22rem;
  color: #c4c9d4;
}

/* 开关（移植 wx switch） */
.switch {
  width: 0.96rem;
  height: 0.56rem;
  border-radius: 999rem;
  background: #e2e4ea;
  position: relative;
  cursor: pointer;
  transition: background 0.2s ease;
  flex-shrink: 0;
}

.switch.on {
  background: #3b6ef6;
}

.switch-knob {
  position: absolute;
  top: 0.04rem;
  left: 0.04rem;
  width: 0.48rem;
  height: 0.48rem;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 0.02rem 0.06rem rgba(0, 0, 0, 0.18);
  transition: transform 0.2s ease;
}

.switch.on .switch-knob {
  transform: translateX(0.4rem);
}

/* ---------- 底部按钮 ---------- */
.footer {
  padding: 0.48rem 0.32rem 0;
}

.btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 0.92rem;
  border-radius: 999rem;
  font-size: 0.3rem;
  cursor: pointer;
}

.btn-save {
  background: linear-gradient(135deg, #3b6ef6, #6a8dff);
  color: #ffffff;
  box-shadow: 0 0.1rem 0.24rem rgba(59, 110, 246, 0.28);
}

.btn-save:disabled {
  opacity: 0.7;
}

.btn-del {
  margin-top: 0.24rem;
  background: #ffffff;
  color: #ff5a5f;
  border: 1px solid #ffd9da;
}

.btn-del:disabled {
  opacity: 0.7;
}
</style>
