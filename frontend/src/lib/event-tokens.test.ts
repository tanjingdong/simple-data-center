import { describe, expect, it } from 'vitest'
import {
  EVENT_TOKEN_RE,
  buildOrgFilter,
  buildPersonFilter,
  extractIds,
  formatToken,
  parseTokens,
  splitSummary
} from './event-tokens'

const ID1 = 'abc123def456ghi' // 15 位
const ID2 = 'bbb222ccc333ddd'
const OID = 'zzz999yyy888xxx'

describe('formatToken', () => {
  it('格式化人 token', () => {
    expect(formatToken('p', ID1, '张三')).toBe(`[[p:${ID1}|张三]]`)
  })
  it('格式化组织 token', () => {
    expect(formatToken('o', OID, '龙餐馆')).toBe(`[[o:${OID}|龙餐馆]]`)
  })
})

describe('parseTokens', () => {
  it('提取多个 token(含人与组织,按顺序)', () => {
    const summary = `与[[p:${ID1}|张三]][[p:${ID2}|李四]]在[[o:${OID}|龙餐馆]]吃饭`
    expect(parseTokens(summary)).toEqual([
      { kind: 'p', id: ID1, label: '张三' },
      { kind: 'p', id: ID2, label: '李四' },
      { kind: 'o', id: OID, label: '龙餐馆' }
    ])
  })
  it('无 token 返回空数组', () => {
    expect(parseTokens('纯文本无引用')).toEqual([])
  })
})

describe('splitSummary', () => {
  it('拆成文本段 + token', () => {
    const parts = splitSummary(`与[[p:${ID1}|张三]]在[[o:${OID}|龙餐馆]]吃饭`)
    expect(parts).toEqual([
      { kind: 'text', text: '与' },
      { kind: 'token', token: { kind: 'p', id: ID1, label: '张三' } },
      { kind: 'text', text: '在' },
      { kind: 'token', token: { kind: 'o', id: OID, label: '龙餐馆' } },
      { kind: 'text', text: '吃饭' }
    ])
  })
  it('纯文本整体为一段', () => {
    expect(splitSummary('纯文本')).toEqual([{ kind: 'text', text: '纯文本' }])
  })
})

describe('extractIds', () => {
  it('去重保序', () => {
    const summary = `[[p:${ID1}|张三]][[p:${ID1}|张三]][[o:${OID}|龙餐馆]]`
    expect(extractIds(summary)).toEqual([ID1, OID])
  })
})

describe('buildPersonFilter / buildOrgFilter', () => {
  it('人反查 filter', () => {
    expect(buildPersonFilter(ID1)).toBe(`summary~'[[p:${ID1}|'`)
  })
  it('组织反查 filter', () => {
    expect(buildOrgFilter(OID)).toBe(`summary~'[[o:${OID}|'`)
  })
})

describe('EVENT_TOKEN_RE', () => {
  it('正则带 g 标志可多次 exec', () => {
    const re = new RegExp(EVENT_TOKEN_RE)
    expect(re.exec(`[[p:${ID1}|张三]]`)![1]).toBe('p')
  })
})
