import { formatToken, splitSummary, type ParticipantKind } from '@/lib/event-tokens'

// MentionEditor 的序列化/反序列化纯函数(无 React/Tiptap 依赖,可单测)。
// token 格式 [[p:id|名]] / [[o:id|名]] 与 event-tokens 对称。

// 把 value(token 文本)解析为编辑器初始 HTML:文本段 + mention span。
// span 属性顺序无所谓——htmlToTokenText 解析时属性顺序无关。
// 与 event-tokens 的 splitSummary 对称。
export function buildInitialContent(value: string): string {
  const parts = splitSummary(value)
  const html = parts
    .map((p) =>
      p.kind === 'text'
        ? escapeHtml(p.text)
        : `<span data-type="mention" data-kind="${p.token.kind}" data-id="${p.token.id}" data-label="${escapeHtml(p.token.label)}">@${escapeHtml(p.token.label)}</span>`
    )
    .join('')
  return `<p>${html}</p>`
}

// mention span 整体匹配(属性顺序无关;Tiptap v3 实测 data-kind 排在最后,
// 见 mention-serialize.test.ts 的真实输出 fixture)。
const MENTION_SPAN_RE = /<span[^>]*data-type="mention"[^>]*>[\s\S]*?<\/span>/g

// HTML → token 文本:mention span 转 [[kind:id|label]],其余剥标签留文本。
// 属性顺序无关:先整段匹配 span,再在其内部用独立正则逐个取 data-kind/data-id/data-label。
// 与 event-tokens 的 formatToken / splitSummary 对称。
export function htmlToTokenText(html: string): string {
  const withTokens = html.replace(MENTION_SPAN_RE, (span) => {
    const kind = /data-kind="(p|o)"/.exec(span)?.[1]
    const id = /data-id="([a-z0-9]{15})"/.exec(span)?.[1]
    const label = /data-label="([^"]*)"/.exec(span)?.[1]
    if (kind && id && label) {
      return formatToken(kind as ParticipantKind, id, unescapeHtml(label))
    }
    return '' // 残缺 mention span,丢弃
  })
  return unescapeHtml(withTokens.replace(/<[^>]+>/g, ''))
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function unescapeHtml(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}
