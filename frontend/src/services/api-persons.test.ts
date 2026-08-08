import { describe, expect, it } from 'vitest'
import {
  buildPersonFilter,
  buildPersonListFilter,
  emptyPersonFilters,
  oneMonthAgoIso
} from './api-persons'

describe('buildPersonFilter', () => {
  it('空过滤返回空字符串', () => {
    expect(buildPersonFilter(emptyPersonFilters)).toBe('')
  })

  it('查询词匹配姓名、昵称、手机号', () => {
    const filter = buildPersonFilter({ ...emptyPersonFilters, query: '张' })
    expect(filter).toBe(
      "(last_name~'张' || first_name~'张' || nickname~'张' || mobile~'张')"
    )
  })

  it('多条件以 && 连接并各自加括号', () => {
    const filter = buildPersonFilter({
      ...emptyPersonFilters,
      query: '张',
      nativePlace: '湖南',
      trustLevel: '4'
    })
    expect(filter).toContain("native_place~'湖南'")
    expect(filter).toContain('trust_level=4')
    expect(filter).toContain(' && ')
  })
})

describe('oneMonthAgoIso', () => {
  it('返回 30 天前(非闰年 3 月 15 日 → 2 月 13 日)', () => {
    const now = new Date('2026-03-15T12:00:00.000Z')
    expect(oneMonthAgoIso(now)).toBe('2026-02-13T12:00:00.000Z')
  })
})

describe('buildPersonListFilter', () => {
  it('viewMode=all 且无基础过滤时返回 undefined(不传 sort,数据库默认序)', () => {
    expect(buildPersonListFilter(emptyPersonFilters, 'all')).toBeUndefined()
  })

  it('viewMode=all 时仅返回基础过滤', () => {
    const filter = buildPersonListFilter(
      { ...emptyPersonFilters, query: '张' },
      'all'
    )
    expect(filter).toBe(
      "(last_name~'张' || first_name~'张' || nickname~'张' || mobile~'张')"
    )
  })

  it('viewMode=recent 追加 30 天时间条件', () => {
    const filter = buildPersonListFilter(emptyPersonFilters, 'recent')
    expect(filter).toMatch(/^updated >= '2\d{3}-\d{2}-\d{2}T/)
  })

  it('viewMode=recent 与基础过滤叠加', () => {
    const filter = buildPersonListFilter(
      { ...emptyPersonFilters, query: '张' },
      'recent'
    )
    expect(filter).toMatch(/ && updated >= '/)
  })
})
