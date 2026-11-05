import GtdItemForm, {
  emptyGtdItemForm,
  toFormFields
} from '@/components/gtd/item-form'
import { errorToast } from '@/lib/toast'
import {
  gtdItemFormSchema,
  type GtdItem,
  type GtdItemFormFields
} from '@/schemas/gtd-item-schema'
import {
  formatHardTime,
  itemLabel,
  trimGroups,
  trimItems
} from '@/services/api-gtd-items'
import type { ReactNode } from 'react'
import { useLayoutEffect, useRef, useState, type RefObject } from 'react'

/** 一行可手写的空白横线 */
export function FillLine() {
  return (
    <div className='item'>
      <div className='fill-line' />
    </div>
  )
}

/**
 * 分区标题右端的「+」:点击新增,由调用方按所在分区预填类型。
 * 用 <button> 而非原版的 <span> 以保证键盘可达;打印时由 CSS 隐藏。
 */
export function AddButton({
  dark,
  label,
  onAdd
}: {
  dark?: boolean
  label: string
  onAdd: () => void
}) {
  return (
    <button
      type='button'
      aria-label={label}
      className={dark ? 'add-btn add-btn-dark' : 'add-btn'}
      onClick={onAdd}>
      +
    </button>
  )
}

/** 第 1 页左栏:今日行动主战场 */
export function SectionTodayActions({
  children,
  onAdd
}: {
  children?: ReactNode
  onAdd: () => void
}) {
  return (
    <div className='section' style={{ flex: 1 }}>
      <div className='section-header'>
        <span>今日行动主战场 · Action</span>
        <AddButton label='新增待办' onAdd={onAdd} />
      </div>
      <div className='section-body' id='section-today-actions'>
        {children}
        <div style={{ flex: 1 }} />
        <div className='sub-label'>用动词开头,确保可执行</div>
      </div>
    </div>
  )
}

/** 第 1 页右栏上:硬时间 */
export function SectionHardTime({
  children,
  onAdd
}: {
  children?: ReactNode
  onAdd: () => void
}) {
  return (
    <div className='section'>
      <div className='section-header'>
        <span>硬时间 · Calendar</span>
        <AddButton label='新增硬时间事项' onAdd={onAdd} />
      </div>
      <div className='section-body' id='section-hardtime'>
        {children}
        <div className='sub-label'>只放有明确时间点的事项</div>
      </div>
    </div>
  )
}

/** 第 1 页右栏下:支持与缓冲(闪念收件箱 + 活跃项目) */
export function SectionSupport({
  children,
  onAddProject
}: {
  children?: ReactNode
  onAddProject: () => void
}) {
  return (
    <div className='section' style={{ flex: 1 }}>
      <div className='section-header'>
        <span>支持与缓冲 · Support</span>
      </div>
      <div className='section-body'>
        <div
          style={{ fontWeight: 700, fontSize: '9.5pt', marginBottom: '1.5mm' }}>
          【闪念收件箱】Inbox
        </div>
        <FillLine />
        <FillLine />
        <FillLine />
        <FillLine />
        <FillLine />
        <FillLine />

        <div className='divider' />

        <div
          style={{
            fontWeight: 700,
            fontSize: '9.5pt',
            marginBottom: '1mm',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
          <span>【活跃项目】Active</span>
          <AddButton dark label='新增项目' onAdd={onAddProject} />
        </div>
        <div
          className='sub-label'
          style={{ margin: '0 0 1.5mm 0', padding: 0 }}>
          项目名 / 今日进度
        </div>
        <div id='section-projects'>{children}</div>

        <div style={{ flex: 1 }} />
        <div className='sub-label'>新念头立即卸载,绝不当场处理</div>
      </div>
    </div>
  )
}

// ============================================================
// A4 溢出处理
// ============================================================

/**
 * A4 溢出测量:内容超出容器高度时逐步减少可见条数,直到装得下。
 *
 * 原理:每次提交后比较容器的 scrollHeight 与 clientHeight,溢出则把可见条数减 1,
 * 触发下一轮渲染后再测。收敛后 visibleCount 即为能装下的条数;hiddenCount > 0
 * 表示有内容被隐藏,调用方需在末行渲染「【更多记录未显示……】」。
 *
 * 提示行本身也在被测量的容器内,所以它占掉的那一行会自动被计入下一轮测量,
 * 因此不会出现「减掉一条数据、又加了一行提示、结果还是溢出」的残留。
 *
 * 风险:依赖真实渲染后的 DOM 测量,字体加载、浏览器缩放、渲染时序都会影响结果。
 * 实测不稳时的退路是给每个分区预设固定行数容量(见设计文档 4.4)。
 */
export function useFitCount(total: number): {
  ref: RefObject<HTMLDivElement | null>
  visibleCount: number
  hiddenCount: number
} {
  const ref = useRef<HTMLDivElement>(null)
  const [visibleCount, setVisibleCount] = useState(total)
  const [prevTotal, setPrevTotal] = useState(total)

  // 数据条数变化时重置为全部,再重新收敛。
  // 用渲染期派生(React 官方「props 变化时调整 state」写法)而非 effect,
  // 避免 setState-in-effect 造成的额外一轮渲染。
  if (total !== prevTotal) {
    setPrevTotal(total)
    setVisibleCount(total)
  }

  // 每次提交后测量;溢出则减一,触发下一轮渲染与测量,直至装得下。
  // 这里是条件式 setState(不溢出就什么都不做),不会造成无谓的级联渲染。
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    if (el.scrollHeight > el.clientHeight) {
      setVisibleCount((v) => (v > 0 ? v - 1 : 0))
    }
  })

  return {
    ref,
    visibleCount,
    hiddenCount: Math.max(0, total - visibleCount)
  }
}

