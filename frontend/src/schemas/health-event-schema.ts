import { z } from 'zod/v4'
import { pbIdSchema } from './pb-schema'

// 事件类型常用建议(自由标签,非枚举;仍可输入任意值)
export const healthEventTypePresets = [
  '门诊',
  '检查',
  '检验',
  '体检',
  '筛查',
  '自测',
  '生理',
  '用药',
  '症状',
  '手术',
  '疫苗'
] as const

// 新建/编辑事件表单校验:人/时间/类型必填
export const healthEventFormSchema = z.object({
  person: z.string().min(1, '人不能为空'),
  happen_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式应为 yyyy-MM-dd'),
  event_type: z.string().min(1, '类型不能为空'),
  item: z.string().default(''),
  department: z.string().default(''),
  institution: z.string().default(''),
  doctor: z.string().default(''),
  conclusion: z.string().default(''),
  detail: z.string().default('')
})
export type HealthEventFormFields = z.infer<typeof healthEventFormSchema>


// 响应解析 schema:PocketBase 序列化 → UI 格式
// (null → ''、时间戳 → 'yyyy-MM-dd' 取前 10 位、数组字段兜底为空数组)
export const healthEventResponseSchema = z.object({
  id: pbIdSchema,
  person: z.string(),
  happen_at: z.string().catch('').transform((v) => v.slice(0, 10)),
  event_type: z.string().catch(''),
  item: z.string().catch(''),
  department: z.string().catch(''),
  institution: z.string().catch(''),
  doctor: z.string().catch(''),
  conclusion: z.string().catch(''),
  detail: z.string().catch(''),
  receipt: z.array(z.string()).catch([]),
  referenced_by: z.array(z.string()).catch([])
})

// UI 使用的数据层类型
export type HealthEvent = z.infer<typeof healthEventResponseSchema>
