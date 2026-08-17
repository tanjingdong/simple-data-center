import type { HealthEvent } from '@/schemas/health-event-schema'
import { splitDetailLinks } from '@/lib/render-links'
import { Button } from '@/components/ui/button'

// 详述渲染:[[事件<ID>]] → 可点击链接标签;悬挂 ID → 灰化占位;其余为普通文本
export default function HealthEventText({
  detail,
  eventsById,
  onLinkClick
}: {
  detail: string
  eventsById: Map<string, HealthEvent>
  onLinkClick: (id: string) => void
}) {
  const parts = splitDetailLinks(detail, eventsById)
  return (
    <div className='whitespace-pre-wrap break-words'>
      {parts.map((part, i) => {
        if (part.kind === 'text') return <span key={i}>{part.text}</span>
        if (part.kind === 'dangling') {
          return (
            <span key={i} className='text-muted-foreground rounded bg-gray-100 px-1 dark:bg-gray-800'>
              [已删除事件]
            </span>
          )
        }
        return (
          <Button
            key={i}
            type='button'
            variant='link'
            className='h-auto px-0.5 align-baseline text-base underline'
            onClick={() => onLinkClick(part.id)}>
            {part.label}
          </Button>
        )
      })}
    </div>
  )
}
