import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { Link2Icon, PencilIcon, TrashIcon } from 'lucide-react'
import { useState } from 'react'
import DeleteEventDialog from '@/components/health/delete-event-dialog'
import HealthEventText from '@/components/health/health-event-text'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  linkContextSnippet,
  buildRelatedEvents,
  linkLabel
} from '@/lib/render-links'
import { errorToast } from '@/lib/toast'
import {
  deleteHealthEvent,
  healthEventDetailQueryOptions,
  healthEventsQueryOptions
} from '@/services/api-health-events'

// 事件详情页:全部字段 + 详述(双链渲染)+ 关联事件面板 + 凭证
export default function EventDetailPage() {
  // 本路由必带 $eventId,用 from 字面量取类型安全的参数(不引入路由循环依赖)
  const { eventId } = useParams({ from: '/health/events/$eventId' })
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const detailQuery = useSuspenseQuery(healthEventDetailQueryOptions(eventId))
  const event = detailQuery.data
  // 链接选择器允许跨人引用,解析集合须全量,避免跨人链接误显示为已删除
  const eventsQuery = useSuspenseQuery(healthEventsQueryOptions(''))
  const allEvents = eventsQuery.data
  const eventsById = new Map(allEvents.map((e) => [e.id, e]))

  const { direct, dangling } = buildRelatedEvents(event, allEvents)

  const [deleting, setDeleting] = useState(false)
  const deleteMutation = useMutation({
    mutationFn: deleteHealthEvent,
    onSuccess: async () => {
      setDeleting(false)
      await queryClient.invalidateQueries({ queryKey: ['health_events'] })
      navigate({ to: '/health' })
    },
    onError: (e) => errorToast('删除失败', e)
  })

  const openLink = (id: string) => {
    navigate({ to: '/health/events/$eventId', params: { eventId: id } })
  }

  return (
    <main className='mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6'>
      <div className='flex items-center justify-between'>
        <Button asChild variant='ghost' size='sm'>
          <Link to='/health'>← 返回列表</Link>
        </Button>
        <div className='flex gap-2'>
          <Button asChild variant='outline' size='sm'>
            <Link to='/health/events/$eventId/edit' params={{ eventId: event.id }}>
              <PencilIcon className='size-4' /> 编辑
            </Link>
          </Button>
          <Button variant='destructive' size='sm' onClick={() => setDeleting(true)}>
            <TrashIcon className='size-4' /> 删除
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className='pb-2'>
          <CardTitle className='flex flex-wrap items-center gap-2'>
            <Badge variant='secondary'>{event.event_type}</Badge>
            {event.item && <span className='text-lg font-semibold'>{event.item}</span>}
            {event.conclusion && (
              <span className='text-muted-foreground text-lg'>{event.conclusion}</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className='space-y-3 text-sm'>
          <div className='grid grid-cols-1 gap-x-8 gap-y-2 md:grid-cols-2'>
            <p><span className='text-muted-foreground'>人:</span> {event.person}</p>
            <p><span className='text-muted-foreground'>时间:</span> {event.happen_at}</p>
            <p><span className='text-muted-foreground'>科属:</span> {event.department || '—'}</p>
            <p><span className='text-muted-foreground'>机构:</span> {event.institution || '—'}</p>
            <p><span className='text-muted-foreground'>接诊医师:</span> {event.doctor || '—'}</p>
          </div>
          {event.detail && (
            <div>
              <p className='text-muted-foreground mb-1'>详述</p>
              <HealthEventText detail={event.detail} eventsById={eventsById} onLinkClick={openLink} />
            </div>
          )}
          {event.receipt.length > 0 && (
            <div>
              <p className='text-muted-foreground mb-1'>原始凭证({event.receipt.length})</p>
              <div className='flex flex-wrap gap-2'>
                {event.receipt.map((name) => (
                  <a
                    key={name}
                    className='bg-muted inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs underline underline-offset-2'
                    href={`/api/files/health_events/${event.id}/${encodeURIComponent(name)}`}
                    target='_blank'
                    rel='noreferrer'>
                    {name}
                  </a>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 被关联面板:本事件被哪些事件所关联(纯入链)。
          入链的唯一来源是其他事件详述中的 [[事件<本ID>]] 文本链接,
          故上下文片段必然存在;悬挂 ID(已删除事件)灰化占位 */}
      <Card>
        <CardHeader className='pb-2'>
          <CardTitle className='flex items-center gap-2 text-base'>
            <Link2Icon className='size-4' /> 被关联事件
          </CardTitle>
        </CardHeader>
        <CardContent className='space-y-2 text-sm'>
          {direct.length === 0 && dangling.length === 0 && (
            <p className='text-muted-foreground'>暂无其他事件关联本事件。</p>
          )}
          {direct.map((source) => {
            const snippet = linkContextSnippet(source.detail, event.id)
            return (
              <div key={source.id} className='bg-muted/50 flex flex-wrap items-center gap-2 rounded-md px-3 py-2'>
                <Button
                  variant='link'
                  className='h-auto px-0'
                  onClick={() => openLink(source.id)}>
                  {linkLabel(source)}
                </Button>
                {snippet && <span className='text-muted-foreground text-xs'>{snippet}</span>}
              </div>
            )
          })}
          {/* 被引用列中的悬挂 ID:目标事件已删除,灰化占位 */}
          {dangling.map((id) => (
            <div
              key={id}
              className='bg-muted/50 flex items-center gap-2 rounded-md px-3 py-2 opacity-60'>
              <span className='text-muted-foreground text-sm'>已删除事件</span>
              <Badge variant='outline' className='text-xs'>
                已删除
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <DeleteEventDialog
        event={event}
        events={allEvents}
        open={deleting}
        pending={deleteMutation.isPending}
        onOpenChange={setDeleting}
        onDeleted={() => deleteMutation.mutate(event.id)}
      />
    </main>
  )
}
