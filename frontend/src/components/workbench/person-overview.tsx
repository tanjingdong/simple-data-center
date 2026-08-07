import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Person } from '@/schemas/person-schema'
import { TrustStars } from './trust-stars'

function FieldRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <div className='flex gap-2 py-1 text-sm'>
      <span className='text-muted-foreground w-20 shrink-0'>{label}</span>
      <span className='flex-1'>{value}</span>
    </div>
  )
}

// 标签类字段行:逗号分隔值以徽章形式展示(人脉标签/社会标签)
function BadgeRow({ label, value }: { label: string; value?: string }) {
  const tags = value?.split(',').filter(Boolean) ?? []
  return (
    <div className='flex gap-2 py-1 text-sm'>
      <span className='text-muted-foreground w-20 shrink-0'>{label}</span>
      <div className='flex flex-1 flex-wrap gap-1'>
        {tags.map((tag) => (
          <span
            key={tag}
            className='bg-muted inline-block rounded px-1.5 py-0.5 text-xs'>
            {tag}
          </span>
        ))}
      </div>
    </div>
  )
}

type SectionRow = { label: string; value?: string; badge?: boolean }

const sections = (
  person: Person,
  expandedOrgName?: string
): { title: string; rows: SectionRow[] }[] => [
  {
    title: '个人信息',
    rows: [
      { label: '性别', value: person.gender || undefined },
      { label: '生日', value: person.birthday || undefined },
      { label: '民族', value: person.ethnicity || undefined },
      { label: '血型', value: person.blood_type || undefined },
      { label: '生肖', value: person.zodiac || undefined },
      { label: '籍贯', value: person.native_place || undefined },
      { label: '出生地', value: person.birth_place || undefined },
      { label: '政治面貌', value: person.political_status || undefined },
      {
        label: '当前任职',
        value: expandedOrgName || person.admin_position || undefined
      },
      { label: '行政职务', value: person.admin_position || undefined },
      { label: '技术职称', value: person.tech_title || undefined },
      { label: '法人信息', value: person.legal_info || undefined }
    ]
  },
  {
    title: '联系信息',
    rows: [
      { label: '手机号', value: person.mobile || undefined },
      { label: '办公座机', value: person.office_phone || undefined },
      { label: '邮箱', value: person.email || undefined },
      { label: '办公地址', value: person.office_address || undefined },
      { label: '住宅地址', value: person.home_address || undefined }
    ]
  },
  {
    title: '人脉信息',
    rows: [
      {
        label: '人脉标签',
        value: person.person_tags || undefined,
        badge: true
      },
      { label: '社会标签', value: person.social_tags || undefined, badge: true }
    ]
  },
  {
    title: '个人档案',
    rows: [
      { label: '兴趣爱好', value: person.interests || undefined },
      { label: '子女信息', value: person.children_info || undefined },
      { label: '禁忌', value: person.taboo || undefined },
      { label: '关注', value: person.concern || undefined }
    ]
  }
]

export default function PersonOverview({
  person,
  expandedOrgName
}: {
  person: Person
  expandedOrgName?: string
}) {
  return (
    <div className='space-y-4'>
      <Card>
        <CardHeader className='pb-2'>
          <CardTitle className='flex items-center gap-2 text-lg'>
            <span>
              {person.last_name}
              {person.first_name}
            </span>
            {person.nickname && (
              <span className='text-muted-foreground text-sm font-normal'>
                ({person.nickname})
              </span>
            )}
            <TrustStars value={person.trust_level} />
          </CardTitle>
        </CardHeader>
      </Card>
      {sections(person, expandedOrgName).map((section) => (
        <Card key={section.title}>
          <CardHeader className='pb-2'>
            <CardTitle className='text-base'>{section.title}</CardTitle>
          </CardHeader>
          <CardContent className='flex flex-col'>
            {section.rows.map((row) =>
              row.badge ? (
                <BadgeRow key={row.label} label={row.label} value={row.value} />
              ) : (
                <FieldRow key={row.label} label={row.label} value={row.value} />
              )
            )}
            {section.rows.every((row) => !row.value) && (
              <p className='text-muted-foreground text-sm'>暂无内容</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
