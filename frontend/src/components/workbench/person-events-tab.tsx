import { Button } from '@/components/ui/button'
import { Event } from '@/schemas/event-schema'
import {
  deleteEvent,
  eventsOfPersonQueryOptions
} from '@/services/api-events'
import { personDetailQueryOptions } from '@/services/api-persons'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { PlusIcon } from 'lucide-react'
import { useState } from 'react'
import EventCard from './event-card'
import EventFormDialog from './event-form-dialog'

// 人员事件时间线:用 EventCard 渲染(内联参与方 chip);新增时 prefill 当前人 token。
export default function PersonEventsTab({
  personId,
  onSelectTarget
}: {
  personId: string
  onSelectTarget?: (target: {
    type: 'persons' | 'organizations'
    id: string
  }) => void
}) {
  const { data: person } = useSuspenseQuery(personDetailQueryOptions(personId))
  const { data: events } = useSuspenseQuery(eventsOfPersonQueryOptions(personId))
  const [open, setOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<Event | null>(null)
  const queryClient = useQueryClient()

  const deleteMutation = useMutation({
    mutationFn: deleteEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['persons', personId, 'events'] })
    }
  })

  const personLabel = `${person.last_name}${person.first_name}`

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
        prefill={{ kind: 'p', id: personId, label: personLabel }}
        event={editingEvent ?? undefined}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setEditingEvent(null)
        }}
      />
    </div>
  )
}
