import { Button } from '@/components/ui/button'
import { Event } from '@/schemas/event-schema'
import {
  deleteEvent,
  eventsOfOrgQueryOptions
} from '@/services/api-events'
import { organizationDetailQueryOptions } from '@/services/api-organizations'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { PlusIcon } from 'lucide-react'
import { useState } from 'react'
import EventCard from './event-card'
import EventFormDialog from './event-form-dialog'

// 组织事件时间线:用 EventCard 渲染;新增时 prefill 当前组织 token。
export default function OrganizationEventsTab({
  orgId,
  onSelectTarget
}: {
  orgId: string
  onSelectTarget?: (target: {
    type: 'persons' | 'organizations'
    id: string
  }) => void
}) {
  const { data: org } = useSuspenseQuery(organizationDetailQueryOptions(orgId))
  const { data: events } = useSuspenseQuery(eventsOfOrgQueryOptions(orgId))
  const [open, setOpen] = useState(false)
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
        {events.map((event) => (
          <li key={event.id}>
            <EventCard
              event={event}
              onEdit={() => setEditingEvent(event)}
              onSelectTarget={onSelectTarget}
              onDelete={() => {
                if (confirm(`确定删除 ${event.happen_at} 的事件记录?`)) {
                  deleteMutation.mutate(event.id)
                }
              }}
            />
          </li>
        ))}
        {events.length === 0 && (
          <li className='text-muted-foreground py-4 text-center text-sm'>
            暂无事件记录
          </li>
        )}
      </ul>
      <EventFormDialog
        open={open || editingEvent !== null}
        prefill={{ kind: 'o', id: orgId, label: org.name }}
        event={editingEvent ?? undefined}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setEditingEvent(null)
        }}
      />
    </div>
  )
}
