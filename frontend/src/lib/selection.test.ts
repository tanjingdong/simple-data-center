import type { PersonWithOrg } from '@/services/api-persons'
import { describe, expect, it } from 'vitest'
import {
  buildDatasetKey,
  checkKey,
  countChecked,
  isDefaultSearch,
  selectExportedPersons,
  toggleCheck
} from './selection'

function makePerson(id: string, name: string): PersonWithOrg {
  return { id, last_name: name, first_name: '' } as unknown as PersonWithOrg
}

describe('checkKey / toggleCheck', () => {
  it('生成复合键并支持勾选/取消', () => {
    const key = checkKey('persons', 'abc123')
    expect(key).toBe('persons:abc123')
    const after = toggleCheck(new Set(), key, true)
    expect(after.has(key)).toBe(true)
    const afterOff = toggleCheck(after, key, false)
    expect(afterOff.has(key)).toBe(false)
    expect(after.has(key)).toBe(true) // 原 Set 不被修改
  })
})

describe('countChecked', () => {
  it('分别统计人员与组织', () => {
    const set = new Set([
      checkKey('persons', 'a'),
      checkKey('persons', 'b'),
      checkKey('organizations', 'c')
    ])
    expect(countChecked(set)).toEqual({ persons: 2, organizations: 1 })
  })
})

describe('buildDatasetKey', () => {
  it('同一数据集生成稳定键,数据集变化生成不同键', () => {
    const applied = { query: '', personFilters: {}, orgFilters: {} }
    expect(buildDatasetKey('all', 'all', applied)).toBe(
      buildDatasetKey('all', 'all', applied)
    )
    expect(buildDatasetKey('all', 'all', applied)).not.toBe(
      buildDatasetKey('recent', 'all', applied)
    )
  })
})

describe('selectExportedPersons', () => {
  it('仅导出勾选的人员,统计被跳过的组织', () => {
    const persons = [makePerson('p1', '张'), makePerson('p2', '李')]
    const checked = new Set([
      checkKey('persons', 'p1'),
      checkKey('organizations', 'o1')
    ])
    const { exported, skippedOrgs } = selectExportedPersons(checked, persons)
    expect(exported.map((p) => p.id)).toEqual(['p1'])
    expect(skippedOrgs).toBe(1)
  })

  it('无勾选人员时导出为空', () => {
    const persons = [makePerson('p1', '张')]
    const { exported, skippedOrgs } = selectExportedPersons(new Set(), persons)
    expect(exported).toEqual([])
    expect(skippedOrgs).toBe(0)
  })
})

describe('isDefaultSearch', () => {
  const empty = {
    query: '',
    personTags: '',
    socialTags: '',
    nativePlace: '',
    graduateSchool: '',
    trustLevel: '',
    orgType: ''
  }

  it('所有条件为空时视为默认(未检索)', () => {
    expect(isDefaultSearch(empty)).toBe(true)
  })

  it('任一条件非空即非默认', () => {
    expect(isDefaultSearch({ ...empty, query: '张' })).toBe(false)
    expect(isDefaultSearch({ ...empty, personTags: '核心圈' })).toBe(false)
    expect(isDefaultSearch({ ...empty, socialTags: '医疗' })).toBe(false)
    expect(isDefaultSearch({ ...empty, nativePlace: '湖南' })).toBe(false)
    expect(isDefaultSearch({ ...empty, trustLevel: '3' })).toBe(false)
    expect(isDefaultSearch({ ...empty, orgType: '医疗机构' })).toBe(false)
  })

  it('与 viewMode 无关(默认视图改为最近更新后仍判为默认)', () => {
    // 函数签名不含 viewMode;默认 recent + 空条件 → 仍为默认态 → 提示"暂无联系人"
    expect(isDefaultSearch(empty)).toBe(true)
  })
})
