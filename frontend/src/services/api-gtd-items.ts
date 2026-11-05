import {
  gtdConditionLabels,
  gtdConditionOtherLabel,
  gtdConditions,
  gtdItemResponseSchema,
  type GtdCondition,
  type GtdItem,
  type GtdItemFormFields,
  type GtdStatus
} from '@/schemas/gtd-item-schema'
import { queryOptions } from '@tanstack/react-query'
import { pb } from './pocketbase'

// ============================================================
// 纯函数层:日期、分区归集、展示格式化、溢出裁剪
// 全部不依赖网络与 DOM,便于单测
// ============================================================

/** 补零到两位 */
function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** 按本地时区把 Date 格式化为 yyyy-MM-dd(不用 toISOString,避免 UTC 漂移) */
export function todayStr(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`
}

/** 把 yyyy-MM-dd 解析为本地时区当天 00:00 的 Date */
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/**
 * 返回 dateStr 所在自然周的起止日期(周一 ~ 周日)。
 * 周一为一周起点(中国习惯),周日归入以周一为起点的本周。
 */
export function weekRange(dateStr: string): { start: string; end: string } {
  const d = parseLocalDate(dateStr)
  // JS 的 getDay(): 周日=0,周一=1 ... 周六=6
  const offsetToMonday = (d.getDay() + 6) % 7
  const monday = new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate() - offsetToMonday
  )
  const sunday = new Date(
    monday.getFullYear(),
    monday.getMonth(),
    monday.getDate() + 6
  )
  return { start: todayStr(monday), end: todayStr(sunday) }
}

/** 排序:sort_order 升序 → created 升序(不修改入参) */
export function sortItems(items: GtdItem[]): GtdItem[] {
  return [...items].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
    return a.created.localeCompare(b.created)
  })
}

/** 打印页与管理界面共用的分区结果 */
export interface GtdPartitions {
  /** 硬时间区:不限 type,任何设了 hard_time 且已生效的事项 */
  hardTime: GtdItem[]
  /** 今日行动主战场:todo 且无硬时间 */
  todayActions: GtdItem[]
  /** 活跃项目 */
  projects: GtdItem[]
  /** 本周预期里程碑:严格按周过滤,超期不显示 */
  milestones: GtdItem[]
  /** 跟踪事项 */
  tracking: GtdItem[]
  /** 交接事项 */
  handover: GtdItem[]
  /** 学习与累积 */
  accumulating: GtdItem[]
}

/**
 * 把全量记录按打印页的分区规则归集。
 *
 * 规则来源:原 MTR 的 _fetch_today_items + renderAll。
 * - 非里程碑:schedule_on <= today 才「生效」;
 * - 里程碑:schedule_on 必须落在 today 所在自然周内(超期不显示、本周内未来日期显示);
 * - 硬时间区不限 type,但同样要先「生效」;
 * - 设了 hard_time 的 todo 只出现在硬时间区,不再出现在今日行动主战场。
 */
export function partitionItems(items: GtdItem[], today: string): GtdPartitions {
  const { start: weekStart, end: weekEnd } = weekRange(today)

  const active = items.filter((it) => it.status === 'active')

  const isMilestone = (it: GtdItem) => it.type === 'milestone'
  /** 非里程碑:生效日期已到或已过 */
  const isEffective = (it: GtdItem) => it.schedule_on <= today
  /** 里程碑:落在本周 */
  const isInWeek = (it: GtdItem) =>
    it.schedule_on >= weekStart && it.schedule_on <= weekEnd

  const milestones = sortItems(
    active.filter((it) => isMilestone(it) && isInWeek(it))
  )

  // 硬时间区:非里程碑需已生效,里程碑需落在本周;再要求 hard_time 非空
  const hardTime = sortItems(
    active.filter((it) => {
      if (!it.hard_time) return false
      return isMilestone(it) ? isInWeek(it) : isEffective(it)
    })
  )

  const nonMilestone = active.filter(
    (it) => !isMilestone(it) && isEffective(it)
  )

  return {
    hardTime,
    todayActions: sortItems(
      nonMilestone.filter((it) => it.type === 'todo' && !it.hard_time)
    ),
    projects: sortItems(nonMilestone.filter((it) => it.type === 'project')),
    milestones,
    tracking: sortItems(nonMilestone.filter((it) => it.type === 'tracking')),
    handover: sortItems(nonMilestone.filter((it) => it.type === 'handover')),
    accumulating: sortItems(
      nonMilestone.filter((it) => it.type === 'accumulating')
    )
  }
}

/** 今日行动主战场的一个分组 */
export interface GtdConditionGroup {
  /** null 表示「其他」(condition 为空或为枚举外的脏值) */
  condition: GtdCondition | null
  label: string
  items: GtdItem[]
}

/**
 * 把今日行动主战场按执行条件分成固定 6 组(5 个枚举 + @其他)。
 * 空组也保留——原设计的版面要求每组都占位。
 */
export function groupTodayActions(items: GtdItem[]): GtdConditionGroup[] {
  const groups: GtdConditionGroup[] = gtdConditions.map((c) => ({
    condition: c,
    label: gtdConditionLabels[c],
    items: []
  }))
  const other: GtdConditionGroup = {
    condition: null,
    label: gtdConditionOtherLabel,
    items: []
  }

  for (const it of items) {
    const hit = groups.find((g) => g.condition === it.condition)
    if (hit) hit.items.push(it)
    else other.items.push(it)
  }

  return [...groups, other]
}

/**
 * 把 assignee 字段归一化为字符串数组。
 * 兼容三种形态:字符串数组、JSON 字符串、逗号分隔的普通字符串。
 * 过滤空串与非字符串元素。
 */
export function assigneeNames(assignee: unknown): string[] {
  let raw: unknown[] = []

  if (Array.isArray(assignee)) {
    raw = assignee
  } else if (typeof assignee === 'string') {
    const s = assignee.trim()
    if (!s) return []
    if (s.startsWith('[')) {
      try {
        const parsed: unknown = JSON.parse(s)
        raw = Array.isArray(parsed) ? parsed : [s]
      } catch {
        raw = [s]
      }
    } else {
      raw = s.split(',')
    }
  } else {
    return []
  }

  return raw
    .filter((v): v is string => typeof v === 'string')
    .map((v) => v.trim())
    .filter((v) => v !== '')
}

/**
 * 把任意来源的 condition 收窄为表单允许的枚举。
 *
 * 响应 schema 刻意用宽松的 string(容忍历史脏值),表单 schema 用严格枚举,
 * 这里做两者的桥接:枚举外的值(含下拉框的 '__none__' 哨兵值)一律归一为空串,
 * 即界面上显示的「(无 / 其他)」。
 *
 * 副作用提示:编辑一条 condition 为脏值的旧记录并保存,会把脏值改写为空。
 * 这是下拉框本身的能力边界所致(它只能选 5 个枚举 + 无),属既定行为。
 */
export function normalizeCondition(value: string): GtdCondition | '' {
  return (gtdConditions as readonly string[]).includes(value)
    ? (value as GtdCondition)
    : ''
}

/**
 * 把「总可见条数」按分组顺序摊回各组,再逐组裁剪。
 *
 * 用于今日行动主战场:整块分区一起参与 A4 溢出测量,但裁剪必须按分组顺序
 * 从头开始(前面的组先占满,余数才给后面的组),否则会出现「后面的组有内容、
 * 前面的组空着」的怪异版面。
 *
 * 与 trimItems 的分工:trimItems 处理平铺列表,本函数处理分组列表。
 */
export function trimGroups<T extends { items: unknown[] }>(
  groups: T[],
  visibleCount: number
): T[] {
  let remaining = Math.max(0, Math.floor(visibleCount))
  const out: T[] = []
  for (const g of groups) {
    const take = Math.min(g.items.length, remaining)
    remaining -= take
    out.push({ ...g, items: g.items.slice(0, take) })
  }
  return out
}

/** 事项的展示文本:有受让人时用「事项  |  张三,李四」格式 */
export function itemLabel(item: GtdItem): string {
  const names = assigneeNames(item.assignee)
  return names.length ? `${item.thing}  |  ${names.join(',')}` : item.thing
}

/**
 * 硬时间标签:日期是今天时只显示 HH:MM,否则显示 MM-DD HH:MM。
 * 入参形如 'YYYY-MM-DD HH:MM';空值返回空串。
 */
export function formatHardTime(hardTime: string, today: string): string {
  if (!hardTime) return ''
  const date = hardTime.slice(0, 10)
  const time = hardTime.slice(11, 16)
  if (date === today) return time
  return `${date.slice(5)} ${time}`
}

/**
 * 按可见条数裁剪列表,用于打印页的 A4 溢出处理。
 * hidden > 0 时调用方应在末行渲染「【更多记录未显示……】」。
 */
export function trimItems<T>(
  items: T[],
  visibleCount: number
): { visible: T[]; hidden: number } {
  const cap = Math.max(0, Math.floor(visibleCount))
  if (items.length <= cap) return { visible: items, hidden: 0 }
  return { visible: items.slice(0, cap), hidden: items.length - cap }
}

// ============================================================
// 数据访问层:PocketBase 读写
// 日期编码铁律:写入时带 Z 后缀把墙上时钟按 UTC 编码,读取时 slice 取前缀,
// 这样无论 PocketBase 的 app timezone 配成什么,值都原样往返。
// ============================================================

/** 'yyyy-MM-dd' → PocketBase 接受的 UTC 零点点字符串;空值原样返回 */
export function toPbDate(dateStr: string): string {
  if (!dateStr) return ''
  return `${dateStr} 00:00:00.000Z`
}

/** 'yyyy-MM-dd HH:mm' → PocketBase 接受的 UTC 时间串;空值原样返回 */
export function toPbDateTime(dateTimeStr: string): string {
  if (!dateTimeStr) return ''
  return `${dateTimeStr}:00.000Z`
}

/** 列表查询:拉当前用户全量记录,分区与筛选在前端纯函数里做 */
export function gtdItemsQueryOptions(ownerId: string) {
  return queryOptions({
    queryKey: ['gtd_items', 'list', ownerId],
    queryFn: async () => {
      const records = await pb.collection('gtd_items').getFullList({
        filter: `owner = "${ownerId}"`,
        sort: 'sort_order,created'
      })
      return records.map((r) => gtdItemResponseSchema.parse(r))
    },
    staleTime: 30 * 1000,
    enabled: !!ownerId
  })
}

/** 把表单字段翻译为 PocketBase 写入载荷 */
function toPbPayload(data: GtdItemFormFields) {
  return {
    thing: data.thing,
    note: data.note,
    type: data.type,
    schedule_on: toPbDate(data.schedule_on),
    hard_time: toPbDateTime(data.hard_time),
    condition: data.condition || '',
    assignee: data.assignee,
    status: data.status,
    sort_order: 0
  }
}

/** 新增事项(必须显式写 owner,PocketBase 不会自动填) */
export async function createGtdItem(
  ownerId: string,
  data: GtdItemFormFields
): Promise<GtdItem> {
  const record = await pb
    .collection('gtd_items')
    .create({ ...toPbPayload(data), owner: ownerId })
  return gtdItemResponseSchema.parse(record)
}

/** 更新事项(不改 owner) */
export async function updateGtdItem(
  id: string,
  data: GtdItemFormFields
): Promise<GtdItem> {
  const record = await pb.collection('gtd_items').update(id, toPbPayload(data))
  return gtdItemResponseSchema.parse(record)
}

/** 只切换状态(复选框与「取消事项」用,避免整体覆盖其他字段) */
export async function updateGtdItemStatus(
  id: string,
  status: GtdStatus
): Promise<GtdItem> {
  const record = await pb.collection('gtd_items').update(id, { status })
  return gtdItemResponseSchema.parse(record)
}

/** 物理删除事项 */
export async function deleteGtdItem(id: string): Promise<void> {
  await pb.collection('gtd_items').delete(id)
}
