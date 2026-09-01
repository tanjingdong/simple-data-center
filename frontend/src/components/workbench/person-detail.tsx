import { Button } from '@/components/ui/button'
import { errorToast, successToast } from '@/lib/toast'
import { buildVCard } from '@/lib/vcard'
import { deletePerson, personDetailQueryOptions } from '@/services/api-persons'
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery
} from '@tanstack/react-query'
import { PencilIcon, PlusIcon, QrCodeIcon, Trash2Icon } from 'lucide-react'
import { useState } from 'react'
import EventFormDialog from './event-form-dialog'
import ExperiencePanel from './experience-panel'
import PersonEventsTab from './person-events-tab'
import PersonForm from './person-form'
import PersonLinksTab from './person-links-tab'
import PersonOverview from './person-overview'
import PersonQrDialog from './person-qr-dialog'
import PersonRelationsTab from './person-relations-tab'
import { SimpleTabs } from './simple-tabs'

// 人员详情:概况/任职/关系/事件 四个 Tab;编辑进入 PersonForm;
// 删除确认后级联移除该人员的任职、关系与事件,完成后回调 onDeleted 清空选中
export default function PersonDetail({
  personId,
  onDeleted,
  onSelectTarget
}: {
  personId: string
  onDeleted?: () => void
  onSelectTarget?: (target: {
    type: 'persons' | 'organizations'
    id: string
  }) => void
}) {
  const { data: person } = useSuspenseQuery(personDetailQueryOptions(personId))
  const [editing, setEditing] = useState(false)
  const [showQr, setShowQr] = useState(false)
  const [eventOpen, setEventOpen] = useState(false)
  const queryClient = useQueryClient()

  const deleteMutation = useMutation({
    mutationFn: deletePerson,
    onSuccess: () => {
      successToast('已删除')
      queryClient.invalidateQueries({ queryKey: ['persons'] })
      onDeleted?.()
    },
    onError: (error) => errorToast('删除失败', error)
  })

  if (editing) {
    return (
      <PersonForm
        key={person.id}
        person={person}
        onCancel={() => setEditing(false)}
        onSaved={() => setEditing(false)}
      />
    )
  }

  if (showQr) {
    return <PersonQrDialog person={person} onClose={() => setShowQr(false)} />
  }

  const expandedOrgName = person.expand?.current_org_id?.name

  return (
    <div className='flex h-full flex-col gap-3 p-2'>
      <div className='flex items-center justify-between'>
        <h1 className='text-xl font-bold'>
          {person.last_name}
          {person.first_name}
        </h1>
        <div className='flex items-center gap-2'>
          <Button
            variant='outline'
            size='sm'
            onClick={() => setEventOpen(true)}>
            <PlusIcon className='size-4' /> 新增事件
          </Button>
          <Button
            variant='outline'
            size='sm'
            onClick={() => {
              // 姓名双空时 buildVCard 返回空串,无法生成二维码
              if (!buildVCard(person)) {
                errorToast('该联系人缺少姓名', '无法生成二维码')
                return
              }
              setShowQr(true)
            }}>
            <QrCodeIcon className='size-4' /> 二维码
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
                  `确定删除「${person.last_name}${person.first_name}」?该人员的关系、任职、事件将一并级联删除,此操作不可撤销。`
                )
              ) {
                deleteMutation.mutate(person.id)
              }
            }}>
            <Trash2Icon className='size-4' /> 删除
          </Button>
        </div>
      </div>

      <SimpleTabs
        tabs={[
          { value: 'overview', label: '概况' },
          { value: 'links', label: '任职' },
          { value: 'relations', label: '关系' },
          { value: 'events', label: '事件' }
        ]}
        defaultValue='overview'>
        {(active) => (
          <>
            {active === 'overview' && (
              <div className='flex flex-col gap-4 lg:flex-row'>
                <div className='min-w-0 flex-1'>
                  <PersonOverview
                    person={person}
                    expandedOrgName={expandedOrgName}
                  />
                </div>
                <aside className='w-full shrink-0 lg:w-[360px]'>
                  <ExperiencePanel
                    personId={personId}
                    onSelectTarget={onSelectTarget}
                  />
                </aside>
              </div>
            )}
            {active === 'links' && <PersonLinksTab personId={personId} />}
            {active === 'relations' && (
              <PersonRelationsTab personId={personId} />
            )}
            {active === 'events' && (
              <PersonEventsTab
                personId={personId}
                onSelectTarget={onSelectTarget}
              />
            )}
          </>
        )}
      </SimpleTabs>
      {/* 头部「新增事件」按钮打开:prefill 当前人 token */}
      <EventFormDialog
        open={eventOpen}
        prefill={{
          kind: 'p',
          id: personId,
          label: `${person.last_name}${person.first_name}`
        }}
        onOpenChange={setEventOpen}
      />
    </div>
  )
}
