import { describe, expect, it } from 'vitest'
import type { HealthEvent } from '@/schemas/health-event-schema'
import {
  departmentOptionsOf,
  emptyHealthEventFilters,
  filterHealthEvents,
  personOptionsOf
} from './api-health-events'

const event = (over: Partial<HealthEvent> = {}): HealthEvent => ({
  id: 'abc123def456ghi',
  person: '李杰',
  happen_at: '2026-05-23',
  event_type: '门诊',
  item: '',
  department: '眼科',
  institution: '曲靖市第二人民医院',
  doctor: '',
  conclusion: '过敏性结膜炎',
  detail: '主诉:眼睛疼痛。',
  receipt: [],
  referenced_by: [],
  ...over
})

describe('filterHealthEvents', () => {
  const events = [
    event(),
    event({
      id: 'bbb222ccc333ddd',
      person: '谭祺宝',
      happen_at: '2026-06-09',
      event_type: '常规体检',
      item: '体重',
      department: '体检科',
      institution: '曲靖市妇幼保健院',
      conclusion: '16.1kg',
      detail: ''
    }),
    event({
      id: 'ccc333ddd444eee',
      happen_at: '2025-09-26',
      event_type: '筛查',
      item: '裸眼视力OD',
      department: '眼科',
      institution: '曲靖市第一人民医院',
      conclusion: '5.0'
    })
  ]

  it('按人过滤', () => {
    const got = filterHealthEvents(events, { ...emptyHealthEventFilters, person: '谭祺宝' })
    expect(got.map((e) => e.id)).toEqual(['bbb222ccc333ddd'])
  })

  it('按类型多选过滤', () => {
    const got = filterHealthEvents(events, { ...emptyHealthEventFilters, eventTypes: ['门诊', '筛查'] })
    expect(got.map((e) => e.id)).toEqual(['abc123def456ghi', 'ccc333ddd444eee'])
  })

  it('按科属多选过滤', () => {
    const got = filterHealthEvents(events, { ...emptyHealthEventFilters, departments: ['体检科'] })
    expect(got.map((e) => e.id)).toEqual(['bbb222ccc333ddd'])
  })

  it('按时间范围过滤(含边界)', () => {
    const got = filterHealthEvents(events, {
      ...emptyHealthEventFilters,
      from: '2026-05-23',
      to: '2026-06-09'
    })
    expect(got.map((e) => e.id)).toEqual(['abc123def456ghi', 'bbb222ccc333ddd'])
  })

  it('按关键词全文搜索(项目/结论/详述/机构/类型)', () => {
    expect(filterHealthEvents(events, { ...emptyHealthEventFilters, keyword: '眼压' }).length).toBe(0)
    expect(filterHealthEvents(events, { ...emptyHealthEventFilters, keyword: '体重' }).map((e) => e.id))
      .toEqual(['bbb222ccc333ddd'])
    expect(filterHealthEvents(events, { ...emptyHealthEventFilters, keyword: '曲靖市第二人民医院' }).map((e) => e.id))
      .toEqual(['abc123def456ghi'])
    expect(filterHealthEvents(events, { ...emptyHealthEventFilters, keyword: '常规体检' }).map((e) => e.id))
      .toEqual(['bbb222ccc333ddd'])
  })

  it('空条件返回全部', () => {
    expect(filterHealthEvents(events, emptyHealthEventFilters).length).toBe(3)
  })
})

describe('personOptionsOf / departmentOptionsOf', () => {
  it('提取去重排序的历史值', () => {
    expect(personOptionsOf([event(), event({ person: '谭祺宝' }), event({ person: '李杰' })])).toEqual([
      '李杰',
      '谭祺宝'
    ])
    expect(departmentOptionsOf([event(), event({ department: '体检科' })])).toEqual(['体检科', '眼科'])
  })
})
