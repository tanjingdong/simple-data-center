// vCard 3.0 属性值转义:顺序固定(反斜杠 → 分号 → 逗号 → 换行),避免二次转义
export function escapeVCardValue(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

import type { PersonWithOrg } from '@/services/api-persons'

// 单条 vCard 生成;姓名双空返回 ''(调用方跳过)
export function buildVCard(person: PersonWithOrg): string {
  const last = person.last_name
  const first = person.first_name
  const fullName = `${last}${first}`
  if (!fullName) return ''

  const lines: string[] = ['BEGIN:VCARD', 'VERSION:3.0', `UID:${person.id}`]
  lines.push(
    `N;CHARSET=UTF-8:${escapeVCardValue(last)};${escapeVCardValue(first)};;;`
  )
  lines.push(`FN;CHARSET=UTF-8:${escapeVCardValue(fullName)}`)
  if (person.nickname) {
    lines.push(`NICKNAME;CHARSET=UTF-8:${escapeVCardValue(person.nickname)}`)
  }
  if (person.mobile) {
    lines.push(`TEL;TYPE=CELL,PREF:${escapeVCardValue(person.mobile)}`)
  } else {
    // 小米等系统:无手机号也必须输出空值 TEL 行,否则联系人不被导入
    lines.push('TEL;TYPE=CELL,PREF:')
  }
  if (person.office_phone) {
    lines.push(`TEL;TYPE=WORK:${escapeVCardValue(person.office_phone)}`)
  }
  if (person.email) {
    lines.push(`EMAIL;TYPE=INTERNET:${escapeVCardValue(person.email)}`)
  }
  if (person.birthday) {
    lines.push(`BDAY:${person.birthday}`)
  }
  if (person.gender === '男') lines.push('GENDER:M')
  if (person.gender === '女') lines.push('GENDER:F')
  const orgName = person.expand?.current_org_id?.name
  if (orgName) {
    lines.push(`ORG;CHARSET=UTF-8:${escapeVCardValue(orgName)}`)
  }
  const title = [person.admin_position, person.tech_title]
    .filter(Boolean)
    .join(',')
  if (title) {
    lines.push(`TITLE;CHARSET=UTF-8:${escapeVCardValue(title)}`)
  }
  if (person.office_address) {
    lines.push(`ADR;TYPE=WORK:;;${escapeVCardValue(person.office_address)};;;;`)
  }
  if (person.home_address) {
    lines.push(`ADR;TYPE=HOME:;;${escapeVCardValue(person.home_address)};;;;`)
  }
  // 标签按逗号拆分逐项转义,再以逗号连接(逗号是 CATEGORIES 的多值分隔符)
  const tags = [
    ...person.person_tags.split(','),
    ...person.social_tags.split(',')
  ]
    .map((t) => t.trim())
    .filter(Boolean)
  if (tags.length) {
    lines.push(`CATEGORIES:${tags.map(escapeVCardValue).join(',')}`)
  }
  lines.push('END:VCARD')
  return lines.join('\r\n')
}

// 多卡拼接,空卡过滤
export function buildVCardFile(persons: PersonWithOrg[]): string {
  return persons.map(buildVCard).filter(Boolean).join('\r\n')
}

import { dateToString } from './date-convert'

// Blob 默认输出 UTF-8 无 BOM;文件名含日期(无横线)避免覆盖
export function downloadVCard(persons: PersonWithOrg[]): void {
  const content = buildVCardFile(persons)
  // 空内容直接返回,避免下载空文件
  if (!content) return
  const blob = new Blob([content], { type: 'text/vcard;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `PIM通讯录-${dateToString().replaceAll('-', '')}.vcf`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
