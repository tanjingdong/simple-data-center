import GtdItemDialog from '@/components/gtd/item-dialog'
import { emptyGtdItemForm } from '@/components/gtd/item-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import useAuth from '@/hooks/use-auth'
import { errorToast, successToast } from '@/lib/toast'
import {
  gtdConditionLabels,
  gtdConditions,
  gtdItemFormSchema,
  gtdStatusLabels,
  gtdTypeLabels,
  gtdTypes,
  type GtdCondition,
  type GtdItem,
  type GtdItemFormFields
} from '@/schemas/gtd-item-schema'
import {
  assigneeNames,
  createGtdItem,
  deleteGtdItem,
  formatHardTime,
  gtdItemsQueryOptions,
  todayStr,
  updateGtdItem,
  updateGtdItemStatus
} from '@/services/api-gtd-items'
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery
} from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { PrinterIcon, SearchIcon } from 'lucide-react'
import { useMemo, useState } from 'react'

/** 快捷添加行的初始值(生效日期默认今天) */
const emptyQuickAdd = () => emptyGtdItemForm()

/** 列表默认只显示进行中的事项;切换到「全部」可查看已完成/已取消的历史 */
type StatusFilter = 'active' | 'all'
const ALL = 'all'

export default function GtdListPage() {
  const { user } = useAuth()
  const ownerId = user?.id ?? ''
  const queryClient = useQueryClient()

  const { data: items } = useSuspenseQuery(gtdItemsQueryOptions(ownerId))

  // 快捷添加行
  const [quick, setQuick] = useState<GtdItemFormFields>(emptyQuickAdd)
  // 筛选
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [typeFilter, setTypeFilter] = useState<string>(ALL)
  const [conditionFilter, setConditionFilter] = useState<string>(ALL)
  const [keyword, setKeyword] = useState('')
  // 弹框
  const [editing, setEditing] = useState<GtdItem | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['gtd_items', 'list', ownerId] })

  const today = todayStr()

  const visible = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    return items.filter((it) => {
      if (statusFilter === 'active' && it.status !== 'active') return false
      if (typeFilter !== ALL && it.type !== typeFilter) return false
      if (conditionFilter !== ALL && it.condition !== conditionFilter)
        return false
      if (kw) {
        const haystack = `${it.thing} ${it.note}`.toLowerCase()
        if (!haystack.includes(kw)) return false
      }
      return true
    })
  }, [items, statusFilter, typeFilter, conditionFilter, keyword])

  // ---- 变更 ----
  const createMut = useMutation({
    mutationFn: (data: GtdItemFormFields) => createGtdItem(ownerId, data),
    onSuccess: async (created) => {
      successToast('已新增', created.thing)
      await invalidate()
    },
    onError: (err) => errorToast('新增失败', err)
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: GtdItemFormFields }) =>
      updateGtdItem(id, data),
    onSuccess: async () => {
      successToast('已更新')
      await invalidate()
    },
    onError: (err) => errorToast('更新失败', err)
  })

  // 复选框切换:失败时不 invalidate,界面保持原状(天然回弹)
  const statusMut = useMutation({
    mutationFn: ({
      id,
      status
    }: {
      id: string
      status: 'active' | 'completed'
    }) => updateGtdItemStatus(id, status),
    onSuccess: async () => {
      await invalidate()
    },
    onError: (err) => errorToast('状态切换失败', err)
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteGtdItem(id),
    onSuccess: async () => {
      successToast('已删除')
      await invalidate()
    },
    onError: (err) => errorToast('删除失败', err)
  })

  // ---- 快捷添加:回车即建,建完清空并聚焦回名称框 ----
  async function handleQuickAdd() {
    const parsed = gtdItemFormSchema.safeParse(quick)
    if (!parsed.success) {
      errorToast('无法新增', parsed.error.issues[0]?.message ?? '输入不合法')
      return
    }
    await createMut.mutateAsync(parsed.data)
    // 保留类型选择,便于连续录入同类事项
    setQuick({ ...emptyQuickAdd(), type: quick.type })
    document.getElementById('gtd-quick-thing')?.focus()
  }

  function openNew() {
    setEditing(null)
    setDialogOpen(true)
  }

  function openEdit(item: GtdItem) {
    setEditing(item)
    setDialogOpen(true)
  }

  function conditionLabelOf(condition: string): string {
    return condition
      ? (gtdConditionLabels[condition as GtdCondition] ?? condition)
      : '—'
  }

  return (
    <main className='flex w-full flex-col gap-4'>
      <div className='flex items-center justify-between'>
        <h1 className='text-2xl font-bold'>GTD 清单</h1>
        <div className='flex gap-2'>
          <Button variant='outline' onClick={openNew}>
            新增事项
          </Button>
          <Button asChild variant='outline'>
            <Link to='/gtd/print' target='_blank'>
              <PrinterIcon className='size-4' />
              打印清单
            </Link>
          </Button>
        </div>
      </div>

      {/* 快捷添加行 */}
      <div className='bg-muted/40 flex flex-wrap items-end gap-2 rounded-lg border p-3'>
        <div className='flex min-w-45 flex-1 flex-col gap-1.5'>
          <Label htmlFor='gtd-quick-thing' className='text-xs'>
            事项名称
          </Label>
          <Input
            id='gtd-quick-thing'
            placeholder='输入后按回车即建'
            value={quick.thing}
            onChange={(e) => setQuick({ ...quick, thing: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleQuickAdd()
            }}
          />
        </div>

        <div className='flex flex-col gap-1.5'>
          <Label className='text-xs'>类型</Label>
          <Select
            value={quick.type}
            onValueChange={(v) =>
              setQuick({ ...quick, type: v as GtdItemFormFields['type'] })
            }>
            <SelectTrigger className='w-28'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {gtdTypes.map((t) => (
                <SelectItem key={t} value={t}>
                  {gtdTypeLabels[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className='flex flex-col gap-1.5'>
          <Label className='text-xs'>生效日期</Label>
          <Input
            type='date'
            className='w-38'
            value={quick.schedule_on}
            onChange={(e) =>
              setQuick({ ...quick, schedule_on: e.target.value })
            }
          />
        </div>

        <div className='flex flex-col gap-1.5'>
          <Label className='text-xs'>条件</Label>
          <Select
            value={quick.condition || '__none__'}
            disabled={quick.type !== 'todo'}
            onValueChange={(v) =>
              setQuick({
                ...quick,
                condition: v === '__none__' ? '' : (v as GtdCondition)
              })
            }>
            <SelectTrigger className='w-36'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='__none__'>(无 / 其他)</SelectItem>
              {gtdConditions.map((c) => (
                <SelectItem key={c} value={c}>
                  {gtdConditionLabels[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className='flex flex-col gap-1.5'>
          <Label className='text-xs'>硬时间</Label>
          <Input
            type='datetime-local'
            className='w-52'
            value={quick.hard_time.replace(' ', 'T')}
            onChange={(e) =>
              setQuick({
                ...quick,
                hard_time: e.target.value.replace('T', ' ')
              })
            }
          />
        </div>

        <div className='flex flex-col gap-1.5'>
          <Label className='text-xs'>受让人</Label>
          <Input
            className='w-36'
            placeholder='逗号分隔'
            value={quick.assignee.join(',')}
            onChange={(e) =>
              setQuick({
                ...quick,
                assignee: e.target.value
                  .split(',')
                  .map((s) => s.trim())
                  .filter((s) => s !== '')
              })
            }
          />
        </div>

        <Button onClick={() => void handleQuickAdd()}>添加</Button>
      </div>

      {/* 筛选 */}
      <div className='flex flex-wrap items-center gap-2'>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className='w-32'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='active'>仅进行中</SelectItem>
            <SelectItem value='all'>全部状态</SelectItem>
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className='w-32'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>全部类型</SelectItem>
            {gtdTypes.map((t) => (
              <SelectItem key={t} value={t}>
                {gtdTypeLabels[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={conditionFilter} onValueChange={setConditionFilter}>
          <SelectTrigger className='w-36'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>全部条件</SelectItem>
            {gtdConditions.map((c) => (
              <SelectItem key={c} value={c}>
                {gtdConditionLabels[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className='relative'>
          <SearchIcon className='text-muted-foreground absolute top-2.5 left-2 size-4' />
          <Input
            className='w-60 pl-8'
            placeholder='搜索事项名称或备注'
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
        </div>

        <span className='text-muted-foreground text-sm'>
          共 {visible.length} 条
        </span>
      </div>

      {/* 表格 */}
      <div className='rounded-lg border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className='w-10'>完成</TableHead>
              <TableHead>事项</TableHead>
              <TableHead className='w-24'>类型</TableHead>
              <TableHead className='w-28'>生效日期</TableHead>
              <TableHead className='w-32'>硬时间</TableHead>
              <TableHead className='w-28'>条件</TableHead>
              <TableHead className='w-32'>受让人</TableHead>
              <TableHead className='w-24'>状态</TableHead>
              <TableHead className='w-28'>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className='text-muted-foreground h-24 text-center'>
                  没有符合条件的事项
                </TableCell>
              </TableRow>
            )}
            {visible.map((it) => (
              <TableRow key={it.id}>
                <TableCell>
                  <input
                    type='checkbox'
                    aria-label={`切换 ${it.thing} 的完成状态`}
                    checked={it.status === 'completed'}
                    onChange={(e) =>
                      statusMut.mutate({
                        id: it.id,
                        status: e.target.checked ? 'completed' : 'active'
                      })
                    }
                  />
                </TableCell>
                <TableCell>
                  <button
                    type='button'
                    className='cursor-pointer text-left hover:underline'
                    onClick={() => openEdit(it)}>
                    {it.thing}
                  </button>
                  {it.note && (
                    <div className='text-muted-foreground line-clamp-1 text-xs'>
                      {it.note}
                    </div>
                  )}
                </TableCell>
                <TableCell>{gtdTypeLabels[it.type]}</TableCell>
                <TableCell>{it.schedule_on}</TableCell>
                <TableCell>{formatHardTime(it.hard_time, today)}</TableCell>
                <TableCell>{conditionLabelOf(it.condition)}</TableCell>
                <TableCell>
                  {assigneeNames(it.assignee).join(',') || '—'}
                </TableCell>
                <TableCell>{gtdStatusLabels[it.status]}</TableCell>
                <TableCell>
                  <div className='flex gap-1'>
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={() => openEdit(it)}>
                      编辑
                    </Button>
                    <Button
                      variant='ghost'
                      size='sm'
                      className='text-destructive'
                      onClick={() => {
                        if (
                          window.confirm(
                            `确认删除「${it.thing}」?此操作不可撤销。`
                          )
                        )
                          deleteMut.mutate(it.id)
                      }}>
                      删除
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <GtdItemDialog
        open={dialogOpen}
        item={editing}
        onOpenChange={setDialogOpen}
        onSubmit={async (data) => {
          if (editing) await updateMut.mutateAsync({ id: editing.id, data })
          else await createMut.mutateAsync(data)
        }}
      />
    </main>
  )
}
