import {
  Person,
  PersonFormFields,
  personResponseSchema
} from '@/schemas/person-schema'
import { queryOptions } from '@tanstack/react-query'
import { pb } from './pocketbase'

// 透传 expand 的人员类型:列表与详情查询均展开 current_org_id(Task 3 依赖)
export type PersonWithOrg = Person & {
  expand?: { current_org_id?: { name: string } }
}

// 人员列表过滤条件(高级过滤面板的状态)
export interface PersonFilters {
  query: string
  personTags: string
  socialTags: string
  nativePlace: string
  graduateSchool: string
  trustLevel: string // '' 或 1-5
}

export const emptyPersonFilters: PersonFilters = {
  query: '',
  personTags: '',
  socialTags: '',
  nativePlace: '',
  graduateSchool: '',
  trustLevel: ''
}

// 检索视图:「全部」= 数据库默认序;「最近更新」= 30 天内更新 + 时间倒序
export type PersonViewMode = 'all' | 'recent'

// 30 天前时间戳(可注入 now 便于测试)
export function oneMonthAgoIso(now: Date = new Date()): string {
  return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
}

// 组合基础过滤与「最近更新」时间条件;无任何条件时返回 undefined(走数据库默认序)
export function buildPersonListFilter(
  filters: PersonFilters,
  viewMode: PersonViewMode
): string | undefined {
  const parts: string[] = []
  const base = buildPersonFilter(filters)
  if (base) parts.push(base)
  if (viewMode === 'recent') {
    parts.push(`updated >= '${oneMonthAgoIso()}'`)
  }
  return parts.length ? parts.join(' && ') : undefined
}

// 纯函数:构造 persons 列表 filter 表达式(供检索栏与测试复用)
export function buildPersonFilter(filters: PersonFilters): string {
  const parts: string[] = []
  const q = filters.query.trim()

  if (q) {
    parts.push(
      `last_name~'${q}' || first_name~'${q}' || nickname~'${q}' || mobile~'${q}'`
    )
  }
  if (filters.personTags.trim()) {
    parts.push(`person_tags~'${filters.personTags.trim()}'`)
  }
  if (filters.socialTags.trim()) {
    parts.push(`social_tags~'${filters.socialTags.trim()}'`)
  }
  if (filters.nativePlace.trim()) {
    parts.push(`native_place~'${filters.nativePlace.trim()}'`)
  }
  if (filters.graduateSchool.trim()) {
    parts.push(`graduate_school~'${filters.graduateSchool.trim()}'`)
  }
  if (filters.trustLevel) {
    parts.push(`trust_level=${filters.trustLevel}`)
  }

  return parts.length ? parts.map((p) => `(${p})`).join(' && ') : ''
}

// 列表查询(viewMode:all 不传 sort 走默认序;recent 过滤 30 天内并按更新时间倒序)
export function personsQueryOptions(
  filters: PersonFilters,
  viewMode: PersonViewMode = 'all'
) {
  return queryOptions({
    queryKey: ['persons', 'list', viewMode, filters],
    queryFn: async () => {
      const result = await pb.collection('persons').getList(1, 50, {
        filter: buildPersonListFilter(filters, viewMode),
        sort: viewMode === 'recent' ? '-updated' : undefined,
        expand: 'current_org_id'
      })
      return result.items.map(
        (item) =>
          ({
            ...personResponseSchema.parse(item),
            expand: item.expand as PersonWithOrg['expand']
          }) as PersonWithOrg
      )
    },
    staleTime: 30 * 1000
  })
}

// 详情查询(展开当前任职单位)
export function personDetailQueryOptions(id: string) {
  return queryOptions({
    queryKey: ['persons', 'detail', id],
    queryFn: async () => {
      const record = await pb.collection('persons').getOne(id, {
        expand: 'current_org_id'
      })
      return {
        ...personResponseSchema.parse(record),
        expand: record.expand as PersonWithOrg['expand']
      } as PersonWithOrg
    }
  })
}

export async function createPerson(data: PersonFormFields) {
  const record = await pb.collection('persons').create(data)
  return personResponseSchema.parse(record)
}

export async function updatePerson(id: string, data: PersonFormFields) {
  const record = await pb.collection('persons').update(id, data)
  return personResponseSchema.parse(record)
}

export async function deletePerson(id: string) {
  await pb.collection('persons').delete(id)
}
