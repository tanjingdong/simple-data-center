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
  try {
    return await pb.send('/api/filestore/files/upload', {
      method: 'POST',
      body: formData,
      requestKey: null
    })
  } catch (err) {
    // 透传后端返回的具体错误(如大小超限、MIME 不允许)给用户
    throw new Error(extractFilestoreError(err, '上传失败'))
  }
}

// extractFilestoreError 从 PocketBase ClientResponseError 提取后端返回的 error 文案;
// 取不到时回退到 sdk message 或 fallback。
function extractFilestoreError(err: unknown, fallback: string): string {
  const e = err as { response?: { error?: string }; message?: string }
  return e?.response?.error || e?.message || fallback
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
  return pb.send(`/api/filestore/files${qs ? '?' + qs : ''}`, {
    requestKey: null
  })
}

export function getDownloadUrl(id: string): string {
  // pb.baseUrl 默认为 "/",直接拼会得到 "//api/..."(浏览器把 api 当 host);
  // 去掉尾部斜杠,得到正确的相对根路径 "/api/..."(vite 代理 / 生产同源均生效)
  const base = pb.baseUrl.replace(/\/+$/, '')
  return `${base}/api/filestore/files/${id}/download`
}

/** 预览 URL:在下载 URL 上加 inline=1。proxy 模式下后端返回
 * Content-Disposition: inline,供 <img>/<iframe> 等标签内联显示;
 * direct 模式下参数被忽略(302 到 Alist,由 Alist 决定)。 */
export function getPreviewUrl(id: string): string {
  return `${getDownloadUrl(id)}?inline=1`
}

/** 大文件下载确认阈值:超过该大小(10MB)的文件,下载前需用户确认。 */
export const BIG_FILE_SIZE = 10 * 1024 * 1024

/** 生成带协议+域名的绝对访问地址(供复制分享)。
 * inline=true 时返回内联预览地址(?inline=1):proxy 模式下图片/PDF 等可在
 * 浏览器内直接显示;direct 模式下该参数被忽略(302 到 Alist),行为等同下载。 */
export function getAbsoluteFileUrl(id: string, inline: boolean): string {
  const origin = window.location.origin
  return `${origin}/api/filestore/files/${id}/download${inline ? '?inline=1' : ''}`
}

/** 复制文本到剪贴板。
 * 优先 Clipboard API(仅 https/localhost 安全上下文可用);http 局域网等
 * 不可用场景降级为隐藏 textarea + execCommand('copy')。 */
export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return
    } catch {
      // Clipboard API 被拒绝(如权限弹窗取消)→ 继续走降级方案
    }
  }
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  let ok = false
  try {
    ok = document.execCommand('copy')
  } finally {
    textarea.remove()
  }
  if (!ok) throw new Error('复制失败,请手动复制')
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
  try {
    return await pb.send(`/api/filestore/files/${id}`, {
      method: 'DELETE',
      requestKey: null
    })
  } catch (err) {
    throw new Error(extractFilestoreError(err, '删除失败'))
  }
}

/** 下载文件(通过 fetch + blob 触发浏览器下载,确保携带 auth token) */
export async function downloadFile(
  id: string,
  filename: string
): Promise<void> {
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
