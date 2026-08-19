import { adminPb } from './api-frpc'
import { pb } from './pocketbase'

// ---- 类型定义 ----

export interface FilestoreConfig {
  alist_url: string
  alist_token: string
  max_size: number
  allowed_mimes: string
  download_mode: 'direct' | 'proxy'
  storage_path: string
  placeholder_denied: string
  placeholder_error: string
}

export interface FilestoreFileInfo {
  id: string
  owner: string
  original_name: string
  mime: string
  size: number
  visibility: 'private' | 'public'
  created: string
  updated?: string
}

export interface FileListResponse {
  items: FilestoreFileInfo[]
  page: number
  per_page: number
}

export interface HealthCheckResult {
  ok: boolean
  error?: string
}

export interface OrphanReport {
  ok: boolean
  orphans: string[]
  orphan_count: number
  db_file_count: number
  alist_file_count: number
}

// ---- 管理端 API (superuser only) ----

export async function getFilestoreConfig(): Promise<FilestoreConfig> {
  return adminPb.send('/api/filestore/config', { requestKey: null })
}

export async function saveFilestoreConfig(
  items: { option: string; value: string }[]
): Promise<{ ok: boolean }> {
  return adminPb.send('/api/filestore/config', {
    method: 'POST',
    body: { items },
    requestKey: null
  })
}

export async function checkAlistHealth(): Promise<HealthCheckResult> {
  return adminPb.send('/api/filestore/check-alist', {
    method: 'POST',
    requestKey: null
  })
}

export async function reportOrphans(): Promise<OrphanReport> {
  return adminPb.send('/api/filestore/orphans/report', {
    method: 'POST',
    requestKey: null
  })
}

// ---- 通用端 API (普通用户) ----

export async function uploadFile(
  file: File,
  visibility: 'private' | 'public' = 'private'
): Promise<FilestoreFileInfo> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('visibility', visibility)
  return pb.send('/api/filestore/files/upload', {
    method: 'POST',
    body: formData,
    requestKey: null
  })
}

export async function getFile(id: string): Promise<FilestoreFileInfo> {
  return pb.send(`/api/filestore/files/${id}`, { requestKey: null })
}

export async function listFiles(params?: {
  page?: number
  per_page?: number
  filter?: 'my' | 'public' | 'all'
}): Promise<FileListResponse> {
  const searchParams = new URLSearchParams()
  if (params?.page) searchParams.set('page', String(params.page))
  if (params?.per_page) searchParams.set('per_page', String(params.per_page))
  if (params?.filter) searchParams.set('filter', params.filter)
  const qs = searchParams.toString()
  return pb.send(`/api/filestore/files${qs ? '?' + qs : ''}`, { requestKey: null })
}

export function getDownloadUrl(id: string): string {
  return `${pb.baseUrl}/api/filestore/files/${id}/download`
}

export async function updateFileVisibility(
  id: string,
  visibility: 'private' | 'public'
): Promise<{ ok: boolean; visibility: string }> {
  return pb.send(`/api/filestore/files/${id}`, {
    method: 'PATCH',
    body: { visibility },
    requestKey: null
  })
}

export async function deleteFile(id: string): Promise<{ ok: boolean }> {
  return pb.send(`/api/filestore/files/${id}`, {
    method: 'DELETE',
    requestKey: null
  })
}

/** 下载文件(通过 fetch + blob 触发浏览器下载,确保携带 auth token) */
export async function downloadFile(id: string, filename: string): Promise<void> {
  const response = await fetch(`/api/filestore/files/${id}/download`, {
    headers: { Authorization: pb.authStore.token }
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: '下载失败' }))
    throw new Error(err.error || `HTTP ${response.status}`)
  }
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}