import { z } from 'zod/v4'
import { pbIdSchema } from './pb-schema'
import { SUMMARY_MIN_TOKEN_RE } from '@/lib/event-tokens'

// 事件类型开放值(预置常用项,允许自定义)
export const eventTypePresets = [
  '电话',
  '面谈',
  '升职',
  '处分',
  '会议',
  '签约'
] as const

// 事件 schema:summary 带参与方 token([[p:id|名]]/[[o:id|名]]),必须含 ≥1 token(与服务端 pattern 对齐)
export const eventSchema = z.object({
  id: pbIdSchema,
  happen_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式应为 yyyy-MM-dd'),
  type: z.string().default(''),
  summary: z
    .string()
    .min(1, '事件纪要不能为空')
    .regex(SUMMARY_MIN_TOKEN_RE, '纪要中至少提及 1 个参与对象(用 @ 选择)')
})

// 响应解析 schema:PocketBase 序列化格式 → UI 格式
//  - type:null → ''
//  - 日期:完整时间戳 → 'yyyy-MM-dd'(取前 10 位)
export const eventResponseSchema = z.object({
  id: pbIdSchema,
  happen_at: z.string().catch('').transform((v) => v.slice(0, 10)),
  type: z.string().catch(''),
  summary: z.string()
})

export type Event = z.infer<typeof eventResponseSchema>

// 事件表单(无 person_id/org_id)
export const eventFormSchema = eventSchema.omit({ id: true })
export type EventFormFields = z.infer<typeof eventFormSchema>
