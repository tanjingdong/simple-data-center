import { Button } from '@/components/ui/button'
import { parseTags, toggleTag, type TagPoolEntry } from '@/lib/person-tags'

// 标签候选行:最近更新人员用过、按频次排序的候选 chip 开关式填入文本框。
// 文本框(受控 text)为唯一事实源;池外新词直接在文本框录入(候选行不提供新增入口)。
export default function TagSuggestRow({
  pool,
  text,
  onChange
}: {
  pool: TagPoolEntry[]
  text: string
  onChange: (value: string) => void
}) {
  if (!pool.length) return null

  const current = parseTags(text)

  // 开关切换:已选移除、未选追加(整词精确匹配)
  const handleToggle = (tag: string) => {
    onChange(toggleTag(text, tag))
  }

  return (
    <div className='flex flex-wrap items-center gap-1 pt-1.5'>
      {pool.map((entry) => {
        const selected = current.includes(entry.tag)
        return (
          <Button
            key={entry.tag}
            type='button'
            variant={selected ? 'secondary' : 'outline'}
            title={`已有 ${entry.count} 人使用`}
            className='h-6 rounded-full px-2 text-xs font-normal'
            onClick={() => handleToggle(entry.tag)}>
            {entry.tag}
          </Button>
        )
      })}
    </div>
  )
}
