import { describe, expect, it } from 'vitest'
import { buildOrgFilter, buildPersonFilter } from '@/lib/event-tokens'

const ID = 'abc123def456ghi'

describe('events 反查 filter', () => {
  it('人反查用 summary~ token 子串', () => {
    expect(buildPersonFilter(ID)).toBe(`summary~'[[p:${ID}|'`)
  })
  it('组织反查用 summary~ token 子串', () => {
    expect(buildOrgFilter(ID)).toBe(`summary~'[[o:${ID}|'`)
  })
})
