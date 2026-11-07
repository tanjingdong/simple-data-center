import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getFullList } = vi.hoisted(() => ({ getFullList: vi.fn() }))

vi.mock('./pocketbase', () => ({
  pb: { collection: () => ({ getFullList }) }
}))

import { findDuplicatePersonCandidates } from './api-persons'

// 构造「聚合列包含目标字符串、但姓名拼接不等于目标」的超集行
function supersetCandidate(i: number) {
  return {
    id: `cand${String(i).padStart(11, '0')}`,
    last_name: '李文',
    first_name: `明${i}`,
    mobile: ''
  }
}

describe('findDuplicatePersonCandidates', () => {
  beforeEach(() => {
    getFullList.mockReset()
  })

  it('超集超过一页时仍能命中排在后部的真重复(不截断于 20 条)', async () => {
    const rows = Array.from({ length: 24 }, (_, i) => supersetCandidate(i))
    rows.push({
      id: 'exact0000000000',
      last_name: '李',
      first_name: '文',
      mobile: ''
    })
    getFullList.mockResolvedValue(rows)

    const result = await findDuplicatePersonCandidates({
      lastName: '李文',
      firstName: '',
      mobile: ''
    })

    expect(result.map((p) => p.id)).toEqual(['exact0000000000'])
    expect(getFullList).toHaveBeenCalledTimes(1)
  })

  it('无任何条件时不查询并返回空数组', async () => {
    const result = await findDuplicatePersonCandidates({
      lastName: '',
      firstName: ' ',
      mobile: ''
    })

    expect(result).toEqual([])
    expect(getFullList).not.toHaveBeenCalled()
  })
})
