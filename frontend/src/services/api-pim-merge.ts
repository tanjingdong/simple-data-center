import { pb } from './pocketbase'

// 参与合并的 PIM 集合
export type MergeKind = 'persons' | 'organizations'

// 单字段合并规则(与后端 backend/pim_merge.go 的 rule 值一致)
export type MergeRule = 'same' | 'pick-a' | 'pick-b' | 'concat' | 'tag'

// 预览中的一行字段结果;a/b/result 均为后端生成的展示字符串
export type MergeFieldRow = {
  key: string
  a: string
  b: string
  result: string
  rule: MergeRule
}

// POST /api/pim/merge/preview 的响应
export type MergePreview = {
  kind: MergeKind
  survivorId: string
  survivorIsEditing: boolean
  deletedId: string
  // 保留者/被删者的创建时间(RFC3339,后端生成;记录缺失 created 时为空串)
  survivorCreated: string
  deletedCreated: string
  fields: MergeFieldRow[]
}

// 两个合并接口共用的请求体;fields 是 A 侧(正在编辑的表单)当前值
export type MergeInput = {
  kind: MergeKind
  editingId: string
  otherId: string
  fields: Record<string, unknown>
}

// 只读预览:保留者、被删者与逐字段合并结果,不落库
export function fetchMergePreview(input: MergeInput): Promise<MergePreview> {
  return pb.send<MergePreview>('/api/pim/merge/preview', {
    method: 'POST',
    body: input
  })
}

// 事务内执行合并,返回保留者 id
export function commitMerge(
  input: MergeInput
): Promise<{ survivorId: string }> {
  return pb.send<{ survivorId: string }>('/api/pim/merge', {
    method: 'POST',
    body: input
  })
}
