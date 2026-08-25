// 文件大小人类可读格式化:1024 进制,<1KB 保留字节,其余保留 1 位小数。
// 0 → "0 B";负数/非有限 → "—"。
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  )
  if (i === 0) return `${bytes} B`
  const value = bytes / Math.pow(1024, i)
  return `${value.toFixed(1)} ${units[i]}`
}

// 是否为图片 MIME(image/*);空/未定义返回 false。
export function isImageMime(mime?: string): boolean {
  return typeof mime === 'string' && mime.startsWith('image/')
}
