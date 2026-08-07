import { Button } from '@/components/ui/button'
import {
  linksOfPersonQueryOptions,
  deleteLink
} from '@/services/api-person-org-links'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { PlusIcon, Trash2Icon } from 'lucide-react'
import { useState } from 'react'
import LinkFormDialog from './link-form-dialog'

// 任职列表:单位名 + 关联描述;可新增(弹窗)、删除(确认)
export default function PersonLinksTab({ personId }: { personId: string }) {
  const { data: links } = useSuspenseQuery(linksOfPersonQueryOptions(personId))
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()

  const deleteMutation = useMutation({
    mutationFn: deleteLink,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['persons', personId, 'links'] })
    }
  })

  return (
    <div className='space-y-2'>
      <div className='flex items-center justify-between'>
        <h2 className='text-sm font-semibold'>任职与关联</h2>
        <Button size='sm' onClick={() => setOpen(true)}>
          <PlusIcon className='size-4' /> 新增
        </Button>
      </div>
      <ul className='divide-y'>
        {links.map((link) => (
          <li key={link.id} className='flex items-center justify-between py-2 text-sm'>
            <span>
              <span className='font-medium'>{link.expand?.org_id?.name}</span>
              <span className='text-muted-foreground ml-2'>{link.link_description}</span>
            </span>
            <Button
              variant='ghost'
              size='icon'
              aria-label='删除'
              onClick={() => {
                if (confirm(`确定删除与「${link.expand?.org_id?.name}」的关联?`)) {
                  deleteMutation.mutate(link.id)
                }
              }}>
              <Trash2Icon className='size-4' />
            </Button>
          </li>
        ))}
        {links.length === 0 && (
          <li className='text-muted-foreground py-4 text-center text-sm'>暂无任职记录</li>
        )}
      </ul>
      <LinkFormDialog
        open={open}
        onOpenChange={setOpen}
        personId={personId}
      />
    </div>
  )
}
