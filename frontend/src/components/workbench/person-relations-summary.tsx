import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  formatRelationPeerName,
  getRelationOtherPerson,
  RELATION_PREVIEW_LIMIT,
  takeRelationPreview
} from '@/lib/relation-peers'
import { relationsOfPersonQueryOptions } from '@/services/api-relations'
import { useSuspenseQuery } from '@tanstack/react-query'

// 概况页「关系」摘要：按查询顺序（更新时间倒序）展示前 6 条；
// 对方姓名可点击跳转，超出上限时切到「关系」页签查看全部。
// 只读：增删改仍由关系页签负责。
export default function PersonRelationsSummary({
  personId,
  onSelectTarget,
  onViewAll
}: {
  personId: string
  onSelectTarget?: (target: {
    type: 'persons' | 'organizations'
    id: string
  }) => void
  onViewAll?: () => void
}) {
  const { data: relations } = useSuspenseQuery(
    relationsOfPersonQueryOptions(personId)
  )
  const preview = takeRelationPreview(relations)

  return (
    <Card>
      <CardHeader className='pb-2'>
        <CardTitle className='text-base'>关系</CardTitle>
      </CardHeader>
      <CardContent className='flex flex-col'>
        {preview.length === 0 ? (
          <p className='text-muted-foreground text-sm'>暂无关系记录</p>
        ) : (
          <ul className='divide-y'>
            {preview.map((relation) => {
              const other = getRelationOtherPerson(relation, personId)
              const otherName = formatRelationPeerName(other)
              const description = relation.relation_description
              const row = (
                <>
                  <span className='max-w-[45%] shrink-0 truncate font-medium'>
                    {otherName}
                  </span>
                  <span className='text-muted-foreground line-clamp-3 min-w-0 flex-1 break-words'>
                    {description}
                  </span>
                </>
              )
              return (
                <li key={relation.id}>
                  {other && onSelectTarget ? (
                    <button
                      type='button'
                      className='hover:bg-muted/60 flex w-full min-w-0 items-baseline gap-2 rounded-sm px-1 py-2 text-left text-sm'
                      title={description}
                      onClick={() =>
                        onSelectTarget({ type: 'persons', id: other.id })
                      }>
                      {row}
                    </button>
                  ) : (
                    <div
                      className='flex min-w-0 items-baseline gap-2 px-1 py-2 text-sm'
                      title={description}>
                      {row}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {relations.length > RELATION_PREVIEW_LIMIT && onViewAll && (
          <Button
            type='button'
            variant='link'
            size='sm'
            className='mt-2 h-auto self-start p-0 text-sm'
            onClick={onViewAll}>
            查看全部（{relations.length}）
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
