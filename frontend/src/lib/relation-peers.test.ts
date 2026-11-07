import { describe, expect, it } from 'vitest'
import {
  formatRelationPeerName,
  getRelationOtherPerson,
  RELATION_PREVIEW_LIMIT,
  takeRelationPreview,
  type RelationWithPeers
} from './relation-peers'

const a = { id: 'a1', last_name: '康', first_name: '勇' }
const b = { id: 'b1', last_name: '夏', first_name: '志敏' }

function rel(over: Partial<RelationWithPeers> = {}): RelationWithPeers {
  return {
    person_a: a.id,
    person_b: b.id,
    expand: { person_a: a, person_b: b },
    ...over
  }
}

describe('getRelationOtherPerson', () => {
  it('当前人员是 a 时返回 b', () => {
    expect(getRelationOtherPerson(rel(), a.id)).toEqual(b)
  })

  it('当前人员是 b 时返回 a', () => {
    expect(getRelationOtherPerson(rel(), b.id)).toEqual(a)
  })

  it('expand 缺失时返回 undefined', () => {
    expect(
      getRelationOtherPerson(rel({ expand: undefined }), a.id)
    ).toBeUndefined()
  })

  it('两侧都不匹配当前人员时返回 undefined', () => {
    expect(getRelationOtherPerson(rel(), 'nobody')).toBeUndefined()
  })
})

describe('formatRelationPeerName', () => {
  it('姓+名拼接', () => {
    expect(formatRelationPeerName(a)).toBe('康勇')
  })

  it('缺失时返回「未知」', () => {
    expect(formatRelationPeerName(undefined)).toBe('未知')
  })
})

describe('takeRelationPreview', () => {
  it('默认截取前 6 条', () => {
    const many = Array.from({ length: 10 }, (_, i) => i)
    expect(RELATION_PREVIEW_LIMIT).toBe(6)
    expect(takeRelationPreview(many)).toEqual([0, 1, 2, 3, 4, 5])
  })

  it('可自定义上限，且不修改原数组', () => {
    const list = [1, 2, 3]
    expect(takeRelationPreview(list, 2)).toEqual([1, 2])
    expect(list).toEqual([1, 2, 3])
  })

  it('少于上限时全量返回', () => {
    expect(takeRelationPreview([1, 2])).toEqual([1, 2])
  })
})
