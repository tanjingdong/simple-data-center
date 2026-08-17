import { describe, expect, it } from 'vitest'
import type { HealthEvent } from '@/schemas/health-event-schema'
import {
  buildRelatedEvents,
  buildSummaryText,
  linkContextSnippet,
  linkLabel,
  splitDetailLinks
} from './render-links'

const event = (over: Partial<HealthEvent> = {}): HealthEvent => ({
  id: 'abc123def456ghi',
  person: '李杰',
  happen_at: '2026-05-23',
  event_type: '门诊',
  item: '',
  department: '眼科',
  institution: '',
  doctor: '',
  conclusion: '过敏性结膜炎',
  detail: '',
  receipt: [],
  referenced_by: [],
  ...over
})

const byId = (events: HealthEvent[]) => new Map(events.map((e) => [e.id, e]))

describe('splitDetailLinks', () => {
  it('混合文本与链接', () => {
    const detail = '体格检查:[[事件abc123def456ghi]],眼压正常。'
    const parts = splitDetailLinks(detail, byId([event()]))
    expect(parts).toEqual([
      { kind: 'text', text: '体格检查:' },
      { kind: 'link', id: 'abc123def456ghi', label: '门诊 · 2026-05-23' },
      { kind: 'text', text: ',眼压正常。' }
    ])
  })

  it('目标不存在时为悬挂占位', () => {
    const parts = splitDetailLinks('[[事件zzz111yyy222xxx]]', byId([]))
    expect(parts).toEqual([{ kind: 'dangling', id: 'zzz111yyy222xxx' }])
  })

  it('非法格式保持原样文本', () => {
    const detail = '[[事件123]] 与 [[普通文本]] 不解析'
    expect(splitDetailLinks(detail, byId([]))).toEqual([{ kind: 'text', text: detail }])
  })

  it('无链接时整体为文本', () => {
    expect(splitDetailLinks('纯文本', byId([]))).toEqual([{ kind: 'text', text: '纯文本' }])
  })
})

describe('linkLabel', () => {
  it('项目+结论', () => {
    expect(linkLabel(event({ id: 'bbb222ccc333ddd', item: '眼压R', conclusion: '17mmHg' }))).toBe(
      '眼压R:17mmHg'
    )
  })
  it('只有项目', () => {
    expect(linkLabel(event({ id: 'bbb222ccc333ddd', item: '眼压R', conclusion: '' }))).toBe('眼压R')
  })
  it('无项目回退类型·时间', () => {
    expect(linkLabel(event())).toBe('门诊 · 2026-05-23')
  })
})

describe('linkContextSnippet', () => {
  it('提取链接上下文(前后 12 字符,含省略号)', () => {
    const detail = '体格检查:眼压R=17mmHg,眼压L=16mmHg,裸眼视力OD=0.6 [[事件abc123def456ghi]]。'
    const snippet = linkContextSnippet(detail, 'abc123def456ghi')
    expect(snippet).toContain('[[事件abc123def456ghi]]')
    expect(snippet.startsWith('…')).toBe(true)
  })
  it('无链接返回空串', () => {
    expect(linkContextSnippet('无链接', 'abc123def456ghi')).toBe('')
  })
})

describe('buildRelatedEvents', () => {
  const child = event({ id: 'bbb222ccc333ddd', event_type: '检查', item: '眼压R', conclusion: '17mmHg' })

  it('纯入链:被引用列中存在的来源事件 + 悬挂引用', () => {
    const me = event({ id: 'ddd444eee555fff', referenced_by: [child.id, 'zzz111yyy222xxx'] })
    const { direct, dangling } = buildRelatedEvents(me, [me, child])
    // 直接:被引用列中存在的来源事件
    expect(direct.map((e) => e.id)).toEqual([child.id])
    // 悬挂:被引用列中在 events 找不到的 ID(已删除的引用,按原顺序去重)
    expect(dangling).toEqual(['zzz111yyy222xxx'])
  })

  it('悬挂引用按原顺序去重', () => {
    const me = event({ referenced_by: ['zzz111yyy222xxx', 'aaa111bbb222ccc', 'zzz111yyy222xxx'] })
    const { direct, dangling } = buildRelatedEvents(me, [me])
    expect(direct).toEqual([])
    expect(dangling).toEqual(['zzz111yyy222xxx', 'aaa111bbb222ccc'])
  })

  it('无关联时空数组', () => {
    const me = event()
    const { direct, dangling } = buildRelatedEvents(me, [me])
    expect(direct).toEqual([])
    expect(dangling).toEqual([])
  })
})

describe('buildSummaryText', () => {
  it('按顺序生成摘要文本(含结论与详述)', () => {
    const events = [
      event({ item: '眼压R', conclusion: '17mmHg', detail: '' }),
      event({ id: 'bbb222ccc333ddd', item: '', conclusion: '过敏性结膜炎', detail: '主诉:眼睛疼痛。' })
    ]
    const text = buildSummaryText(events)
    expect(text).toContain('【2026-05-23 | 门诊 | 眼压R | 眼科】')
    expect(text).toContain('17mmHg')
    expect(text).toContain('主诉:眼睛疼痛。')
    expect(text.split('\n\n').length).toBe(2)
  })
})
