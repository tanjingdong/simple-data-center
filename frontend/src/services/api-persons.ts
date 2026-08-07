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

// 纯函数:构造 persons 列表 filter 表达式(供检索栏与测试复用)
export function buildPersonFilter(filters: PersonFilters): string {
  const parts: string[] = []
  const q = filters.query.trim()

  if (q) {
    parts.push(
      `(last_name~'${q}' || first_name~'${q}' || nickname~'${q}' || mobile~'${q}')`
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

// 列表查询(空 filter 时返回全部,按更新时间倒序)
export function personsQueryOptions(filters: PersonFilters) {
  return queryOptions({
    queryKey: ['persons', 'list', filters],
    queryFn: async () => {
      const filter = buildPersonFilter(filters)
      const result = await pb.collection('persons').getList(1, 50, {
        filter: filter || undefined,
        sort: '-updated',
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
