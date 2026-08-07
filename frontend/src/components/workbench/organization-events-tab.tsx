import { Button } from '@/components/ui/button'
import { Event } from '@/schemas/event-schema'
import {
  deleteEvent,
  eventsOfOrgQueryOptions
} from '@/services/api-events'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { useState } from 'react'
import EventFormDialog from './event-form-dialog'
import { EventTypeBadge } from './event-type-badge'

// 组织事件时间线:日期 + 类型徽章 + 事件主体人员名 + 摘要;
// 可新增(弹窗 orgId 模式:组织固定、人员必选)、编辑(弹窗)、删除(确认)
export default function OrganizationEventsTab({ orgId }: { orgId: string }) {
  const { data: events } = useSuspenseQuery(eventsOfOrgQueryOptions(orgId))
  const [open, setOpen] = useState(false)
  // 编辑中的事件记录;非空时弹窗进入编辑模式(EventWithExpand 结构兼容 Event,可直接赋值)
  const [editingEvent, setEditingEvent] = useState<Event | null>(null)
  const queryClient = useQueryClient()

  const deleteMutation = useMutation({
    mutationFn: deleteEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations', orgId, 'events'] })
    }
  })

  return (
    <div className='space-y-2'>
      <div className='flex items-center justify-between'>
        <h2 className='text-sm font-semibold'>事件时间线</h2>
        <Button size='sm' onClick={() => setOpen(true)}>
          <PlusIcon className='size-4' /> 新增
        </Button>
      </div>
      <ul className='divide-y'>
        {events.map((event) => {
          const person = event.expand?.person_id
          const personName = person
            ? `${person.last_name}${person.first_name}`
            : ''
          return (
            <li key={event.id} className='flex gap-3 py-2'>
              <span className='text-muted-foreground w-24 shrink-0 text-sm tabular-nums'>
                {event.happen_at}
              </span>
              <div className='flex-1 space-y-1'>
                <div className='flex items-center gap-2'>
                  <EventTypeBadge type={event.type ?? ''} />
                  {personName && (
                    <span className='text-muted-foreground text-xs'>
                      {personName}
                    </span>
                  )}
                </div>
                <p className='text-sm'>{event.summary}</p>
              </div>
              <span className='flex items-center'>
                <Button
                  variant='ghost'
                  size='icon'
                  aria-label='编辑'
                  onClick={() => setEditingEvent(event)}>
                  <PencilIcon className='size-4' />
                </Button>
                <Button
                  variant='ghost'
                  size='icon'
                  aria-label='删除'
                  onClick={() => {
                    if (confirm(`确定删除 ${event.happen_at} 的事件记录?`)) {
                      deleteMutation.mutate(event.id)
                    }
                  }}>
                  <Trash2Icon className='size-4' />
                </Button>
              </span>
            </li>
          )
        })}
        {events.length === 0 && (
          <li className='text-muted-foreground py-4 text-center text-sm'>
            暂无事件记录
          </li>
        )}
      </ul>
      {/* 新增/编辑共用弹窗:编辑时传 event 进入编辑模式;关闭时清空编辑状态 */}
      <EventFormDialog
        open={open || editingEvent !== null}
        orgId={orgId}
        event={editingEvent ?? undefined}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setEditingEvent(null)
        }}
      />
    </div>
  )
}
