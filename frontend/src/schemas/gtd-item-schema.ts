import { z } from 'zod/v4'
import { pbIdSchema } from './pb-schema'

// ---------- 事项类型(6 种,与打印页分区一一对应) ----------
export const gtdTypes = [
  'todo',
  'project',
  'milestone',
  'tracking',
  'handover',
  'accumulating'
] as const
export type GtdType = (typeof gtdTypes)[number]

export const gtdTypeLabels: Record<GtdType, string> = {
  todo: '待办',
  project: '项目',
  milestone: '里程碑',
  tracking: '跟踪',
  handover: '交接',
  accumulating: '学习积累'
}

// ---------- 执行条件(仅 type=todo 时有意义,由界面引导,不加数据约束) ----------
export const gtdConditions = ['电脑', '沟通', '外出', '家', '思考'] as const
export type GtdCondition = (typeof gtdConditions)[number]

export const gtdConditionLabels: Record<GtdCondition, string> = {
  电脑: '@电脑',
  沟通: '@沟通 / 电话',
  外出: '@外出 / 户外 / 市场',
  家: '@家',
  思考: '@阅读 / 思考'
}

/** 今日行动主战场里 condition 为空的事项归入此组 */
export const gtdConditionOtherLabel = '@其他'

// ---------- 状态 ----------
export const gtdStatuses = ['active', 'completed', 'cancelled'] as const
export type GtdStatus = (typeof gtdStatuses)[number]

export const gtdStatusLabels: Record<GtdStatus, string> = {
  active: '活跃',
  completed: '已完成',
  cancelled: '已取消'
}

// PocketBase 日期字段返回 UTC 串(形如 2026-09-11 08:30:00.000Z)。
// 全局约束:写入时带 Z 编码墙上时钟,读取时 slice 取前缀,不做时区换算。
const pbDateSchema = z
  .string()
  .catch('')
  .transform((v) => v.slice(0, 10))

const pbDateTimeSchema = z
  .string()
  .catch('')
  .transform((v) => v.slice(0, 16))

// ---------- 表单校验(管理界面与打印页弹框共用) ----------
export const gtdItemFormSchema = z.object({
  thing: z
    .string()
    .trim()
    .min(1, '事项名称不能为空')
    .max(255, '事项名称不能超过 255 字'),
  note: z.string().max(5000, '备注不能超过 5000 字').default(''),
  type: z.enum(gtdTypes),
  schedule_on: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式应为 yyyy-MM-dd'),
  // '' 表示未设置;非空时形如 'YYYY-MM-DD HH:MM'
  hard_time: z
    .string()
    .regex(
      /^$|^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/,
      '硬时间格式应为 yyyy-MM-dd HH:mm'
    )
    .default(''),
  // '' 表示无 / 其他;否则必须是 5 个枚举之一
  condition: z.union([z.literal(''), z.enum(gtdConditions)]).default(''),
  assignee: z.array(z.string()).default([]),
  status: z.enum(gtdStatuses).default('active')
})
export type GtdItemFormFields = z.infer<typeof gtdItemFormSchema>

// ---------- 响应解析(PocketBase 记录 → UI 数据) ----------
export const gtdItemResponseSchema = z.object({
  id: pbIdSchema,
  owner: z.string().catch(''),
  thing: z.string().catch(''),
  note: z.string().catch(''),
  type: z.enum(gtdTypes).catch('todo'),
  schedule_on: pbDateSchema,
  hard_time: pbDateTimeSchema,
  condition: z.string().catch(''),
  assignee: z
    .union([z.array(z.string()), z.null()])
    .catch([])
    .transform((v) => v ?? []),
  status: z.enum(gtdStatuses).catch('active'),
  sort_order: z.number().catch(0),
  created: z.string().catch(''),
  updated: z.string().catch('')
})
export type GtdItem = z.infer<typeof gtdItemResponseSchema>
