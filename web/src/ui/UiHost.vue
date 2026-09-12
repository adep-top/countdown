<script setup lang="ts">
// 浮层宿主：渲染 toast / modal / action sheet（App.vue 挂载一次）。
import { useUiState, settleModal, settleSheet, dismissAll } from './ui'

const state = useUiState()
</script>

<template>
  <!-- Toast -->
  <Transition name="toast">
    <div v-if="state.toast" class="ui-toast">
      <svg
        v-if="state.toast.icon === 'success'"
        class="ui-toast-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="3"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M20 6 9 17l-5-5" />
      </svg>
      <span>{{ state.toast.title }}</span>
    </div>
  </Transition>

  <!-- Modal -->
  <Transition name="fade">
    <div v-if="state.modal" class="ui-mask" @click.self="settleModal(false)">
      <div class="ui-modal">
        <div class="ui-modal-title">{{ state.modal.title }}</div>
        <div class="ui-modal-content">{{ state.modal.content }}</div>
        <div class="ui-modal-actions">
          <button
            v-if="state.modal.showCancel"
            class="ui-modal-btn ui-modal-cancel"
            @click="settleModal(false)"
          >
            {{ state.modal.cancelText }}
          </button>
          <button
            class="ui-modal-btn ui-modal-confirm"
            :style="{ color: state.modal.confirmColor }"
            @click="settleModal(true)"
          >
            {{ state.modal.confirmText }}
          </button>
        </div>
      </div>
    </div>
  </Transition>

  <!-- ActionSheet -->
  <Transition name="fade">
    <div v-if="state.sheet" class="ui-mask" @click.self="settleSheet(-1)">
      <div class="ui-sheet">
        <div class="ui-sheet-title">请选择</div>
        <button
          v-for="(item, index) in state.sheet.itemList"
          :key="item"
          class="ui-sheet-item"
          :style="{ color: state.sheet.itemColor }"
          @click="settleSheet(index)"
        >
          {{ item }}
        </button>
        <button class="ui-sheet-cancel" @click="settleSheet(-1)">取消</button>
      </div>
    </div>
  </Transition>
</template>
<style scoped>
/* 与小程序 wx.showToast / wx.showModal / wx.showActionSheet 视觉对齐 */
.ui-toast {
  position: fixed;
  left: 50%;
  top: 45%;
  transform: translate(-50%, -50%);
  z-index: 3000;
  max-width: 70%;
  padding: 0.24rem 0.36rem;
  border-radius: 0.16rem;
  background: rgba(0, 0, 0, 0.78);
  color: #fff;
  font-size: 0.28rem;
  line-height: 1.5;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.1rem;
  pointer-events: none;
}
.ui-toast-icon {
  width: 0.4rem;
  height: 0.4rem;
}
.ui-mask {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
}
.ui-modal {
  width: 5.4rem;
  max-width: 82%;
  background: #fff;
  border-radius: 0.24rem;
  overflow: hidden;
  padding: 0.4rem 0.32rem 0;
}
.ui-modal-title {
  font-size: 0.34rem;
  font-weight: 600;
  color: #1f2430;
  text-align: center;
}
.ui-modal-content {
  margin-top: 0.16rem;
  font-size: 0.28rem;
  color: #6b7385;
  line-height: 1.6;
  text-align: center;
  word-break: break-word;
}
.ui-modal-actions {
  display: flex;
  margin: 0.32rem -0.32rem 0;
  border-top: 1px solid #f0f2f7;
}
.ui-modal-btn {
  flex: 1;
  height: 0.92rem;
  border: none;
  background: #fff;
  font-size: 0.3rem;
  cursor: pointer;
}
.ui-modal-btn + .ui-modal-btn {
  border-left: 1px solid #f0f2f7;
}
.ui-modal-cancel {
  color: #1f2430;
}
.ui-modal-confirm {
  font-weight: 600;
}
.ui-sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background: #f5f7fb;
  padding: 0.08rem 0 calc(0.16rem + env(safe-area-inset-bottom));
  z-index: 2100;
}
.ui-sheet-title {
  text-align: center;
  font-size: 0.26rem;
  color: #9aa3b2;
  padding: 0.16rem 0 0.08rem;
}
.ui-sheet-item,
.ui-sheet-cancel {
  display: block;
  width: auto;
  margin: 0.16rem 0.16rem 0;
  height: 0.96rem;
  line-height: 0.96rem;
  border: none;
  border-radius: 0.16rem;
  background: #fff;
  font-size: 0.3rem;
  cursor: pointer;
  text-align: center;
}
.ui-sheet-cancel {
  color: #1f2430;
}
.toast-enter-active,
.toast-leave-active,
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.toast-enter-from,
.toast-leave-to,
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
