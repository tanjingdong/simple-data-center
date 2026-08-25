import { describe, expect, it } from 'vitest'
import { formatFileSize, isImageMime } from './file-format'

describe('formatFileSize', () => {
  it('0 → 0 B', () => {
    expect(formatFileSize(0)).toBe('0 B')
  })
  it('小于 1KB 保留字节', () => {
    expect(formatFileSize(500)).toBe('500 B')
  })
  it('1023 → 1023 B', () => {
    expect(formatFileSize(1023)).toBe('1023 B')
  })
  it('1024 → 1.0 KB', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB')
  })
  it('1536 → 1.5 KB(保留 1 位小数)', () => {
    expect(formatFileSize(1536)).toBe('1.5 KB')
  })
  it('1MB → 1.0 MB', () => {
    expect(formatFileSize(1048576)).toBe('1.0 MB')
  })
  it('负数/非有限 → —', () => {
    expect(formatFileSize(-1)).toBe('—')
    expect(formatFileSize(Number.NaN)).toBe('—')
  })
})

describe('isImageMime', () => {
  it('image/* 判定为图片', () => {
    expect(isImageMime('image/jpeg')).toBe(true)
    expect(isImageMime('image/png')).toBe(true)
    expect(isImageMime('image/webp')).toBe(true)
  })
  it('非 image 不为图片', () => {
    expect(isImageMime('application/pdf')).toBe(false)
  })
  it('空/未定义 → false', () => {
    expect(isImageMime(undefined)).toBe(false)
    expect(isImageMime('')).toBe(false)
  })
})
