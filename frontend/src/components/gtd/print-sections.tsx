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
        {/* 这里不能放 flex:1 的占位元素——列表容器自身是 flex:1,
            两者会平分高度,导致可用高度只剩一半、溢出测量过早触发 */}
        {children}
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

/** 收敛阶段 */
type FitPhase = 'measure' | 'shrink' | 'grow' | 'settled'

/**
 * A4 溢出测量:算出一个分区里最多能完整放下多少条,多出来的交给调用方提示。
 *
 * 规则(与产品要求一致):
 * - 装得下就**全部显示**,不显示任何提示;
 * - 只有排满容器时才裁剪,且把「原本还能显示的最后一行」换成
 *   「【更多记录未显示……】」——提示行本身也在被测量的容器内,所以它占掉的
 *   那一行会自动计入下一轮测量,不会出现「减一条、加一行提示、还是溢出」的残留。
 *
 * 收敛方式:双向搜索。溢出就退一条,退到不溢出后试着回增一条;回增又溢出的
 * 那一格就是答案。**必须能回增**,否则首次测量若偏小(字体未就绪、容器尚未
 * 撑开)就会永久锁死在一个过小的值上。
 *
 * 重测时机:数据条数变化、窗口缩放、字体加载完成。容器的 clientHeight 由
 * flex 决定、与内容无关,所以这些时机之外无需重复测量。
 *
 * 风险:依赖真实渲染后的 DOM 测量。实测不稳时的退路是给每个分区预设固定
 * 行数容量(见设计文档 4.4)。
 */
export function useFitCount(total: number): {
  ref: RefObject<HTMLDivElement | null>
  visibleCount: number
  hiddenCount: number
} {
  const ref = useRef<HTMLDivElement>(null)
  const [visibleCount, setVisibleCount] = useState(total)
  const [prevTotal, setPrevTotal] = useState(total)
  const phase = useRef<FitPhase>('measure')

  // 数据条数变化 → 重置为全部显示,重新收敛。
  // 用渲染期派生(React 官方「props 变化时调整 state」写法)而非 effect,
  // 避免 setState-in-effect 造成的额外一轮渲染。
  // 注意:这里只改 state、不改 ref——渲染期写 ref 会触发 react-hooks/refs 报错。
  if (total !== prevTotal) {
    setPrevTotal(total)
    setVisibleCount(total)
  }

  // 收敛阶段重置 + 容器尺寸变化时重新收敛。
  // 本 effect 声明在测量 effect 之前,所以 total 变化时先重置阶段再测量。
  useLayoutEffect(() => {
    let cancelled = false
    phase.current = 'measure'

    const reset = () => {
      if (cancelled) return
      phase.current = 'measure'
      setVisibleCount(total)
    }
    window.addEventListener('resize', reset)
    // 字体加载完成会改变行高;若首次测量早于字体就绪,结果会偏小且当时看不出来
    void document.fonts?.ready.then(reset)
    return () => {
      cancelled = true
      window.removeEventListener('resize', reset)
    }
  }, [total])

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || phase.current === 'settled') return

    const overflowing = el.scrollHeight > el.clientHeight

    if (overflowing) {
      if (phase.current === 'grow') {
        // 回增时溢出了 → 退回一格即为最大可容纳条数
        phase.current = 'settled'
        setVisibleCount((v) => Math.max(0, v - 1))
        return
      }
      if (visibleCount <= 0) {
        // 连一条都放不下(固定开销太大),就此定稿
        phase.current = 'settled'
        return
      }
      if (phase.current === 'measure') {
        // 首次就溢出:按高度比例给个初值,避免逐条退几十次
        const ratio = el.clientHeight / el.scrollHeight
        const guess = Math.max(
          0,
          Math.min(visibleCount - 1, Math.floor(total * ratio))
        )
        phase.current = 'shrink'
        setVisibleCount(guess)
        return
      }
      phase.current = 'shrink'
      setVisibleCount((v) => v - 1)
      return
    }

    // 未溢出:全部显示得下就定稿,否则试着多显示一条
    if (visibleCount >= total) {
      phase.current = 'settled'
      return
    }
    phase.current = 'grow'
    setVisibleCount((v) => Math.min(total, v + 1))
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
