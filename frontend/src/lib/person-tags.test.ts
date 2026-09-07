import { describe, expect, it } from 'vitest'
import {
  buildTagPool,
  currentTagSet,
  parseTags,
  toggleTag
} from './person-tags'

describe('parseTags', () => {
  it('正常拆分', () => {
    expect(parseTags('同学,同事,老乡')).toEqual(['同学', '同事', '老乡'])
  })
  it('trim 首尾空格', () => {
    expect(parseTags(' 同学 , 同事 ')).toEqual(['同学', '同事'])
  })
  it('跳过空段与全空串', () => {
    expect(parseTags('a,,b')).toEqual(['a', 'b'])
    expect(parseTags(',')).toEqual([])
    expect(parseTags('')).toEqual([])
    expect(parseTags(undefined)).toEqual([])
  })
})

describe('currentTagSet', () => {
  it('返回去空后的词集合', () => {
    expect(currentTagSet('同学, 同学 ,,老乡')).toEqual(
      new Set(['同学', '老乡'])
    )
  })
})

describe('toggleTag', () => {
  it('不含则追加,整串规范化', () => {
    expect(toggleTag('同学,同事', '老乡')).toBe('同学,同事,老乡')
    expect(toggleTag(' 同学 , 同事 ', '老乡')).toBe('同学 , 同事,老乡')
  })
  it('空文本直接写入', () => {
    expect(toggleTag('', '老乡')).toBe('老乡')
    expect(toggleTag(undefined, '老乡')).toBe('老乡')
  })
  it('追加前 trim 传入词', () => {
    expect(toggleTag('同学', ' 老乡 ')).toBe('同学,老乡')
  })
  it('空词不变更文本', () => {
    expect(toggleTag('同学', '  ')).toBe('同学')
    expect(toggleTag('', '')).toBe('')
  })
  it('含则移除整词(一次删净全部重复),不影响其他词', () => {
    expect(toggleTag('同学,同事,同学', '同学')).toBe('同事')
  })
  it('整词精确匹配,不误伤子串词', () => {
    expect(toggleTag('同学,同学会', '同学')).toBe('同学会')
  })
  it('整串仅剩该词时移除为空串', () => {
    expect(toggleTag('同学', '同学')).toBe('')
  })
  it('池外词同样可切换移除', () => {
    expect(toggleTag('同学,手输词', '手输词')).toBe('同学')
  })
})

describe('buildTagPool', () => {
  const records: Parameters<typeof buildTagPool>[0] = [
    { person_tags: '同学, 同事', social_tags: '政界' },
    { person_tags: '同学', social_tags: '学界,政界' },
    { person_tags: '校友', social_tags: '' },
    { person_tags: undefined, social_tags: undefined },
    {}
  ]
  it('两字段各自独立聚合,频次降序,平手拼音序(同 tong < 校 xiao)', () => {
    const pool = buildTagPool(records)
    expect(pool.person.map((e) => e.tag)).toEqual(['同学', '同事', '校友'])
    expect(pool.person[0].count).toBe(2)
    expect(pool.social.map((e) => e.tag)).toEqual(['政界', '学界'])
  })
  it('频次平手按中文序(拼音),字段返回键固定 person/social', () => {
    const pool = buildTagPool([{ person_tags: '校友,同学,政界' }])
    expect(pool.person.map((e) => e.tag)).toEqual(['同学', '校友', '政界'])
    expect(pool).toHaveProperty('person')
    expect(pool).toHaveProperty('social')
  })
  it('全量列出不截断', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      person_tags: `t${i}`
    }))
    expect(buildTagPool(many).person).toHaveLength(12)
  })
  it('全空记录返回空池', () => {
    expect(buildTagPool([])).toEqual({ person: [], social: [] })
  })
})
