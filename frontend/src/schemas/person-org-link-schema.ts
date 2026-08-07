import { z } from 'zod/v4'
import { pbIdSchema } from './pb-schema'

export const personOrgLinkSchema = z.object({
  id: pbIdSchema,
  person_id: pbIdSchema,
  org_id: pbIdSchema,
  link_description: z.string().min(1, '关联描述不能为空')
})

// 响应解析 schema:PocketBase 序列化格式 → UI 格式
// (person_org_links 记录均为必填字段,仅做宽松字符串解析)
export const personOrgLinkResponseSchema = z.object({
  id: pbIdSchema,
  person_id: z.string(),
  org_id: z.string(),
  link_description: z.string()
})

// UI 使用的数据层类型:来自响应解析 schema(而非严格表单 schema)
export type PersonOrgLink = z.infer<typeof personOrgLinkResponseSchema>

export const personOrgLinkFormSchema = z.object({
  org_id: z.string().min(1, '请选择组织'),
  link_description: z.string().min(1, '关联描述不能为空')
})

export type PersonOrgLinkFormFields = z.infer<typeof personOrgLinkFormSchema>
