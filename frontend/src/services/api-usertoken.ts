import { adminPb } from './api-frpc'
import { pb } from './pocketbase'

export interface UserTokenStatus {
  enabled: boolean
  has_token: boolean
  created_at?: string
  last_used_at?: string
  admin_disabled: boolean
}

export interface UserTokenListItem {
  id: string
  email: string
  username: string
  has_token: boolean
  created_at?: string
  last_used_at?: string
  disabled: boolean
}

export interface UserTokenList {
  ok: boolean
  items: UserTokenListItem[]
  total: number
  page: number
  perPage: number
}

// ---- 用户自助接口 ----

export async function getMyTokenStatus(): Promise<UserTokenStatus> {
  return pb.send('/api/usertoken', { requestKey: null })
}

export async function generateMyToken(): Promise<{
  ok: boolean
  token: string
  created_at: string
}> {
  return pb.send('/api/usertoken/generate', {
    method: 'POST',
    requestKey: null
  })
}

export async function deleteMyToken(): Promise<{ ok: boolean }> {
  return pb.send('/api/usertoken', {
    method: 'DELETE',
    requestKey: null
  })
}

// ---- 管理员接口 ----

export async function getUsertokenConfig(): Promise<{ enabled: boolean }> {
  return adminPb.send('/api/usertoken/config', { requestKey: null })
}

export async function saveUsertokenConfig(
  enabled: boolean
): Promise<{ ok: boolean; enabled: boolean }> {
  return adminPb.send('/api/usertoken/config', {
    method: 'POST',
    body: { enabled },
    requestKey: null
  })
}

export async function listUserTokens(
  query: string,
  page: number,
  perPage: number
): Promise<UserTokenList> {
  const params = new URLSearchParams({
    page: String(page),
    perPage: String(perPage)
  })
  if (query) {
    params.set('query', query)
  }
  return adminPb.send(`/api/admin/usertokens?${params.toString()}`, {
    requestKey: null
  })
}

export async function setUserTokenDisabled(
  userId: string,
  disabled: boolean
): Promise<{ ok: boolean }> {
  return adminPb.send(`/api/admin/usertokens/${userId}`, {
    method: 'PATCH',
    body: { disabled },
    requestKey: null
  })
}

export async function deleteUserToken(
  userId: string
): Promise<{ ok: boolean }> {
  return adminPb.send(`/api/admin/usertokens/${userId}`, {
    method: 'DELETE',
    requestKey: null
  })
}
