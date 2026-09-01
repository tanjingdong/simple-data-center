import { Button } from '@/components/ui/button'
import { errorToast, successToast } from '@/lib/toast'
import {
  deleteOrganization,
  organizationDetailQueryOptions
} from '@/services/api-organizations'
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery
} from '@tanstack/react-query'
import { PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { useState } from 'react'
import EventFormDialog from './event-form-dialog'
import OrganizationEventsTab from './organization-events-tab'
import OrganizationForm from './organization-form'
import OrganizationMembersTab from './organization-members-tab'
import OrganizationOverview from './organization-overview'
import { SimpleTabs } from './simple-tabs'

// 组织详情:概况/成员/事件 三个 Tab;编辑进入 OrganizationForm;
// 删除确认后:事件与人员当前单位置空、成员任职关联移除,完成后回调 onDeleted 清空选中
export default function OrganizationDetail({
  orgId,
  onDeleted,
  onSelectTarget
}: {
  orgId: string
  onDeleted?: () => void
  onSelectTarget?: (target: {
    type: 'persons' | 'organizations'
    id: string
  }) => void
}) {
  const { data: organization } = useSuspenseQuery(
    organizationDetailQueryOptions(orgId)
  )
  const [editing, setEditing] = useState(false)
  const [eventOpen, setEventOpen] = useState(false)
  const queryClient = useQueryClient()

  const deleteMutation = useMutation({
    mutationFn: deleteOrganization,
    onSuccess: () => {
      successToast('已删除')
      queryClient.invalidateQueries({ queryKey: ['organizations'] })
      onDeleted?.()
    },
    onError: (error) => errorToast('删除失败', error)
  })

  if (editing) {
    return (
      <OrganizationForm
        key={organization.id}
        organization={organization}
        onCancel={() => setEditing(false)}
        onSaved={() => setEditing(false)}
      />
    )
  }

  return (
    <div className='flex h-full flex-col gap-3 p-2'>
      <div className='flex items-center justify-between'>
        <h1 className='text-xl font-bold'>{organization.name}</h1>
        <div className='flex items-center gap-2'>
          <Button
            variant='outline'
            size='sm'
            onClick={() => setEventOpen(true)}>
            <PlusIcon className='size-4' /> 新增事件
          </Button>
          <Button variant='outline' size='sm' onClick={() => setEditing(true)}>
            <PencilIcon className='size-4' /> 编辑
          </Button>
          <Button
            variant='destructive'
            size='sm'
            onClick={() => {
              if (
                confirm(
                  `确定删除「${organization.name}」?引用该组织的事件与人员当前单位将自动置空,成员的任职关联记录将被移除,此操作不可撤销。`
                )
              ) {
                deleteMutation.mutate(organization.id)
              }
            }}>
            <Trash2Icon className='size-4' /> 删除
          </Button>
        </div>
      </div>

      <SimpleTabs
        tabs={[
          { value: 'overview', label: '概况' },
          { value: 'members', label: '成员' },
          { value: 'events', label: '事件' }
        ]}
        defaultValue='overview'>
        {(active) => (
          <>
            {active === 'overview' && (
              <OrganizationOverview organization={organization} />
            )}
            {active === 'members' && (
              <OrganizationMembersTab orgId={orgId} />
            )}
            {active === 'events' && (
              <OrganizationEventsTab
                orgId={orgId}
                onSelectTarget={onSelectTarget}
              />
            )}
          </>
        )}
      </SimpleTabs>
      {/* 头部「新增事件」按钮打开:prefill 当前组织 token */}
      <EventFormDialog
        open={eventOpen}
        prefill={{ kind: 'o', id: orgId, label: organization.name }}
        onOpenChange={setEventOpen}
      />
    </div>
  )
}
