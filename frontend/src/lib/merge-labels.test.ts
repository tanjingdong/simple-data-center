import { describe, expect, it } from 'vitest'
import { formatMergeCreated } from './merge-labels'

describe('formatMergeCreated', () => {
  it('把 RFC3339 创建时间格式化为中文可读时间', () => {
    const text = formatMergeCreated('2026-11-01T08:00:00Z')
    expect(text).not.toBe('')
    expect(text).not.toContain('Invalid')
    expect(text).toContain('2026')
  })

  it('空值或非法值返回空串,避免对话框出现 Invalid Date', () => {
    expect(formatMergeCreated('')).toBe('')
    expect(formatMergeCreated(undefined)).toBe('')
    expect(formatMergeCreated('not-a-date')).toBe('')
  })
})
