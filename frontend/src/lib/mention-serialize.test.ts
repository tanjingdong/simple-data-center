import { describe, expect, it } from 'vitest'
import { buildInitialContent, htmlToTokenText } from './mention-serialize'

const PID = 'abc123456789012' // 15 位 PocketBase id
const PID2 = 'bbb222ccc333ddd'
const OID = 'zzz999yyy888xxx'

describe('htmlToTokenText — 属性顺序无关', () => {
  it('真实 Tiptap v3 输出(data-kind 排最后)能正确提取 token', () => {
    // 实测 Mention.extend({kind}) 的 toDOM 属性顺序:
    // class, data-type, data-id, data-label, data-mention-suggestion-char, data-kind
    const html = `<p>开会 <span class="bg-muted rounded px-1" data-type="mention" data-id="${PID}" data-label="张三" data-mention-suggestion-char="@" data-kind="p">@张三</span> 结束</p>`
    expect(htmlToTokenText(html)).toBe(`开会 [[p:${PID}|张三]] 结束`)
  })

  it('buildInitialContent 产出的 span(data-kind 在前)也能提取', () => {
    const html = buildInitialContent(`与[[p:${PID}|张三]]吃饭`)
    expect(htmlToTokenText(html)).toBe(`与[[p:${PID}|张三]]吃饭`)
  })
})

describe('round-trip: htmlToTokenText(buildInitialContent(x)) === x', () => {
  it('人 token 往返不变', () => {
    const s = `与[[p:${PID}|张三]]吃饭`
    expect(htmlToTokenText(buildInitialContent(s))).toBe(s)
  })

  it('组织 token 往返不变', () => {
    const s = `在[[o:${OID}|龙餐馆]]吃饭`
    expect(htmlToTokenText(buildInitialContent(s))).toBe(s)
  })

  it('多 token(人+人+组织)往返不变', () => {
    const s = `与[[p:${PID}|张三]][[p:${PID2}|李四]]在[[o:${OID}|龙餐馆]]吃饭`
    expect(htmlToTokenText(buildInitialContent(s))).toBe(s)
  })

  it('纯文本(无 token)往返不变', () => {
    const s = '纯文本无引用'
    expect(htmlToTokenText(buildInitialContent(s))).toBe(s)
  })
})
