import { useSuspenseQuery } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import EventForm from '@/components/health/event-form'
import { Button } from '@/components/ui/button'
import { healthEventsQueryOptions } from '@/services/api-health-events'

// 新建/编辑事件页面:页面壳(标题/返回)+ 复用 EventForm 组件。
// 「插入事件链接」选择器内的新建模式同样嵌入 EventForm,两次新增流程字段与逻辑一致。
export default function EventFormPage() {
  const navigate = useNavigate()
  const { eventId } = useParams({ strict: false })
  const editing = Boolean(eventId)

  const eventsQuery = useSuspenseQuery(healthEventsQueryOptions(''))
  const allEvents = eventsQuery.data
  const editingEvent = editing ? allEvents.find((e) => e.id === eventId) : undefined

  if (editing && !editingEvent) {
    return <p className='py-12 text-center'>事件不存在或已删除。</p>
  }

  return (
    <main className='mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-6'>
      <div className='flex items-center gap-2'>
        <Button asChild variant='ghost' size='sm'>
          <Link
            to={editing ? '/health/events/$eventId' : '/health'}
            params={editing ? { eventId } : {}}>
            ← 返回
          </Link>
        </Button>
        <h1 className='text-xl font-bold'>{editing ? '编辑事件' : '新建事件'}</h1>
      </div>

      <EventForm
        editingEvent={editing ? editingEvent : undefined}
        onSaved={(saved) =>
          navigate({ to: '/health/events/$eventId', params: { eventId: saved.id } })
        }
        onCancel={() =>
          navigate({
            to: editing ? '/health/events/$eventId' : '/health',
            params: editing ? { eventId } : {}
          })
        }
      />
    </main>
  )
}
