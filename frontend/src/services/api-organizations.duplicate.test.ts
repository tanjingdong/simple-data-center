import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getFullList } = vi.hoisted(() => ({ getFullList: vi.fn() }))

vi.mock('./pocketbase', () => ({
  pb: { collection: () => ({ getFullList }) }
}))

import {
  buildDuplicateOrgFilter,
  duplicateOrgCandidatesQueryOptions,
  findDuplicateOrgCandidates,
  matchesDuplicateOrg
} from './api-organizations'

describe('buildDuplicateOrgFilter', () => {
  it('按聚合检索列包含召回,并去除名称首尾空白', () => {
    expect(buildDuplicateOrgFilter({ name: ' 甲 ' })).toBe("(search_text~'甲')")
  })

  it('编辑模式追加排除自身的条件', () => {
    expect(buildDuplicateOrgFilter({ name: '甲', excludeId: 'abc' })).toBe(
      "(search_text~'甲') && id != 'abc'"
    )
  })

  it('纯空白名称不产生任何条件', () => {
    expect(buildDuplicateOrgFilter({ name: '  ' })).toBe('')
  })

  it('转义单引号,避免拼坏 filter 表达式', () => {
    expect(buildDuplicateOrgFilter({ name: "甲'乙" })).toBe(
      "(search_text~'甲\\'乙')"
    )
  })
})

describe('matchesDuplicateOrg', () => {
  it('双方 trim 后完全相等即命中', () => {
    expect(matchesDuplicateOrg({ name: ' 甲 ' }, '甲')).toBe(true)
  })

  it('名称不同不命中', () => {
    expect(matchesDuplicateOrg({ name: '甲' }, '乙')).toBe(false)
  })

  it('空名称(含纯空白)不命中', () => {
    expect(matchesDuplicateOrg({ name: '  ' }, '  ')).toBe(false)
  })
})

describe('duplicateOrgCandidatesQueryOptions', () => {
  it('无有效名称时禁用查询', () => {
    expect(duplicateOrgCandidatesQueryOptions({ name: '  ' }).enabled).toBe(
      false
    )
  })

  it('有效名称时启用查询,短缓存且不重试(旧库缺少 search_text 时提示静默隐藏)', () => {
    const opts = duplicateOrgCandidatesQueryOptions({ name: '甲' })
    expect(opts.enabled).toBe(true)
    expect(opts.staleTime).toBe(10 * 1000)
    expect(opts.retry).toBe(false)
    expect(opts.queryKey).toEqual([
      'organizations',
      'duplicates',
      { name: '甲' }
    ])
  })
})

describe('findDuplicateOrgCandidates', () => {
  beforeEach(() => {
    getFullList.mockReset()
  })

  it('召回超集后只返回 trim 后完全相等的行', async () => {
    getFullList.mockResolvedValue([
      { id: 'orgexact0000001', name: '甲', search_text: '甲' },
      { id: 'orglonger000001', name: '甲乙' },
      { id: 'orgpadded000001', name: ' 甲 ' },
      { id: 'orgother0000001', name: '乙' }
    ])

    const result = await findDuplicateOrgCandidates({ name: ' 甲 ' })

    expect(result.map((o) => o.id)).toEqual([
      'orgexact0000001',
      'orgpadded000001'
    ])
    expect(getFullList).toHaveBeenCalledTimes(1)
    expect(getFullList).toHaveBeenCalledWith({ filter: "(search_text~'甲')" })
  })

  it('解析响应时缺失的 search_text 补为空串', async () => {
    getFullList.mockResolvedValue([{ id: 'orgexact0000001', name: '甲' }])

    const result = await findDuplicateOrgCandidates({ name: '甲' })

    expect(result[0].search_text).toBe('')
  })

  it('名称为空时不查询并返回空数组', async () => {
    const result = await findDuplicateOrgCandidates({ name: ' ' })

    expect(result).toEqual([])
    expect(getFullList).not.toHaveBeenCalled()
  })
})
