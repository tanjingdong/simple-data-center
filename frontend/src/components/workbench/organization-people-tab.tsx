import { Button } from '@/components/ui/button'
import { Event } from '@/schemas/event-schema'
import {
  deleteEvent,
  orgEmploymentEventsQueryOptions
} from '@/services/api-events'
import { organizationDetailQueryOptions } from '@/services/api-organizations'
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery
} from '@tanstack/react-query'
import { PlusIcon } from 'lucide-react'
import { useState } from 'react'
import EventCard from './event-card'
import EventFormDialog from './event-form-dialog'

// 组织相关人员:该组织的任职/离职事件列表(不含会议/电话等其它类型事件)。
// 删除事件须连带失效:事件可能含人员 token,人员时间线与组织事件 Tab 都要刷新。
export default function OrganizationPeopleTab({
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
  const { data: events } = useSuspenseQuery(
    orgEmploymentEventsQueryOptions(orgId)
  )
  const [open, setOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<Event | null>(null)
  const queryClient = useQueryClient()

  const deleteMutation = useMutation({
    mutationFn: deleteEvent,
    onSuccess: () => {
      // 本 Tab(people)+ 组织事件 Tab(events)同属 org 详情前缀;
      // 事件含人员 token → 全体人员事件缓存一并失效
      queryClient.invalidateQueries({ queryKey: ['organizations', orgId] })
      queryClient.invalidateQueries({ queryKey: ['persons'] })
    }
  })

  return (
    <div className='space-y-2'>
      <div className='flex items-center justify-between'>
        <h2 className='text-sm font-semibold'>相关人员</h2>
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
            暂无任职/离职记录
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
