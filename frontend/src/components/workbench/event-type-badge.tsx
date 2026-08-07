import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/shadcn'

// 事件类型徽章配色映射(类型开放值,未知类型走默认灰)
const typeStyles: Record<string, string> = {
  电话: 'bg-blue-500/15 text-blue-700',
  面谈: 'bg-teal-500/15 text-teal-700',
  升职: 'bg-green-500/15 text-green-700',
  处分: 'bg-red-500/15 text-red-700',
  会议: 'bg-purple-500/15 text-purple-700',
  签约: 'bg-orange-500/15 text-orange-700'
}

export function EventTypeBadge({ type }: { type: string }) {
  if (!type) return null
  return (
    <Badge variant='outline' className={cn('text-xs', typeStyles[type])}>
      {type}
    </Badge>
  )
}
