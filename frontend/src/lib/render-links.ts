import type { HealthEvent } from '@/schemas/health-event-schema'

// 详述文本拆分结果:普通文本 / 有效链接 / 悬挂链接(目标事件已删除)
export type DetailPart =
  | { kind: 'text'; text: string }
  | { kind: 'link'; id: string; label: string }
  | { kind: 'dangling'; id: string }

// 链接语法:[[事件<15位ID>]];其他 [[内容]] 保持原样文本
const HEALTH_LINK_RE = /\[\[事件([a-z0-9]{15})\]\]/g

// 纯函数:把详述文本拆分为可渲染片段(文本 / 链接标签 / 悬挂占位)
export function splitDetailLinks(
  detail: string,
  eventsById: Map<string, HealthEvent>
): DetailPart[] {
  const parts: DetailPart[] = []
  let cursor = 0
  const re = new RegExp(HEALTH_LINK_RE)
  let m: RegExpExecArray | null
  while ((m = re.exec(detail)) !== null) {
    if (m.index > cursor) {
      parts.push({ kind: 'text', text: detail.slice(cursor, m.index) })
    }
    const id = m[1]
    const target = eventsById.get(id)
    parts.push(
      target ? { kind: 'link', id, label: linkLabel(target) } : { kind: 'dangling', id }
    )
    cursor = m.index + m[0].length
  }
  if (cursor < detail.length) {
    parts.push({ kind: 'text', text: detail.slice(cursor) })
  }
  return parts
}

// 链接标签:「项目:结论」(如 眼压R:17mmHg);无项目回退「类型 · 时间」
export function linkLabel(event: HealthEvent): string {
  if (event.item) return event.conclusion ? `${event.item}:${event.conclusion}` : event.item
  return event.event_type ? `${event.event_type} · ${event.happen_at}` : event.happen_at
}

// 从源事件详述中提取指向目标的链接上下文片段(前后各 12 字符,含省略号);
// 展示时回读源文本提取,保证片段永远与当前文本一致。
export function linkContextSnippet(detail: string, targetId: string): string {
  const m = new RegExp(`\\[\\[事件${targetId}\\]\\]`).exec(detail)
  if (!m) return ''
  const start = Math.max(0, m.index - 12)
  const end = Math.min(detail.length, m.index + m[0].length + 12)
  const snippet = detail.slice(start, end).replace(/\s+/g, ' ')
  return `${start > 0 ? '…' : ''}${snippet}${end < detail.length ? '…' : ''}`
}

// 纯函数:关联事件面板数据
//  - direct:本事件被引用列列出的来源事件(存在的部分);
//  - dangling:被引用列中在 events 中找不到的 ID(已删除的引用,按原顺序去重);
//  - reverse:被引用列含本事件 ID 的事件(即本事件的子事件)。
// 纯函数:本事件被哪些事件所关联(纯入链视图)。
// referenced_by 的唯一来源是详述文本链接(系统不写入结构化关联),
// 故无需反查子事件;被引用列中的悬挂 ID(已删除事件)单独返回供灰化占位。
export function buildRelatedEvents(
  event: HealthEvent,
  events: HealthEvent[]
): { direct: HealthEvent[]; dangling: string[] } {
  const byId = new Map(events.map((e) => [e.id, e]))
  const direct = (event.referenced_by ?? [])
    .map((id) => byId.get(id))
    .filter((e): e is HealthEvent => e !== undefined)
  const dangling = [...new Set((event.referenced_by ?? []).filter((id) => !byId.has(id)))]
  return { direct, dangling }
}

// 纯函数:归集摘要纯文本(顺序由调用方保证;供一键复制与外部 AI 自诊输入)
export function buildSummaryText(events: HealthEvent[]): string {
  return events
    .map((e) => {
      const head = [e.happen_at, e.event_type, e.item, e.department]
        .filter(Boolean)
        .join(' | ')
      const body = [e.conclusion, e.detail].filter(Boolean).join('\n')
      return `【${head}】\n${body}`.trim()
    })
    .join('\n\n')
}
