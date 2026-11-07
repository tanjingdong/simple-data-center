import type { PersonWithOrg } from '@/services/api-persons'
import { describe, expect, it } from 'vitest'
import { buildPersonCandidateDisplay } from './person-candidate'

function makePerson(over: Partial<PersonWithOrg>): PersonWithOrg {
  return {
    id: 'p1',
    last_name: '康',
    first_name: '勇',
    nickname: '',
    ...over
  } as PersonWithOrg
}

describe('buildPersonCandidateDisplay', () => {
  it('昵称与单位齐全时完整返回', () => {
    const d = buildPersonCandidateDisplay(
      makePerson({
        nickname: '老王',
        expand: { current_org_id: { name: '曲靖经开区' } }
      })
    )
    expect(d).toEqual({
      label: '康勇',
      nickname: '老王',
      orgName: '曲靖经开区'
    })
  })

  it('空昵称/空单位返回空字符串(不渲染占位)', () => {
    const d = buildPersonCandidateDisplay(makePerson({}))
    expect(d).toEqual({ label: '康勇', nickname: '', orgName: '' })
  })

  it('expand 缺失时单位为空字符串', () => {
    const d = buildPersonCandidateDisplay(makePerson({ nickname: '老王' }))
    expect(d.orgName).toBe('')
  })

  it('label 固定为姓+名(不含昵称/单位)', () => {
    const d = buildPersonCandidateDisplay(
      makePerson({
        nickname: '老王',
        expand: { current_org_id: { name: '某单位' } }
      })
    )
    expect(d.label).toBe('康勇')
  })
})