/** 溢出提示行:替代被隐藏的事项 */
export function OverflowNotice({ hidden }: { hidden: number }) {
  if (hidden <= 0) return null
  return <div className='overflow-notice'>【更多记录未显示……】</div>
}

/** 一条带复选框的事项行 */
function ItemRow({
  item,
  className,
  onToggle,
  onOpen
}: {
  item: GtdItem
  className: string
  onToggle: (item: GtdItem, checked: boolean) => void
  onOpen: (item: GtdItem) => void
}) {
  return (
    <div className={`${className} clickable`} onClick={() => onOpen(item)}>
      <input
        type='checkbox'
        className='gtd-cb'
        checked={false}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onToggle(item, e.target.checked)}
      />
      <div className='fill-line'>{itemLabel(item)}</div>
    </div>
  )
}

/** 通用:一个带溢出处理的列(第 2 页三栏与里程碑区共用) */
export function FitList({
  items,
  variant,
  onToggle,
  onOpen
}: {
  items: GtdItem[]
  variant: 'third' | 'milestone'
  onToggle: (item: GtdItem, checked: boolean) => void
  onOpen: (item: GtdItem) => void
}) {
  const { ref, visibleCount, hiddenCount } = useFitCount(items.length)
  const { visible } = trimItems(items, visibleCount)
  const rowClass = variant === 'milestone' ? 'milestone-item' : 'item'

  // flex:1 + minHeight:0 而非 height:100%——父级是 flex 容器且内含 .sub-label,
  // 用 height:100% 会与 sub-label 争抢高度,导致测量偏高、裁剪不准。
  return (
    <div ref={ref} style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {visible.map((it) => (
        <ItemRow
          key={it.id}
          className={rowClass}
          item={it}
          onOpen={onOpen}
          onToggle={onToggle}
        />
      ))}
      <OverflowNotice hidden={hiddenCount} />
      <FillLine />
    </div>
  )
}

/** 硬时间区:行首多一个时间标签,故单独实现 */
export function HardTimeList({
  items,
  today,
  onToggle,
  onOpen
}: {
  items: GtdItem[]
  today: string
  onToggle: (item: GtdItem, checked: boolean) => void
  onOpen: (item: GtdItem) => void
}) {
  const { ref, visibleCount, hiddenCount } = useFitCount(items.length)
  const { visible } = trimItems(items, visibleCount)

  return (
    <div ref={ref} style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {visible.map((it) => (
        <div
          key={it.id}
          className='time-slot clickable'
          onClick={() => onOpen(it)}>
          <span className='time'>{formatHardTime(it.hard_time, today)}</span>
          <input
            type='checkbox'
            className='gtd-cb'
            checked={false}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onToggle(it, e.target.checked)}
          />
          <div className='fill-line'>{itemLabel(it)}</div>
        </div>
      ))}
      <OverflowNotice hidden={hiddenCount} />
      {/* 至少保留 1 个空白时间槽,便于打印后手写补充 */}
      <div className='time-slot'>
        <span className='time' />
        <div className='fill-line' />
      </div>
    </div>
  )
}

/** 今日行动主战场:按 condition 分组,整块一起参与溢出测量 */
export function TodayActionsList({
  groups,
  onToggle,
  onOpen
}: {
  groups: { condition: string | null; label: string; items: GtdItem[] }[]
  onToggle: (item: GtdItem, checked: boolean) => void
  onOpen: (item: GtdItem) => void
}) {
  const total = groups.reduce((n, g) => n + g.items.length, 0)
  const { ref, visibleCount, hiddenCount } = useFitCount(total)

  // 把「总可见条数」按分组顺序摊回各组,再逐组裁剪(纯函数,见 api-gtd-items.ts)
  const trimmed = trimGroups(groups, visibleCount)

  return (
    <div ref={ref} style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {trimmed.map((g) => (
        <div key={g.label}>
          <div className='context-label'>{g.label}</div>
          {g.items.map((it) => (
            <ItemRow
              key={it.id}
              className='item'
              item={it}
              onOpen={onOpen}
              onToggle={onToggle}
            />
          ))}
          <FillLine />
        </div>
      ))}
      <OverflowNotice hidden={hiddenCount} />
    </div>
  )
}

