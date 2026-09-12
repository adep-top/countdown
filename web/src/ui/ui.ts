/**
 * 轻量 UI 原语（web 版 wx.showToast / wx.showModal / wx.showActionSheet）。
 * 响应式 store + App.vue 里挂一个 UiHost 组件渲染浮层。
 */
import { reactive } from 'vue'

export interface ToastOptions {
  title: string
  /** 'none' = 无图标；'success' = 对勾。 */
  icon?: 'none' | 'success'
  duration?: number
}

export interface ModalOptions {
  title: string
  content: string
  confirmColor?: string
  confirmText?: string
  cancelText?: string
  showCancel?: boolean
}

let seq = 0

interface ToastState {
  id: number
  title: string
  icon: 'none' | 'success'
}
interface ModalState {
  id: number
  title: string
  content: string
  confirmColor: string
  confirmText: string
  cancelText: string
  showCancel: boolean
  resolve: (ok: boolean) => void
}
interface SheetState {
  id: number
  itemList: string[]
  itemColor: string
  resolve: (index: number) => void
}

const state = reactive<{
  toast: ToastState | null
  modal: ModalState | null
  sheet: SheetState | null
}>({
  toast: null,
  modal: null,
  sheet: null,
})

export function useUiState() {
  return state
}

/** 类 wx.showToast；duration 后自动消失。 */
export function showToast(options: ToastOptions | string): void {
  const opts = typeof options === 'string' ? { title: options } : options
  const id = ++seq
  state.toast = { id, title: opts.title, icon: opts.icon ?? 'none' }
  const duration = opts.duration ?? 2000
  if (duration > 0) {
    setTimeout(() => {
      if (state.toast?.id === id) state.toast = null
    }, duration)
  }
}

/** 类 wx.showModal；返回 Promise<boolean>（confirm → true）。 */
export function showModal(options: ModalOptions): Promise<boolean> {
  return new Promise((resolve) => {
    state.modal = {
      id: ++seq,
      title: options.title,
      content: options.content,
      confirmColor: options.confirmColor ?? '#3B6EF6',
      confirmText: options.confirmText ?? '确定',
      cancelText: options.cancelText ?? '取消',
      showCancel: options.showCancel ?? true,
      resolve,
    }
  })
}

/** 关闭当前 modal 并回调结果。 */
export function settleModal(ok: boolean): void {
  const modal = state.modal
  state.modal = null
  modal?.resolve(ok)
}

/** 类 wx.showActionSheet；返回 Promise<number>（点中项的下标）。 */
export function showActionSheet(options: {
  itemList: string[]
  itemColor?: string
}): Promise<number> {
  return new Promise((resolve) => {
    state.sheet = {
      id: ++seq,
      itemList: options.itemList,
      itemColor: options.itemColor ?? '#1F2430',
      resolve,
    }
  })
}

/** 关闭当前 action sheet 并回调下标（-1 = 未选中）。 */
export function settleSheet(index: number): void {
  const sheet = state.sheet
  state.sheet = null
  sheet?.resolve(index)
}

export function dismissAll(): void {
  settleModal(false)
  settleSheet(-1)
  state.toast = null
}
