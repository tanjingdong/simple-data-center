import { escapeFilterValue } from '@/lib/pb-filter'
import {
  Organization,
  OrganizationFormFields,
  organizationResponseSchema
} from '@/schemas/organization-schema'
import { queryOptions } from '@tanstack/react-query'
import { pb } from './pocketbase'

// 组织列表过滤条件
export interface OrganizationFilters {
  query: string
  type: string
}

export const emptyOrganizationFilters: OrganizationFilters = {
  query: '',
  type: ''
}

// 纯函数:构造 organizations 列表 filter 表达式
export function buildOrgFilter(filters: OrganizationFilters): string {
  const parts: string[] = []
  const q = filters.query.trim()

  if (q) parts.push(`(name~'${q}' || type~'${q}')`)
  if (filters.type.trim()) parts.push(`type='${filters.type.trim()}'`)

  return parts.length ? parts.map((p) => `(${p})`).join(' && ') : ''
}

// 重复组织检索条件:名称按服务端聚合检索列(= TrimSpace(name))做包含召回,得到超集;
// 编辑模式追加排除自身;名称为空(含纯空白)返回空串,使用方据此跳过查询。
// 转义实现来自 @/lib/pb-filter(不从 api-persons 导入,避免两个 service 互相依赖)。
export function buildDuplicateOrgFilter(params: {
  name: string
  excludeId?: string
}): string {
  const name = params.name.trim()
  if (!name) return ''

  const base = `(search_text~'${escapeFilterValue(name)}')`
  return params.excludeId
    ? `${base} && id != '${escapeFilterValue(params.excludeId)}'`
    : base
}

// 疑似重复组织的精确判定:双方 trim 后完全相等,且名称非空。
// 召回列可能命中「甲公司」「甲乙公司」等超集,展示前必须再过这一层。
export function matchesDuplicateOrg(
  org: { name: string },
  name: string
): boolean {
  const target = name.trim()
  return target !== '' && org.name.trim() === target
}

// 疑似重复组织候选:先按聚合列召回超集(getFullList 全量取回),再用 matchesDuplicateOrg 精确判定。
export async function findDuplicateOrgCandidates(params: {
  name: string
  excludeId?: string
}): Promise<Organization[]> {
  const filter = buildDuplicateOrgFilter(params)
  if (!filter) return []

  const items = await pb.collection('organizations').getFullList({ filter })
  return items
    .map((item) => organizationResponseSchema.parse(item))
    .filter((org) => matchesDuplicateOrg(org, params.name))
}

// 疑似重复组织查询(新建/编辑表单的重名提示用);enabled 由 filter 是否为空决定。
// retry:false —— 旧库未导入 organizations.search_text 时查询会失败,提示直接隐藏,不做无谓重试。
export function duplicateOrgCandidatesQueryOptions(params: {
  name: string
  excludeId?: string
}) {
  const filter = buildDuplicateOrgFilter(params)
  return queryOptions({
    queryKey: ['organizations', 'duplicates', params],
    queryFn: () => findDuplicateOrgCandidates(params),
    enabled: filter !== '',
    staleTime: 10 * 1000,
    retry: false
  })
}

export function organizationsQueryOptions(filters: OrganizationFilters) {
  return queryOptions({
    queryKey: ['organizations', 'list', filters],
    queryFn: async () => {
      const filter = buildOrgFilter(filters)
      const result = await pb.collection('organizations').getList(1, 50, {
        filter: filter || undefined,
        sort: '-updated'
      })
      return result.items.map((item) => organizationResponseSchema.parse(item))
    },
    staleTime: 30 * 1000
  })
}

export function organizationDetailQueryOptions(id: string) {
  return queryOptions({
    queryKey: ['organizations', 'detail', id],
    queryFn: async () => {
      const record = await pb.collection('organizations').getOne(id)
      return organizationResponseSchema.parse(record)
    }
  })
}

export async function createOrganization(data: OrganizationFormFields) {
  const record = await pb.collection('organizations').create(data)
  return organizationResponseSchema.parse(record)
}

export async function updateOrganization(
  id: string,
  data: OrganizationFormFields
) {
  const record = await pb.collection('organizations').update(id, data)
  return organizationResponseSchema.parse(record)
}

export async function deleteOrganization(id: string) {
  await pb.collection('organizations').delete(id)
}
