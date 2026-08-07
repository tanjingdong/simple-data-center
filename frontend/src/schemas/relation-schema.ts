import { z } from 'zod/v4'
import { pbIdSchema } from './pb-schema'

export const relationSchema = z.object({
  id: pbIdSchema,
  person_a: pbIdSchema,
  person_b: pbIdSchema,
  relation_description: z.string().min(1, '关系描述不能为空')
})

// 响应解析 schema:PocketBase 序列化格式 → UI 格式
// (relation 记录均为必填字段,仅做宽松字符串解析)
export const relationResponseSchema = z.object({
  id: pbIdSchema,
  person_a: z.string(),
  person_b: z.string(),
  relation_description: z.string()
})

// UI 使用的数据层类型:来自响应解析 schema(而非严格表单 schema)
export type Relation = z.infer<typeof relationResponseSchema>

// 表单:选择两人 + 描述;提交前校验两人不同
export const relationFormSchema = z
  .object({
    person_a: z.string().min(1, '请选择第一个人'),
    person_b: z.string().min(1, '请选择第二个人'),
    relation_description: z.string().min(1, '关系描述不能为空')
  })
  .refine((data) => data.person_a !== data.person_b, {
    message: '不能与自己建立关系',
    path: ['person_b']
  })

export type RelationFormFields = z.infer<typeof relationFormSchema>
