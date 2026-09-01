import { Button } from '@/components/ui/button'
import { splitSummary, type EventToken } from '@/lib/event-tokens'
import { Event } from '@/schemas/event-schema'
import {
  personsQueryOptions,
  emptyPersonFilters
} from '@/services/api-persons'
import {
  organizationsQueryOptions,
  emptyOrganizationFilters
} from '@/services/api-organizations'
import { useSuspenseQuery } from '@tanstack/react-query'
import { PencilIcon, Trash2Icon } from 'lucide-react'
import { EventTypeBadge } from './event-type-badge'

// 事件卡片:日期 + 类型徽章 + summary(内联可点姓名 chip 嵌在原位)。
// token 渲染为 chip:对象存在显示其名(token 内缓存名兜底),已删显示缓存名。
// 点击 chip 跳转该对象详情(人 → /social?person=<id>,组织 → /social?org=<id>——路由按实际)。
export default function EventCard({
  event,
  onEdit,
  onDelete,
  onSelectTarget
}: {
  event: Event
  onEdit?: () => void
  onDelete?: () => void
  // 点击参与方 chip 跳转到该对象详情(由 WorkbenchPage 的 handleSelect 驱动)
  onSelectTarget?: (target: {
    type: 'persons' | 'organizations'
    id: string
  }) => void
}) {
  // 全量缓存人/组织名(token id 反查名字表)
  const { data: persons } = useSuspenseQuery(
    personsQueryOptions(emptyPersonFilters)
  )
  const { data: orgs } = useSuspenseQuery(
    organizationsQueryOptions(emptyOrganizationFilters)
  )

  const personName = (id: string) => {
    const p = persons.find((x) => x.id === id)
    return p ? `${p.last_name}${p.first_name}` : ''
  }
  const orgName = (id: string) => orgs.find((o) => o.id === id)?.name ?? ''

  const parts = splitSummary(event.summary)

  return (
    <div className='flex gap-3 py-2'>
      <span className='text-muted-foreground w-24 shrink-0 text-sm tabular-nums'>
        {event.happen_at}
      </span>
      <div className='flex-1 space-y-1'>
        <div className='flex items-center gap-2'>
          <EventTypeBadge type={event.type ?? ''} />
        </div>
        <p className='text-sm leading-relaxed'>
          {parts.map((part, i) =>
            part.kind === 'text' ? (
              <span key={i}>{part.text}</span>
            ) : (
              <TokenChip
                key={i}
                token={part.token}
                resolve={part.token.kind === 'p' ? personName : orgName}
                onSelectTarget={onSelectTarget}
              />
            )
          )}
        </p>
      </div>
      {(onEdit || onDelete) && (
        <span className='flex items-center'>
          {onEdit && (
            <Button
              variant='ghost'
              size='icon'
              aria-label='编辑'
              onClick={onEdit}
            >
              <PencilIcon className='size-4' />
            </Button>
          )}
          {onDelete && (
            <Button
              variant='ghost'
              size='icon'
              aria-label='删除'
              onClick={onDelete}
            >
              <Trash2Icon className='size-4' />
            </Button>
          )}
        </span>
      )}
    </div>
  )
}

// token chip:对象存在用最新名,否则用 token 内缓存名(优雅降级)。
// 点击 chip → onSelectTarget(p→persons / o→organizations),由 WorkbenchPage 切到该对象详情。
function TokenChip({
  token,
  resolve,
  onSelectTarget
}: {
  token: EventToken
  resolve: (id: string) => string
  onSelectTarget?: (target: {
    type: 'persons' | 'organizations'
    id: string
  }) => void
}) {
  const name = resolve(token.id) || token.label || '已删除联系人'
  return (
    <span
      role='button'
      className='bg-muted text-foreground mx-0.5 inline-flex cursor-pointer items-center rounded px-1 align-baseline text-sm hover:underline'
      onClick={() =>
        onSelectTarget?.({
          type: token.kind === 'p' ? 'persons' : 'organizations',
          id: token.id
        })
      }>
      {name}
    </span>
  )
}
