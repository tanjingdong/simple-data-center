import type { PersonWithOrg } from '@/services/api-persons'

// 备选人员展示信息:姓名 + 昵称 + 单位,供 @提及候选与社会关系选择器共用。
// label 固定为「姓+名」——@ 提及插入正文用它,昵称/单位仅展示。
export interface PersonCandidateDisplay {
  label: string
  nickname: string
  orgName: string
}

export function buildPersonCandidateDisplay(
  person: PersonWithOrg
): PersonCandidateDisplay {
  return {
    label: `${person.last_name}${person.first_name}`,
    nickname: person.nickname || '',
    orgName: person.expand?.current_org_id?.name || ''
  }
}
