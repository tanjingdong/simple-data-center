import { buildTagPool, type TagRecord } from '@/lib/person-tags'
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
    // 姓名/昵称/单位/职务统一走聚合列 search_text,手机号单独分支;
    // 查询词保持原词(数据侧已含姓名两形态,无分隔聚合宁多召回)。
    parts.push(`search_text~'${q}' || mobile~'${q}'`)
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

// 转义 PocketBase filter 字符串字面量中的特殊字符(单引号与反斜杠),
// 避免用户输入拼坏过滤器。
export function escapeFilterValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

// 重复联系人检索条件:同名同姓(姓、名分别精确相等)或同手机号(精确相等),
// 编辑模式排除自身。无有效条件时返回空串(使用方据此跳过查询)。
export function buildDuplicatePersonFilter(params: {
  lastName: string
  firstName: string
  mobile: string
  excludeId?: string
}): string {
  const lastName = params.lastName.trim()
  const firstName = params.firstName.trim()
  const mobile = params.mobile.trim()

  const conds: string[] = []
  if (lastName && firstName) {
    conds.push(
      `(last_name='${escapeFilterValue(lastName)}' && first_name='${escapeFilterValue(firstName)}')`
    )
  }
  if (mobile) {
    conds.push(`(mobile='${escapeFilterValue(mobile)}')`)
  }
  if (conds.length === 0) return ''

  const expr = conds.join(' || ')
  // 多项以 || 连接时整体再包一层括号:既与单测期望一致,也保证后续
  // 拼上 `&& id != '…'` 时不会因 && 优先级高于 || 而只作用于最后一个条件
  const grouped = conds.length > 1 ? `(${expr})` : expr
  return params.excludeId
    ? `(${grouped}) && id != '${escapeFilterValue(params.excludeId)}'`
    : grouped
}

// 疑似重复联系人查询(编辑页警示用);expand 单位用于展示区分信息。
export function duplicatePersonCandidatesQueryOptions(params: {
  lastName: string
  firstName: string
  mobile: string
  excludeId?: string
}) {
  const filter = buildDuplicatePersonFilter(params)
  return queryOptions({
    queryKey: ['persons', 'duplicates', params],
    queryFn: async () => {
      const result = await pb.collection('persons').getList(1, 20, {
        filter,
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
    enabled: filter !== '',
    staleTime: 10 * 1000
  })
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

// 标签候选池:最近更新的 10 人仅投影两个标签字段,前端聚合出常用标签
// (queryKey 前缀与人员列表一致,列表相关失效会一并覆盖本查询)
export function personTagPoolQueryOptions() {
  return queryOptions({
    queryKey: ['persons', 'tag-pool'],
    queryFn: async () => {
      const result = await pb.collection('persons').getList(1, 10, {
        sort: '-updated',
        fields: 'person_tags,social_tags'
      })
      return buildTagPool(result.items as TagRecord[])
    },
    staleTime: 5 * 60 * 1000
  })
}
