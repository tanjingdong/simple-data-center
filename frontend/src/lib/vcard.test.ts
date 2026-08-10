import { describe, expect, it } from 'vitest'
import { buildVCard, buildVCardBytes, buildVCardFile, escapeVCardValue, isVCardOverLimit } from './vcard'

describe('escapeVCardValue', () => {
  it('转义反斜杠、分号、换行;逗号不转义', () => {
    expect(escapeVCardValue('a\\b;c,d\ne')).toBe('a\\\\b\\;c,d\\ne')
  })

  it('无特殊字符时原样返回', () => {
    expect(escapeVCardValue('张伟')).toBe('张伟')
  })

  it('空字符串返回空字符串', () => {
    expect(escapeVCardValue('')).toBe('')
  })
})

import type { PersonWithOrg } from '@/services/api-persons'

function makePerson(overrides: Record<string, unknown> = {}): PersonWithOrg {
  return {
    id: 'abc123',
    last_name: '张',
    first_name: '伟',
    gender: '男',
    birthday: '1985-06-15',
    id_card: '11010119850615001X',
    ethnicity: '汉族',
    political_status: '中共党员',
    person_tags: '核心圈,大学同学',
    social_tags: '',
    nickname: '小张',
    current_org_id: 'org1',
    admin_position: '副总经理',
    tech_title: '高级工程师',
    mobile: '13812345678',
    office_phone: '01012345678',
    email: 'zhangwei@example.com',
    office_address: '北京市,朝阳区,xx路1号',
    home_address: '',
    trust_level: 4,
    taboo: '讨厌榴莲',
    ...overrides
  } as unknown as PersonWithOrg
}

describe('buildVCard', () => {
  it('输出完整字段映射', () => {
    const vcard = buildVCard(makePerson({ expand: { current_org_id: { name: 'XX集团' } } }))
    const lines = vcard.split('\r\n')
    expect(lines[0]).toBe('BEGIN:VCARD')
    expect(lines[1]).toBe('VERSION:3.0')
    expect(lines[2]).toBe('UID:abc123')
    expect(lines[3]).toBe('N:张;伟;;;')
    expect(lines[4]).toBe('FN:张伟')
    expect(lines[5]).toBe('NICKNAME:小张')
    expect(lines[6]).toBe('TEL;TYPE=CELL,PREF:13812345678')
    expect(lines[7]).toBe('TEL;TYPE=WORK:01012345678')
    expect(lines[8]).toBe('EMAIL;TYPE=INTERNET:zhangwei@example.com')
    expect(lines[9]).toBe('BDAY:1985-06-15')
    expect(lines[10]).toBe('GENDER:M')
    expect(lines[11]).toBe('ORG:XX集团')
    expect(lines[12]).toBe('TITLE:副总经理,高级工程师')
    expect(lines[13]).toBe('ADR;TYPE=WORK:;;北京市,朝阳区,xx路1号;;;;')
    expect(lines[14]).toBe('CATEGORIES:核心圈,大学同学')
    expect(lines[15]).toBe('END:VCARD')
  })

  it('姓名双空返回空字符串', () => {
    expect(buildVCard(makePerson({ last_name: '', first_name: '' }))).toBe('')
  })

  it('只有姓时 N 与 FN 正常', () => {
    const vcard = buildVCard(makePerson({ last_name: '张', first_name: '' }))
    expect(vcard).toContain('N:张;;;;')
    expect(vcard).toContain('FN:张')
  })

  it('只有名时 N 与 FN 正常', () => {
    const vcard = buildVCard(makePerson({ last_name: '', first_name: '伟' }))
    expect(vcard).toContain('N:;伟;;;')
    expect(vcard).toContain('FN:伟')
  })

  it('gender 女 → GENDER:F,空则跳过', () => {
    expect(buildVCard(makePerson({ gender: '女' }))).toContain('GENDER:F')
    expect(buildVCard(makePerson({ gender: '' }))).not.toContain('GENDER')
  })

  it('TITLE 只有职称时只输出职称,都空时跳过', () => {
    const onlyTech = buildVCard(makePerson({ admin_position: '', tech_title: '高级工程师' }))
    expect(onlyTech).toContain('TITLE:高级工程师')
    const none = buildVCard(makePerson({ admin_position: '', tech_title: '' }))
    expect(none).not.toContain('TITLE')
  })

  it('标签合并:人脉 + 社会标签逗号连接', () => {
    const vcard = buildVCard(
      makePerson({ person_tags: '核心圈', social_tags: '医疗' })
    )
    expect(vcard).toContain('CATEGORIES:核心圈,医疗')
  })

  it('空字段一律不输出该属性', () => {
    const vcard = buildVCard(
      makePerson({
        nickname: '',
        mobile: '',
        office_phone: '',
        email: '',
        birthday: '',
        office_address: '',
        home_address: '',
        expand: {}
      })
    )
    expect(vcard).not.toContain('NICKNAME')
    expect(vcard).not.toContain('BDAY')
    expect(vcard).not.toContain('ADR')
    expect(vcard).not.toContain('ORG')
    // 小米等系统:无手机号也必须输出空值 TEL 行,否则联系人不被导入
    expect(vcard).toContain('\r\nTEL;TYPE=CELL,PREF:\r\n')
    // 无邮箱输出占位邮箱(微信以合规邮箱判定名片,必须非空)
    expect(vcard).toContain('EMAIL;TYPE=INTERNET:EMAIL@信息.缺失')
  })

  it('mobile 为空时输出空值 TEL 行(小米等系统需要)', () => {
    const vcard = buildVCard(makePerson({ mobile: '', office_phone: '' }))
    expect(vcard).toContain('\r\nTEL;TYPE=CELL,PREF:\r\n')
    expect(vcard).not.toContain('TEL;TYPE=WORK')
  })

  it('隐私字段不导出:身份证、政治面貌、信任评级等不在输出中', () => {
    const vcard = buildVCard(makePerson())
    expect(vcard).not.toContain('110101')
    expect(vcard).not.toContain('中共党员')
    expect(vcard).not.toContain('汉族')
    expect(vcard).not.toContain('讨厌榴莲')
    expect(vcard).not.toContain('trust_level')
  })
})

