import { Button } from '@/components/ui/button'
import { Relation } from '@/schemas/relation-schema'
import {
  deleteRelation,
  relationsOfPersonQueryOptions
} from '@/services/api-relations'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { useState } from 'react'
import RelationFormDialog from './relation-form-dialog'

// 关系列表:对方姓名 + 关系描述;可新增(弹窗)、编辑(弹窗)、删除(确认)
export default function PersonRelationsTab({ personId }: { personId: string }) {
  const { data: relations } = useSuspenseQuery(
    relationsOfPersonQueryOptions(personId)
  )
  const [open, setOpen] = useState(false)
  // 编辑中的关系记录;非空时弹窗进入编辑模式(RelationWithExpand 结构兼容 Relation,可直接赋值)
  const [editing, setEditing] = useState<Relation | null>(null)
  const queryClient = useQueryClient()

  const deleteMutation = useMutation({
    mutationFn: deleteRelation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['persons', personId, 'relations'] })
    }
  })

  return (
    <div className='space-y-2'>
      <div className='flex items-center justify-between'>
        <h2 className='text-sm font-semibold'>社会关系</h2>
        <Button size='sm' onClick={() => setOpen(true)}>
          <PlusIcon className='size-4' /> 新增
        </Button>
      </div>
      <ul className='divide-y'>
        {relations.map((relation) => {
          // 对方 = expand 中 id 不等于当前对象的另一侧
          const other =
            relation.expand?.person_a?.id === personId
              ? relation.expand?.person_b
              : relation.expand?.person_a
          const otherName = other
            ? `${other.last_name}${other.first_name}`
            : '未知'
          return (
            <li
              key={relation.id}
              className='flex items-center justify-between py-2 text-sm'>
              <span>
                <span className='font-medium'>{otherName}</span>
                <span className='text-muted-foreground ml-2'>
                  {relation.relation_description}
                </span>
              </span>
              <span className='flex items-center'>
                <Button
                  variant='ghost'
                  size='icon'
                  aria-label='编辑'
                  onClick={() => setEditing(relation)}>
                  <PencilIcon className='size-4' />
                </Button>
                <Button
                  variant='ghost'
                  size='icon'
                  aria-label='删除'
                  onClick={() => {
                    if (confirm(`确定删除与「${otherName}」的关系?`)) {
                      deleteMutation.mutate(relation.id)
                    }
                  }}>
                  <Trash2Icon className='size-4' />
                </Button>
              </span>
            </li>
          )
        })}
        {relations.length === 0 && (
          <li className='text-muted-foreground py-4 text-center text-sm'>
            暂无关系记录
          </li>
        )}
      </ul>
      {/* 新增/编辑共用弹窗:编辑时传 relation 进入编辑模式;关闭时清空编辑状态 */}
      <RelationFormDialog
        open={open || editing !== null}
        personId={personId}
        relation={editing ?? undefined}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setEditing(null)
        }}
      />
    </div>
  )
}
