import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { PlusIcon, SearchIcon, XIcon } from 'lucide-react'
import { useState } from 'react'
import DeleteEventDialog from '@/components/health/delete-event-dialog'
import EventTable from '@/components/health/event-table'
import PersonSelect from '@/components/health/person-select'
import RebuildIndexButton from '@/components/health/rebuild-index-button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { errorToast } from '@/lib/toast'
import type { HealthEvent } from '@/schemas/health-event-schema'
import {
  deleteHealthEvent,
  departmentOptionsOf,
  emptyHealthEventFilters,
  filterHealthEvents,
  HealthEventFilters,
  healthEventsQueryOptions,
  personOptionsOf
} from '@/services/api-health-events'

// 健康事件列表页:表格为主,筛选(人/类型/科属/时间范围/全文)在前端完成
export default function EventListPage() {
  const queryClient = useQueryClient()
  const eventsQuery = useSuspenseQuery(healthEventsQueryOptions(''))
  const allEvents = eventsQuery.data

  // 筛选草稿与已应用(点【查询】后生效)
  const [draft, setDraft] = useState<HealthEventFilters>(emptyHealthEventFilters)
  const [applied, setApplied] = useState<HealthEventFilters>(emptyHealthEventFilters)

  // 历史值
  const persons = personOptionsOf(allEvents)
  const departments = departmentOptionsOf(allEvents)
  const eventTypes = [...new Set(allEvents.map((e) => e.event_type).filter(Boolean))].sort()

  const visible = filterHealthEvents(allEvents, applied)

  const [deleting, setDeleting] = useState<HealthEvent | null>(null)
  // 删除目标 id 用可选链在渲染期求值(而非在回调里读 deleting!.id):
  // React Compiler 会把回调闭包内读取的 deleting.id 提取为渲染期 memo 键,
  // deleting 为 null 时求值即崩(生产构建实测 null.id);局部变量 + 守卫可避免
  const deletingId = deleting?.id
  const deleteMutation = useMutation({
    mutationFn: deleteHealthEvent,
    onSuccess: async () => {
      setDeleting(null)
      await queryClient.invalidateQueries({ queryKey: ['health_events'] })
    },
    onError: (e) => errorToast('删除失败', e)
  })

  return (
    <main className='mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-6'>
      <div className='flex items-center justify-between'>
        <h1 className='text-xl font-bold'>健康事件</h1>
        <div className='flex items-center gap-2'>
          <RebuildIndexButton />
          <Button asChild>
            <Link to='/health/events/new'>
              <PlusIcon className='size-4' /> 新建事件
            </Link>
          </Button>
        </div>
      </div>

      {/* 筛选栏 */}
      <div className='grid grid-cols-2 gap-3 rounded-lg border p-3 md:grid-cols-4'>
        <div className='space-y-1'>
          <Label>人</Label>
          <PersonSelect value={draft.person} options={persons} onChange={(v) => setDraft({ ...draft, person: v })} />
        </div>
        <div className='space-y-1'>
          <Label>时间范围</Label>
          <div className='flex items-center gap-1'>
            <Input
              type='date'
              value={draft.from}
              onChange={(e) => setDraft({ ...draft, from: e.target.value })}
            />
            <span className='text-muted-foreground'>至</span>
            <Input
              type='date'
              value={draft.to}
              onChange={(e) => setDraft({ ...draft, to: e.target.value })}
            />
          </div>
        </div>
        <div className='space-y-1'>
          <Label>类型</Label>
          <ToggleGroup
            type='multiple'
            value={draft.eventTypes}
            onValueChange={(v) => setDraft({ ...draft, eventTypes: v })}>
            {eventTypes.map((t) => (
              <ToggleGroupItem key={t} value={t} className='px-2 text-xs'>
                {t}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <div className='space-y-1'>
          <Label>科属</Label>
          <ToggleGroup
            type='multiple'
            value={draft.departments}
            onValueChange={(v) => setDraft({ ...draft, departments: v })}>
            {departments.map((d) => (
              <ToggleGroupItem key={d} value={d} className='px-2 text-xs'>
                {d}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <div className='col-span-2 space-y-1 md:col-span-4'>
          <Label>全文搜索</Label>
          <div className='flex gap-2'>
            <Input
              placeholder='搜索项目/结论/详述/机构/医师…'
              value={draft.keyword}
              onChange={(e) => setDraft({ ...draft, keyword: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setApplied(draft)
              }}
            />
            <Button onClick={() => setApplied(draft)}>
              <SearchIcon className='size-4' /> 查询
            </Button>
            <Button
              variant='outline'
              onClick={() => {
                setDraft(emptyHealthEventFilters)
                setApplied(emptyHealthEventFilters)
              }}>
              <XIcon className='size-4' /> 清空
            </Button>
          </div>
        </div>
      </div>

      <p className='text-muted-foreground text-sm'>共 {visible.length} 条事件</p>
      <EventTable
        events={visible}
        emptyHint={allEvents.length === 0 ? undefined : '没有匹配的结果'}
        onDelete={setDeleting}
      />

      <DeleteEventDialog
        event={deleting}
        events={allEvents}
        open={deleting !== null}
        pending={deleteMutation.isPending}
        onOpenChange={(v) => !v && setDeleting(null)}
        onDeleted={() => {
          if (deletingId) deleteMutation.mutate(deletingId)
        }}
      />
    </main>
  )
}