describe('buildVCardFile', () => {
  it('多卡以 CRLF 拼接', () => {
    const file = buildVCardFile([
      makePerson(),
      makePerson({ id: 'def456', first_name: '三' })
    ])
    const count = file.split('BEGIN:VCARD').length - 1
    expect(count).toBe(2)
    expect(file.split('\r\n').at(-1)).toBe('END:VCARD')
  })

  it('姓名双空的人员被跳过', () => {
    const file = buildVCardFile([
      makePerson(),
      makePerson({ last_name: '', first_name: '' })
    ])
    const count = file.split('BEGIN:VCARD').length - 1
    expect(count).toBe(1)
  })
})

describe('buildVCardBytes / isVCardOverLimit', () => {
  it('中文按 UTF-8 3 字节编码,字节数与手算一致', () => {
    const person = makePerson({
      nickname: '',
      mobile: '',
      office_phone: '',
      email: '',
      birthday: '',
      gender: '',
      admin_position: '',
      tech_title: '',
      office_address: '',
      home_address: '',
      person_tags: '',
      social_tags: '',
      expand: {}
    })
    // 基础 ASCII 115 字节 + 「张伟」12 字节(N 行与 FN 行各 6 字节)
    // + 占位邮箱中文 7 字节(信息/缺失各 3)= 134 字节
    expect(buildVCardBytes(person)).toHaveLength(134)
  })

  it('姓名双空时返回空字节数组', () => {
    const bytes = buildVCardBytes(makePerson({ last_name: '', first_name: '' }))
    expect(bytes).toHaveLength(0)
  })

  it('正常联系人不超限', () => {
    expect(isVCardOverLimit(makePerson())).toBe(false)
  })

  it('超长文本(长地址+大量标签)超限', () => {
    const person = makePerson({
      office_address: '北京市朝阳区xx路1号院'.repeat(100),
      person_tags: Array.from({ length: 60 }, (_, i) => `标签${i}`).join(','),
      social_tags: ''
    })
    expect(isVCardOverLimit(person)).toBe(true)
  })

  it('恰好等于 2953 字节不超限(≤ 判定)', () => {
    // 逐字符补齐 person_tags 使 vCard 总字节数恰好等于上限(每字符 1 字节,必达)
    let person = makePerson({
      nickname: '',
      mobile: '',
      office_phone: '',
      email: '',
      birthday: '',
      gender: '',
      admin_position: '',
      tech_title: '',
      office_address: '',
      home_address: '',
      person_tags: '',
      social_tags: '',
      expand: {}
    })
    for (let i = 1; new TextEncoder().encode(buildVCard(person)).length < 2953; i++) {
      person = { ...person, person_tags: 'a'.repeat(i) }
    }
    expect(buildVCardBytes(person)).toHaveLength(2953)
    expect(isVCardOverLimit(person)).toBe(false)
  })
})
