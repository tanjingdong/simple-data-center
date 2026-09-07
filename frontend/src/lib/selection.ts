import type { PersonWithOrg } from '@/services/api-persons'

// 检索范围(类型切换)
export type SearchScope = 'all' | 'persons' | 'organizations'

// 勾选对象类型
export type TargetType = 'persons' | 'organizations'

// 勾选复合键:类型:id(PocketBase 各集合 id 可能碰撞,复合键保证唯一)
export type CheckedKey = string

export function checkKey(type: TargetType, id: string): CheckedKey {
  return `${type}:${id}`
}

// 勾选切换(不可变更新,返回新 Set)
export function toggleCheck(
  set: Set<CheckedKey>,
  key: CheckedKey,
  checked: boolean
): Set<CheckedKey> {
  const next = new Set(set)
  if (checked) next.add(key)
  else next.delete(key)
  return next
}

// 按类型统计勾选数量
export function countChecked(checked: Set<CheckedKey>): {
  persons: number
  organizations: number
} {
  let persons = 0
  let organizations = 0
  for (const key of checked) {
    if (key.startsWith('persons:')) persons += 1
    else organizations += 1
  }
  return { persons, organizations }
}

// 数据集身份键:条件/视图/范围任一变化即变化,用于清空勾选
export function buildDatasetKey(
  viewMode: string,
  scope: SearchScope,
  applied: unknown
): string {
  return `${viewMode}|${scope}|${JSON.stringify(applied)}`
}

// 导出选择:勾选的人员 + 跳过的组织数
export function selectExportedPersons(
  checked: Set<CheckedKey>,
  persons: PersonWithOrg[]
): { exported: PersonWithOrg[]; skippedOrgs: number } {
  const exported = persons.filter((p) => checked.has(checkKey('persons', p.id)))
  let skippedOrgs = 0
  for (const key of checked) {
    if (key.startsWith('organizations:')) skippedOrgs += 1
  }
  return { exported, skippedOrgs }
}

// 默认检索判断:无任何已应用过滤条件(含 query)即视为"未检索"。
// 不再以 viewMode 为门槛——默认视图改为「最近更新」后,
// 进入即空列表仍应提示"暂无联系人"而非"没有匹配的结果"。
export function isDefaultSearch(applied: {
  query: string
  personTags: string
  socialTags: string
  nativePlace: string
  graduateSchool: string
  trustLevel: string
  orgType: string
}): boolean {
  return (
    applied.query === '' &&
    applied.personTags === '' &&
    applied.socialTags === '' &&
    applied.nativePlace === '' &&
    applied.graduateSchool === '' &&
    applied.trustLevel === '' &&
    applied.orgType === ''
  )
}
