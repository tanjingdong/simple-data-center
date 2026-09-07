// 人员标签文本的拆分/切换与候选池聚合纯函数
// 存储语义:标签字段为半角逗号分隔字符串,不做中文逗号归一

export interface TagPoolEntry {
  tag: string
  count: number
}

// 标签字段投影后的轻量人员记录(候选池查询只取这两个字段)
export interface TagRecord {
  person_tags?: string
  social_tags?: string
}

export type TagPool = { person: TagPoolEntry[]; social: TagPoolEntry[] }

// 中文(拼音序)比较,先例见 api-health-events.ts
const collator = new Intl.Collator('zh-Hans-CN')

// 按半角逗号拆分 → trim → 去空
export function parseTags(text?: string): string[] {
  if (!text) return []
  return text
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

// 已选比对集
export function currentTagSet(text?: string): Set<string> {
  return new Set(parseTags(text))
}

// 开关式切换:已含(整词)则一次删净全部该词,不含则追加(trim、整串规范化)
export function toggleTag(text: string | undefined, tag: string): string {
  const value = tag.trim()
  if (!value) return text ?? ''
  const tags = parseTags(text)
  if (tags.includes(value)) {
    return tags.filter((t) => t !== value).join(',')
  }
  const base = (text ?? '').trim()
  return base ? `${base},${value}` : value
}

// 单字段聚合:计数 → 频次降序 → 平手中文序(全量列出,不截断)
function rank(
  records: TagRecord[],
  key: 'person_tags' | 'social_tags'
): TagPoolEntry[] {
  const counts = new Map<string, number>()
  for (const record of records) {
    for (const tag of parseTags(record[key])) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || collator.compare(a.tag, b.tag))
}

// 最近更新 10 人的标签 → 每字段独立候选池(全部列出)
export function buildTagPool(records: TagRecord[]): TagPool {
  return {
    person: rank(records, 'person_tags'),
    social: rank(records, 'social_tags')
  }
}
