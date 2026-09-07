import { buildOrgFilter, buildPersonFilter } from '@/lib/event-tokens'
import { eventTypePresets } from '@/schemas/event-schema'
import { describe, expect, it } from 'vitest'
import { buildEmploymentFilter } from './api-events'

const ID = 'abc123def456ghi'

describe('events 反查 filter', () => {
  it('人反查用 summary~ token 子串', () => {
    expect(buildPersonFilter(ID)).toBe(`summary~'[[p:${ID}|'`)
  })
  it('组织反查用 summary~ token 子串', () => {
    expect(buildOrgFilter(ID)).toBe(`summary~'[[o:${ID}|'`)
  })
})

describe('事件类型预置(任职履历事件化)', () => {
  it('预置类型含 任职 与 离职', () => {
    expect(eventTypePresets).toContain('任职')
    expect(eventTypePresets).toContain('离职')
  })
})

describe('buildEmploymentFilter(组织任职/离职)', () => {
  it('仅两型类型等值 + 组织 token 子串', () => {
    expect(buildEmploymentFilter(ID)).toBe(
      `(type='任职' || type='离职') && summary~'[[o:${ID}|'`
    )
  })
})
