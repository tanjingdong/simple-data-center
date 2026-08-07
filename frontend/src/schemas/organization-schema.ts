import { z } from 'zod/v4'
import { pbIdSchema } from './pb-schema'

export const organizationSchema = z.object({
  id: pbIdSchema,
  name: z.string().min(1, '组织名称不能为空'),
  type: z.string().default(''),
  importance_level: z.coerce
    .number()
    .int('资源评级必须为整数')
    .min(1, '资源评级必须为 1-5')
    .max(5, '资源评级必须为 1-5')
    .default(3),
  phone: z.string().default(''),
  email: z.string().default(''),
  map: z.string().url('地图链接格式不正确').or(z.literal('')).default(''),
  address: z.string().default(''),
  notes: z.string().default('')
})

// 响应解析 schema:PocketBase 序列化格式 → UI 格式
//  - 文本/select:null → '';map 为 url 可空 → null → ''
//  - 评级:非法值 → 0(服务端已保证 1-5)
export const organizationResponseSchema = z.object({
  id: pbIdSchema,
  name: z.string(),
  type: z.string().catch(''),
  importance_level: z.number().catch(0),
  phone: z.string().catch(''),
  email: z.string().catch(''),
  map: z.string().catch(''),
  address: z.string().catch(''),
  notes: z.string().catch('')
})

// UI 使用的数据层类型:来自响应解析 schema(而非严格表单 schema)
export type Organization = z.infer<typeof organizationResponseSchema>

export const organizationFormSchema = organizationSchema.omit({ id: true })
export type OrganizationFormFields = z.infer<typeof organizationFormSchema>

export const importanceLevelOptions = [1, 2, 3, 4, 5] as const