/** 活跃项目区(嵌在「支持与缓冲」内,不做溢出裁剪,由外层 flex 分配高度) */
export function ProjectsList({
  items,
  onToggle,
  onOpen
}: {
  items: GtdItem[]
  onToggle: (item: GtdItem, checked: boolean) => void
  onOpen: (item: GtdItem) => void
}) {
  return (
    <>
      {items.map((it) => (
        <ItemRow
          key={it.id}
          className='item'
          item={it}
          onOpen={onOpen}
          onToggle={onToggle}
        />
      ))}
      <FillLine />
    </>
  )
}

// ============================================================
// 打印页的黑白素面编辑弹框(复刻原 MTR 样式)
// ============================================================

interface GtdModalProps {
  open: boolean
  onClose: () => void
  /** null 表示新建 */
  item: GtdItem | null
  /** 新建时的预填值(按所在分区预设类型) */
  preset: Partial<GtdItemFormFields> | null
  onSubmit: (data: GtdItemFormFields) => Promise<void>
  onDelete?: () => Promise<void>
  onCancelItem?: () => Promise<void>
}

/**
 * 表单初值在挂载时算一次即可——外层以 key 控制重挂载,
 * 与 item-dialog.tsx 同款写法,避免 effect 内 setState 造成的级联渲染。
 */
function GtdModalBody({
  item,
  preset,
  onSubmit,
  onDelete,
  onCancelItem,
  onClose
}: Omit<GtdModalProps, 'open'>) {
  const [value, setValue] = useState<GtdItemFormFields>(() =>
    item ? toFormFields(item) : emptyGtdItemForm(preset ?? {})
  )
  const [busy, setBusy] = useState(false)

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    try {
      await fn()
      onClose()
    } catch (err) {
      errorToast('操作失败', err)
    } finally {
      setBusy(false)
    }
  }

  async function handleSave() {
    const parsed = gtdItemFormSchema.safeParse(value)
    if (!parsed.success) {
      errorToast('请检查表单', parsed.error.issues[0]?.message ?? '输入不合法')
      return
    }
    await run(() => onSubmit(parsed.data))
  }

  return (
    <>
      <div
        style={{
          fontWeight: 700,
          fontSize: '10pt',
          display: 'flex',
          justifyContent: 'space-between'
        }}>
        <span>{item ? '编辑事项' : '新增事项'}</span>
        <button
          type='button'
          aria-label='关闭'
          style={{
            cursor: 'pointer',
            fontSize: '14pt',
            lineHeight: 1,
            background: 'none',
            border: 'none'
          }}
          onClick={onClose}>
          ×
        </button>
      </div>

      <div className='editor-meta'>
        {item
          ? `ID: ${item.id} | 创建: ${item.created} | 更新: ${item.updated}`
          : '新增事项'}
      </div>

      <GtdItemForm idPrefix='gtd-modal' value={value} onChange={setValue} />

      <div className='editor-actions'>
        <button type='button' disabled={busy} onClick={() => void handleSave()}>
          保存
        </button>
        <button
          type='button'
          className='btn-warn'
          disabled={busy || !item || !onCancelItem}
          onClick={() => void run(() => onCancelItem!())}>
          取消事项
        </button>
        <button
          type='button'
          className='btn-danger'
          disabled={busy || !item || !onDelete}
          onClick={() => {
            if (!window.confirm('确认删除该事项?此操作不可撤销。')) return
            void run(() => onDelete!())
          }}>
          删除
        </button>
      </div>
    </>
  )
}

/** 打印页的编辑弹框:黑白素面外壳 + 站内统一的表单控件(共用 GtdItemForm 内核) */
export function GtdModal({
  open,
  onClose,
  item,
  preset,
  onSubmit,
  onDelete,
  onCancelItem
}: GtdModalProps) {
  if (!open) return null

  return (
    <div
      className='gtd-modal-overlay'
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}>
      <div className='gtd-modal'>
        <GtdModalBody
          key={item?.id ?? 'new'}
          item={item}
          preset={preset}
          onSubmit={onSubmit}
          onDelete={onDelete}
          onCancelItem={onCancelItem}
          onClose={onClose}
        />
      </div>
    </div>
  )
}
