import {
  AddButton,
  FitList,
  GtdModal,
  HardTimeList,
  ProjectsList,
  SectionHardTime,
  SectionSupport,
  SectionTodayActions,
  TodayActionsList
} from '@/components/gtd/print-sections'
import useAuth from '@/hooks/use-auth'
import '@/lib/gtd-print.css'
import { errorToast } from '@/lib/toast'
import type {
  GtdItem,
  GtdItemFormFields,
  GtdStatus
} from '@/schemas/gtd-item-schema'
import {
  createGtdItem,
  deleteGtdItem,
  groupTodayActions,
  gtdItemsQueryOptions,
  partitionItems,
  todayStr,
  updateGtdItem,
  updateGtdItemStatus
} from '@/services/api-gtd-items'
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery
} from '@tanstack/react-query'
import { useState } from 'react'

export default function GtdPrintPage() {
  const today = todayStr()
  const { user } = useAuth()
  const ownerId = user?.id ?? ''
  const queryClient = useQueryClient()

  const { data: items } = useSuspenseQuery(gtdItemsQueryOptions(ownerId))

  const parts = partitionItems(items, today)
  const groups = groupTodayActions(parts.todayActions)

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['gtd_items', 'list', ownerId] })

  // 复选框:勾选即完成(与原 MTR 一致,不留「已完成但仍在纸上」的中间态)。
  // 失败时不 invalidate,界面保持原状即天然回弹。
  const statusMut = useMutation({
    // 状态放宽到全部三种:复选框用 active/completed,弹框的「取消事项」用 cancelled
    mutationFn: ({ id, status }: { id: string; status: GtdStatus }) =>
      updateGtdItemStatus(id, status),
    onSuccess: () => invalidate(),
    onError: (err) => errorToast('状态切换失败', err)
  })

  const handleToggle = (it: GtdItem, checked: boolean) => {
    statusMut.mutate({ id: it.id, status: checked ? 'completed' : 'active' })
  }

  // ---- 编辑弹框 ----
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<GtdItem | null>(null)
  const [preset, setPreset] = useState<Partial<GtdItemFormFields> | null>(null)

  const handleOpen = (it: GtdItem) => {
    setEditing(it)
    setPreset(null)
    setModalOpen(true)
  }

  /**
   * 分区标题的 + :按所在分区预填类型。
   * 硬时间区额外把焦点导向硬时间输入框——原 MTR 的 data-preset 里声明过
   * needs_hard_time 但从未实现(死代码),这里用轻量方式补上那个意图。
   */
  const handleAdd = (
    presetType: GtdItemFormFields['type'],
    focusHardTime = false
  ) => {
    setEditing(null)
    setPreset({ type: presetType })
    setModalOpen(true)
    if (focusHardTime) {
      window.setTimeout(() => {
        document.getElementById('gtd-modal-hard-time')?.focus()
      }, 0)
    }
  }

  const createMut = useMutation({
    mutationFn: (data: GtdItemFormFields) => createGtdItem(ownerId, data),
    onSuccess: () => invalidate(),
    onError: (err) => errorToast('新增失败', err)
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: GtdItemFormFields }) =>
      updateGtdItem(id, data),
    onSuccess: () => invalidate(),
    onError: (err) => errorToast('更新失败', err)
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteGtdItem(id),
    onSuccess: () => invalidate(),
    onError: (err) => errorToast('删除失败', err)
  })

  return (
    <main className='gtd-print-root'>
      <div className='gtd-screen-only'>
        <span>GTD 清单 · A4 打印预览</span>
        <button type='button' onClick={() => window.print()}>
          打印
        </button>
      </div>

      {/* ==================== 第 1 页:今日执行指挥部 ==================== */}
      <div className='page' id='page1'>
        <div className='page-header'>
          <span className='label'>日期:</span>
          <div className='line'>{today}</div>
          <span className='label' style={{ marginLeft: '4mm' }}>
            今日意图(一句话):
          </span>
          <div className='line' />
        </div>

        <div className='main-body'>
          <div className='col-main'>
            <SectionTodayActions onAdd={() => handleAdd('todo')}>
              <TodayActionsList
                groups={groups}
                onOpen={handleOpen}
                onToggle={handleToggle}
              />
            </SectionTodayActions>
          </div>

          <div className='col-side'>
            <SectionHardTime onAdd={() => handleAdd('todo', true)}>
              <HardTimeList
                items={parts.hardTime}
                today={today}
                onOpen={handleOpen}
                onToggle={handleToggle}
              />
            </SectionHardTime>
            <SectionSupport onAddProject={() => handleAdd('project')}>
              <ProjectsList
                items={parts.projects}
                onOpen={handleOpen}
                onToggle={handleToggle}
              />
            </SectionSupport>
          </div>
        </div>

        <div className='page-footer'>
          <span className='label'>日终3分钟回顾</span>
          <div className='footer-check'>
            <input type='checkbox' className='gtd-cb' /> 收集箱清空?
          </div>
          <span style={{ opacity: 0.4 }}>|</span>
          <span>最大成果:</span>
          <div className='line' style={{ minWidth: '25mm' }} />
          <span>明日首要MIT:</span>
          <div className='line' style={{ minWidth: '25mm' }} />
        </div>
      </div>

      {/* ==================== 第 2 页:长期事务与规划 ==================== */}
      <div className='page' id='page2'>
        <div className='page-header'>
          <span className='label'>本周主题:</span>
          <div className='line' />
          <span className='label' style={{ marginLeft: '4mm' }}>
            季度焦点:
          </span>
          <div className='line' />
        </div>

        <div className='milestone-section'>
          <div className='milestone-header'>
            <span>本周预期里程碑 · Milestones</span>
            <AddButton
              label='新增里程碑'
              onAdd={() => handleAdd('milestone')}
            />
          </div>
          <div className='milestone-body' id='section-milestones'>
            <div
              className='sub-label'
              style={{ margin: '0 0 1mm 0', padding: 0 }}>
              schedule_on 落在本周的里程碑
            </div>
            <FitList
              items={parts.milestones}
              variant='milestone'
              onOpen={handleOpen}
              onToggle={handleToggle}
            />
          </div>
        </div>

        <div className='three-col'>
          <div className='col-third'>
            <div className='col-third-header'>
              <span>跟踪事项 · Tracking</span>
              <AddButton
                label='新增跟踪事项'
                onAdd={() => handleAdd('tracking')}
              />
            </div>
            <div className='col-third-body' id='section-tracking'>
              <div
                className='sub-label'
                style={{ margin: '0 0 1.5mm 0', padding: 0 }}>
                需持续关注、定期检查的事项
              </div>
              <FitList
                items={parts.tracking}
                variant='third'
                onOpen={handleOpen}
                onToggle={handleToggle}
              />
            </div>
          </div>

          <div className='col-third'>
            <div className='col-third-header'>
              <span>交接事项 · Handover</span>
              <AddButton
                label='新增交接事项'
                onAdd={() => handleAdd('handover')}
              />
            </div>
            <div className='col-third-body' id='section-handover'>
              <div
                className='sub-label'
                style={{ margin: '0 0 1.5mm 0', padding: 0 }}>
                需移交他人或等待接手的事项
              </div>
              <FitList
                items={parts.handover}
                variant='third'
                onOpen={handleOpen}
                onToggle={handleToggle}
              />
            </div>
          </div>

          <div className='col-third'>
            <div className='col-third-header'>
              <span>学习与累积 · Learning</span>
              <AddButton
                label='新增学习积累事项'
                onAdd={() => handleAdd('accumulating')}
              />
            </div>
            <div className='col-third-body' id='section-accumulating'>
              <div
                className='sub-label'
                style={{ margin: '0 0 1.5mm 0', padding: 0 }}>
                需深度学习、研究、沉淀的事项
              </div>
              <FitList
                items={parts.accumulating}
                variant='third'
                onOpen={handleOpen}
                onToggle={handleToggle}
              />
            </div>
          </div>
        </div>

        <div className='page-footer'>
          <span className='label'>Weekly Review 检查清单</span>
          <div className='footer-check'>
            <input type='checkbox' className='gtd-cb' /> 收集箱清空
          </div>
          <div className='footer-check'>
            <input type='checkbox' className='gtd-cb' /> 里程碑复核
          </div>
          <div className='footer-check'>
            <input type='checkbox' className='gtd-cb' /> 跟踪事项复核
          </div>
          <div className='footer-check'>
            <input type='checkbox' className='gtd-cb' /> 交接事项跟进
          </div>
          <div className='footer-check'>
            <input type='checkbox' className='gtd-cb' /> 学习事项推进
          </div>
        </div>
      </div>

      <GtdModal
        open={modalOpen}
        item={editing}
        preset={preset}
        onClose={() => setModalOpen(false)}
        onSubmit={async (data) => {
          if (editing) await updateMut.mutateAsync({ id: editing.id, data })
          else await createMut.mutateAsync(data)
        }}
        onDelete={
          editing
            ? async () => {
                await deleteMut.mutateAsync(editing.id)
              }
            : undefined
        }
        onCancelItem={
          editing
            ? async () => {
                await statusMut.mutateAsync({
                  id: editing.id,
                  status: 'cancelled'
                })
              }
            : undefined
        }
      />
    </main>
  )
}
