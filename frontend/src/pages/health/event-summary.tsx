import { useSuspenseQuery } from '@tanstack/react-query'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { CopyIcon, PrinterIcon } from 'lucide-react'
import EventSummaryCard from '@/components/health/event-summary-card'
import PersonSelect from '@/components/health/person-select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { buildSummaryText } from '@/lib/render-links'
import { successToast } from '@/lib/toast'
import {
  departmentOptionsOf,
  emptyHealthEventFilters,
  filterHealthEvents,
  healthEventsQueryOptions,
  personOptionsOf
} from '@/services/api-health-events'
import { z } from 'zod/v4'

// 归集页检索参数(URL 驱动,便于医生保存/分享链接)
export const eventSummarySearchSchema = z.object({
  person: z.string().catch(''),
  from: z.string().catch(''),
  to: z.string().catch(''),
  departments: z.array(z.string()).catch([])
})
export type EventSummarySearch = z.infer<typeof eventSummarySearchSchema>

// 归集页:选人 + 时间范围 + 科属(多选) → 按时间正序的医生视角摘要,
// 链接页内展开,可打印、可一键复制(兼作 AI 自诊输入)。
export default function EventSummaryPage() {
  const search = useSearch({ strict: false }) as EventSummarySearch
  const navigate = useNavigate()

  const eventsQuery = useSuspenseQuery(healthEventsQueryOptions(search.person))
  const allEvents = eventsQuery.data
  const persons = personOptionsOf(allEvents)
  const departments = departmentOptionsOf(allEvents)

  const visible = filterHealthEvents(allEvents, {
    ...emptyHealthEventFilters,
    person: search.person,
    departments: search.departments,
    from: search.from,
    to: search.to
  }).sort((a, b) => (a.happen_at < b.happen_at ? -1 : 1))

  const institutions = [...new Set(visible.map((e) => e.institution).filter(Boolean))].sort()
  // 链接解析集合用全量,避免筛选排除导致的误报
  const eventsById = new Map(allEvents.map((e) => [e.id, e]))

  const updateSearch = (patch: Partial<EventSummarySearch>) => {
    navigate({ to: '/health/summary', search: { ...search, ...patch } })
  }

  const copySummary = async () => {
    await navigator.clipboard.writeText(buildSummaryText(visible))
    successToast('归集摘要已复制')
  }

  return (
    <main className='mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-6'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <h1 className='text-xl font-bold'>健康归集</h1>
        <div className='print:hidden flex gap-2'>
          <Button variant='outline' size='sm' onClick={copySummary}>
            <CopyIcon className='size-4' /> 复制全文
          </Button>
          <Button variant='outline' size='sm' onClick={() => window.print()}>
            <PrinterIcon className='size-4' /> 打印
          </Button>
          <Button asChild variant='ghost' size='sm'>
            <Link to='/health'>← 返回列表</Link>
          </Button>
        </div>
      </div>

      {/* 参数区(打印时隐藏) */}
      <div className='print:hidden grid grid-cols-1 gap-3 rounded-lg border p-3 md:grid-cols-2'>
        <div className='space-y-1'>
          <Label>人(必选)</Label>
          <PersonSelect
            value={search.person}
            options={persons}
            onChange={(v) => updateSearch({ person: v })}
          />
        </div>
        <div className='space-y-1'>
          <Label>时间范围</Label>
          <div className='flex items-center gap-1'>
            <Input
              type='date'
              value={search.from}
              onChange={(e) => updateSearch({ from: e.target.value })}
            />
            <span className='text-muted-foreground'>至</span>
            <Input
              type='date'
              value={search.to}
              onChange={(e) => updateSearch({ to: e.target.value })}
            />
          </div>
        </div>
        <div className='col-span-1 space-y-1 md:col-span-2'>
          <Label>科属(多选,可空=全部)</Label>
          <ToggleGroup
            type='multiple'
            value={search.departments}
            onValueChange={(v) => updateSearch({ departments: v })}>
            {departments.map((d) => (
              <ToggleGroupItem key={d} value={d} className='px-2 text-xs'>
                {d}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>

      {search.person ? (
        <>
          {/* 顶部摘要 */}
          <div className='text-sm'>
            <p>
              <span className='font-medium'>{search.person}</span>
              {search.from || search.to
                ? ` · ${search.from || '…'} 至 ${search.to || '…'}`
                : ' · 全部时间'}
              {search.departments.length ? ` · 科属:${search.departments.join('/')}` : ''}
            </p>
            <p className='text-muted-foreground'>
              共 {visible.length} 条事件 · 涉及机构:{institutions.join('、') || '—'}
            </p>
          </div>

          {visible.length === 0 ? (
            <p className='text-muted-foreground py-12 text-center'>该条件下暂无事件。</p>
          ) : (
            <div className='space-y-2'>
              {visible.map((e) => (
                <EventSummaryCard key={e.id} event={e} eventsById={eventsById} depth={0} visited={new Set()} />
              ))}
            </div>
          )}
        </>
      ) : (
        <p className='text-muted-foreground py-12 text-center'>
          请先在上方选择「人」,系统将按时间顺序归集其健康事件。
        </p>
      )}
    </main>
  )
}
