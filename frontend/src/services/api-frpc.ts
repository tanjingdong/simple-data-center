import PocketBase, { LocalAuthStore } from 'pocketbase'

// 管理客户端使用独立存储键,与主站用户会话(pb,默认键 pocketbase_auth)完全隔离。
// 修复历史问题:共用默认键时,主站 authRefresh 会误把 superuser token 当普通用户刷新,
// 403 后 logout() 清空共用存储,导致「登录后持续回到登录页」的循环。
export const adminPb = new PocketBase(
  '/',
  new LocalAuthStore('pocketbase_admin_auth')
)

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

export async function loginSuperuser(email: string, password: string) {
  await adminPb.collection('_superusers').authWithPassword(email, password)
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
