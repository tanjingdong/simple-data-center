import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/shadcn'
import type { Organization } from '@/schemas/organization-schema'
import type { Person } from '@/schemas/person-schema'
import { TrustStars } from './trust-stars'

interface PersonCardProps {
  person: Person
  expandedOrgName?: string
  selected: boolean
  onClick(): void
}

// 人员条目:姓名 + 任职单位 + 人脉标签徽章 + 信任星级
export function PersonTargetCard({
  person,
  expandedOrgName,
  selected,
  onClick
}: PersonCardProps) {
  return (
    <Button
      variant='ghost'
      className={cn(
        'flex h-auto w-full flex-col items-start gap-1 rounded-md px-3 py-2',
        selected && 'bg-accent'
      )}
      onClick={onClick}>
      <span className='flex w-full items-center justify-between'>
        <span className='font-semibold'>
          {person.last_name}
          {person.first_name}
          {person.nickname && (
            <span className='text-muted-foreground ml-1 text-xs font-normal'>
              ({person.nickname})
            </span>
          )}
        </span>
        <TrustStars value={person.trust_level} />
      </span>
      <span className='flex w-full items-center gap-1 text-xs'>
        <span className='text-muted-foreground truncate'>
          {expandedOrgName || person.admin_position || '—'}
        </span>
        {person.person_tags
          .split(',')
          .filter(Boolean)
          .slice(0, 2)
          .map((tag) => (
            <Badge key={tag} variant='outline' className='text-[10px]'>
              {tag}
            </Badge>
          ))}
      </span>
    </Button>
  )
}

interface OrgCardProps {
  org: Organization
  selected: boolean
  onClick(): void
}

// 组织条目:名称 + 类型徽章 + 资源评级
export function OrgTargetCard({ org, selected, onClick }: OrgCardProps) {
  return (
    <Button
      variant='ghost'
      className={cn(
        'flex h-auto w-full flex-col items-start gap-1 rounded-md px-3 py-2',
        selected && 'bg-accent'
      )}
      onClick={onClick}>
      <span className='flex w-full items-center justify-between'>
        <span className='font-semibold'>{org.name}</span>
        <TrustStars value={org.importance_level} />
      </span>
      <span className='flex w-full items-center gap-1 text-xs'>
        {org.type && <Badge variant='secondary'>{org.type}</Badge>}
      </span>
    </Button>
  )
}
