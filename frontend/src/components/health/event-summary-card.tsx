import { ChevronDownIcon, ChevronRightIcon } from 'lucide-react'
import { useState } from 'react'
import HealthEventText from '@/components/health/health-event-text'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { linkLabel } from '@/lib/render-links'
import type { HealthEvent } from '@/schemas/health-event-schema'

// 归集页事件卡片:一行式「类型 · 项目 · 结论」+ 详述;链接点击在页内展开目标事件
// (防循环:visited 集合 + depth 上限 2)
const MAX_DEPTH = 2

export default function EventSummaryCard({
  event,
  eventsById,
  depth,
  visited
}: {
  event: HealthEvent
  eventsById: Map<string, HealthEvent>
  depth: number
  visited: Set<string>
}) {
  const [open, setOpen] = useState(false)
  // 展开目标只来自详述中的文本链接(关联完全由叙述承载,被引用列是入链不展开)
  const linkedIds = eventsFromDetail(event.detail)
    .filter((id) => id !== event.id && eventsById.has(id) && !visited.has(id))

  return (
    <Card className='print:border-muted print:shadow-none'>
      <div className='flex flex-wrap items-center gap-2 px-4 py-3'>
        <span className='text-muted-foreground whitespace-nowrap text-xs'>{event.happen_at}</span>
        <Badge variant='secondary'>{event.event_type}</Badge>
        {event.item && <span className='text-sm font-medium'>{event.item}</span>}
        {event.conclusion && <span className='text-sm'>{event.conclusion}</span>}
        {linkedIds.length > 0 && (
          <Button
            variant='ghost'
            size='sm'
            className='ml-auto h-6 px-2'
            onClick={() => setOpen((v) => !v)}>
            {open ? <ChevronDownIcon className='size-4' /> : <ChevronRightIcon className='size-4' />}
            {open ? '收起' : `关联 ${linkedIds.length}`}
          </Button>
        )}
      </div>
      {event.detail && (
        <div className='px-4 pb-3 text-sm'>
          {/* 点击链接展开关联列表,保持医生阅读上下文 */}
          <HealthEventText detail={event.detail} eventsById={eventsById} onLinkClick={() => setOpen(true)} />
        </div>
      )}
      {open &&
        depth < MAX_DEPTH &&
        linkedIds.map((id) => {
          const target = eventsById.get(id)!
          const nextVisited = new Set(visited).add(event.id)
          return (
            <div key={id} className='border-t px-4 py-2'>
              <p className='text-muted-foreground mb-1 flex items-center gap-1 text-xs'>
                <ChevronRightIcon className='size-3' /> 关联事件:{linkLabel(target)}
              </p>
              <EventSummaryCard event={target} eventsById={eventsById} depth={depth + 1} visited={nextVisited} />
            </div>
          )
        })}
    </Card>
  )
}

// 从详述文本中提取被引用的事件 ID(仅存在链接时)
function eventsFromDetail(detail: string): string[] {
  const ids: string[] = []
  const re = /\[\[事件([a-z0-9]{15})\]\]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(detail)) !== null) ids.push(m[1])
  return ids
}
