// 事件参与方 token:人 [[p:<id>|<名>]]、组织 [[o:<id>|<名>]]。
// summary 一列承载内容与参与方;反查靠 token 子串(同 person_tags~'x' 套路)。

export type ParticipantKind = 'p' | 'o'

export type EventToken = {
  kind: ParticipantKind
  id: string
  label: string
}

export type SummaryPart =
  | { kind: 'text'; text: string }
  | { kind: 'token'; token: EventToken }

// token 正则(全局):[[p|o:<15位id>|<显示名>]];id 为 PocketBase 15 位随机串
export const EVENT_TOKEN_RE = /\[\[(p|o):([a-z0-9]{15})\|([^\]]*)\]\]/g

// 服务端 schema pattern 对应正则(要求 summary 至少含 1 个 token 开头)
export const SUMMARY_MIN_TOKEN_RE = /\[\[(p|o):/

// 格式化 token 字符串
export function formatToken(
  kind: ParticipantKind,
  id: string,
  label: string
): string {
  return `[[${kind}:${id}|${label}]]`
}

// 提取所有 token(顺序,不去重)
export function parseTokens(summary: string): EventToken[] {
  const tokens: EventToken[] = []
  const re = new RegExp(EVENT_TOKEN_RE)
  let m: RegExpExecArray | null
  while ((m = re.exec(summary)) !== null) {
    tokens.push({ kind: m[1] as ParticipantKind, id: m[2], label: m[3] })
  }
  return tokens
}

// 拆成文本段 + token(渲染用)
export function splitSummary(summary: string): SummaryPart[] {
  const parts: SummaryPart[] = []
  const re = new RegExp(EVENT_TOKEN_RE)
  let cursor = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(summary)) !== null) {
    if (m.index > cursor) {
      parts.push({ kind: 'text', text: summary.slice(cursor, m.index) })
    }
    parts.push({
      kind: 'token',
      token: { kind: m[1] as ParticipantKind, id: m[2], label: m[3] }
    })
    cursor = m.index + m[0].length
  }
  if (cursor < summary.length) {
    parts.push({ kind: 'text', text: summary.slice(cursor) })
  }
  return parts
}

// 提取所有 id(去重保序)
export function extractIds(summary: string): string[] {
  const seen = new Set<string>()
  const ids: string[] = []
  for (const t of parseTokens(summary)) {
    if (!seen.has(t.id)) {
      seen.add(t.id)
      ids.push(t.id)
    }
  }
  return ids
}

// 人/组织反查 filter(token 子串,与 person_tags~ 同机制)
export function buildPersonFilter(personId: string): string {
  return `summary~'[[p:${personId}|'`
}

export function buildOrgFilter(orgId: string): string {
  return `summary~'[[o:${orgId}|'`
}
