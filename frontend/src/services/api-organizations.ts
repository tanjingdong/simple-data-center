import {
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
