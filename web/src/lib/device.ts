/**
 * 设备身份（web 版的「微信 openid」等价物）。
 *
 * 小程序靠 wx.login → openid 拿到设备级唯一身份；web 移植用浏览器 localStorage 持久化的
 * 随机 device_id 承担同一角色：首次访问生成并落盘，之后稳定复用（清站点数据才变）。
 * 云函数把它当 Bearer 凭据（见 functions/_shared/auth.ts），语义等同 API Key。
 */
const DEVICE_KEY = 'countdown_device_id'

export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY)
  if (id) return id
  id = generateDeviceId()
  localStorage.setItem(DEVICE_KEY, id)
  return id
}

/** 登出后重新生成身份（原账号数据保留在云端，只是不再关联新身份）。 */
export function resetDeviceId(): void {
  localStorage.removeItem(DEVICE_KEY)
}

function generateDeviceId(): string {
  // crypto.randomUUID 不可用时兜底（老浏览器 / 非安全上下文）。
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `dev_${crypto.randomUUID()}`
  }
  return `dev_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
}
