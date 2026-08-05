import PocketBase from 'pocketbase'

// 管理客户端与 PocketBase admin 后台(/_/)共享默认本地存储键:
// 在 admin 后台登录 superuser 后,此处直接复用同一会话,无需二次登录。
// 注意:与主用户会话(services/pocketbase.ts)共用同一存储位,两者会互相顶掉,
// 属设计决策(共享认证的既定代价)。
export const adminPb = new PocketBase()

export type FrpcStatus =
  'unused' | 'starting' | 'running' | 'stopped' | 'failed'

export interface FrpcStatusInfo {
  status: FrpcStatus
  error?: string
}

// 当前会话是否为 superuser(在 admin 后台登录后即为 true)
export function isSuperuserAuthed() {
  return adminPb.authStore.isValid && adminPb.authStore.isSuperuser
}

export async function getFrpcStatus(): Promise<FrpcStatusInfo> {
  return adminPb.send('/api/frpc/status', { requestKey: null })
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
