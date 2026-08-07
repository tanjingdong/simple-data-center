import { Button } from '@/components/ui/button'
import {
  deleteLink,
  linksOfOrgQueryOptions
} from '@/services/api-person-org-links'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { Trash2Icon } from 'lucide-react'

// 组织成员列表:人员姓名 + 关联描述;可删除(确认)
export default function OrganizationMembersTab({ orgId }: { orgId: string }) {
  const { data: links } = useSuspenseQuery(linksOfOrgQueryOptions(orgId))
  const queryClient = useQueryClient()

  const deleteMutation = useMutation({
    mutationFn: deleteLink,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations', orgId, 'members'] })
    }
  })

  return (
    <div className='space-y-2'>
      <h2 className='text-sm font-semibold'>成员列表</h2>
      <ul className='divide-y'>
        {links.map((link) => {
          const person = link.expand?.person_id
          const personName = person
            ? `${person.last_name}${person.first_name}`
            : '未知'
          return (
            <li key={link.id} className='flex items-center justify-between py-2 text-sm'>
              <span>
                <span className='font-medium'>{personName}</span>
                <span className='text-muted-foreground ml-2'>
                  {link.link_description}
                </span>
              </span>
              <Button
                variant='ghost'
                size='icon'
                aria-label='删除'
                onClick={() => {
                  if (confirm(`确定移除成员「${personName}」?`)) {
                    deleteMutation.mutate(link.id)
                  }
                }}>
                <Trash2Icon className='size-4' />
              </Button>
            </li>
          )
        })}
        {links.length === 0 && (
          <li className='text-muted-foreground py-4 text-center text-sm'>
            暂无成员记录
          </li>
        )}
      </ul>
    </div>
  )
}
