import PocketBase, { LocalAuthStore } from 'pocketbase'

// PB Dashboard(/_ )的 superuser 会话存储在 localStorage,键为
// "__pb_superusers__" + dashboard 页面 pathname(去尾斜杠),即固定为
// "__pb_superusers__/_"。adminPb 使用同一存储键即可与 /_ 会话双向同步:
// 在 Dashboard 登录后 /admin 直接可用,任一侧退出则双方同时失效;
// LocalAuthStore 自带 storage 事件监听,跨标签页登录/退出也会自动同步。
// 注意:键名前缀是 PB 内部实现细节,升级 PB 版本后需回归验证。
const SUPERUSER_KEY_PREFIX = '__pb_superusers__'

// 动态查找 Dashboard 写入的存储键(优先 /_ 结尾者,兼容 pathname 变体)
function findDashboardAuthKey(): string {
  const candidates: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(SUPERUSER_KEY_PREFIX)) candidates.push(key)
  }
  return (
    candidates.find((k) => k.endsWith('/_')) ??
    candidates[0] ??
    SUPERUSER_KEY_PREFIX + '/_'
  )
}

export const adminPb = new PocketBase('/', new LocalAuthStore(findDashboardAuthKey()))

export type FrpcStatus =
  | 'unused'
  | 'starting'
  | 'running'
  | 'stopped'
  | 'failed'

export interface FrpcStatusInfo {
  status: FrpcStatus
  error?: string
}

export interface FrpcConfigItem {
  option: string
  value: string
  description: string
}

export interface FrpcConfigInfo {
  items: FrpcConfigItem[]
  defaults: Record<string, string>
}

// 当前会话是否为 superuser(在 /admin 登录卡片登录后即为 true)
export function isSuperuserAuthed() {
  return adminPb.authStore.isValid && adminPb.authStore.isSuperuser
}

export function logoutSuperuser() {
  adminPb.authStore.clear()
}

export async function getFrpcStatus(): Promise<FrpcStatusInfo> {
  return adminPb.send('/api/frpc/status', { requestKey: null })
}

export async function getFrpcConfig(): Promise<FrpcConfigInfo> {
  return adminPb.send('/api/frpc/config', { requestKey: null })
}

export async function saveFrpcConfig(
  items: { option: string; value: string }[]
): Promise<FrpcStatusInfo> {
  return adminPb.send('/api/frpc/config', {
    method: 'POST',
    body: { items },
    requestKey: null
  })
}

export async function startFrpc(): Promise<FrpcStatusInfo> {
  return adminPb.send('/api/frpc/start', { method: 'POST', requestKey: null })
}

export async function stopFrpc(): Promise<FrpcStatusInfo> {
  return adminPb.send('/api/frpc/stop', { method: 'POST', requestKey: null })
}

export async function restartFrpc(): Promise<FrpcStatusInfo> {
  return adminPb.send('/api/frpc/restart', {
    method: 'POST',
    requestKey: null
  })
}
