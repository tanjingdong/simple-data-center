import { z } from 'zod/v4'
import { pbIdSchema } from './pb-schema'

// 事件类型开放值(预置常用项,允许自定义)
export const eventTypePresets = [
  '电话',
  '面谈',
  '升职',
  '处分',
  '会议',
  '签约'
] as const

export const eventSchema = z.object({
  id: pbIdSchema,
  person_id: pbIdSchema,
  org_id: z.string().default(''),
  happen_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式应为 yyyy-MM-dd'),
  type: z.string().default(''),
  summary: z.string().min(1, '事件纪要不能为空')
})

// 响应解析 schema:PocketBase 序列化格式 → UI 格式
//  - org_id/type:null → ''
//  - 日期:完整时间戳 → 'yyyy-MM-dd'(取前 10 位)
export const eventResponseSchema = z.object({
  id: pbIdSchema,
  person_id: z.string(),
  org_id: z.string().catch(''),
  happen_at: z.string().catch('').transform((v) => v.slice(0, 10)),
  type: z.string().catch(''),
  summary: z.string()
})

// UI 使用的数据层类型:来自响应解析 schema(而非严格表单 schema)
export type Event = z.infer<typeof eventResponseSchema>

// 新建事件表单(person_id 由当前对象注入)
export const eventFormSchema = eventSchema.omit({ id: true, person_id: true })
export type EventFormFields = z.infer<typeof eventFormSchema>
