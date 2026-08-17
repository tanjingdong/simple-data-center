import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import type { HealthEvent } from '@/schemas/health-event-schema'
import { buildRelatedEvents } from '@/lib/render-links'

// 删除确认:列出引用影响与附件数量(硬删除,不做软删除)
export default function DeleteEventDialog({
  event,
  events,
  open,
  onOpenChange,
  onDeleted,
  pending
}: {
  event: HealthEvent | null
  events: HealthEvent[]
  open: boolean
  onOpenChange: (v: boolean) => void
  onDeleted: () => void
  pending?: boolean
}) {
  if (!event) return null
  const { direct, dangling } = buildRelatedEvents(event, events)
  const referencedCount = direct.length + dangling.length
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>删除事件</DialogTitle>
          <DialogDescription className='space-y-1'>
            <p>
              确定删除「{event.happen_at} · {event.event_type} · {event.item || event.conclusion || '无标题'}」?
            </p>
            {referencedCount > 0 && (
              <p className='text-destructive'>
                本事件被 {direct.length} 个事件引用
                {dangling.length > 0 && `(另有 ${dangling.length} 个已删除的引用)`}
                ,删除后引用处将显示「已删除事件」占位。
              </p>
            )}
            {event.receipt.length > 0 && (
              <p>本事件携带 {event.receipt.length} 个原始凭证附件,将一并删除。</p>
            )}
            <p className='text-muted-foreground'>此操作不可恢复。</p>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button variant='destructive' disabled={pending} onClick={onDeleted}>
            {pending ? '删除中…' : '确认删除'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
