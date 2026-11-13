import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { errorToast, successToast } from '@/lib/toast'
import { buildVCard } from '@/lib/vcard'
import { deletePerson, personDetailQueryOptions } from '@/services/api-persons'
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery
} from '@tanstack/react-query'
import {
  ChevronDownIcon,
  PencilIcon,
  PlusIcon,
  QrCodeIcon,
  Trash2Icon,
  UserPlusIcon
} from 'lucide-react'
import { useState } from 'react'
import EventFormDialog from './event-form-dialog'
import ExperiencePanel from './experience-panel'
import PersonEventsTab from './person-events-tab'
import PersonForm from './person-form'
import PersonOverview from './person-overview'
import PersonQrDialog from './person-qr-dialog'
import PersonRelationsTab from './person-relations-tab'
import RelationFormDialog from './relation-form-dialog'
import { SimpleTabs } from './simple-tabs'

// 人员详情:概况/关系/事件 三个 Tab(任职履历事件化,任职/离职走事件);
// 删除确认后级联移除联系人关系;事件保留(参与方显示"已删除"),完成后回调 onDeleted 清空选中
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
  const [relationOpen, setRelationOpen] = useState(false)
  // 当前页签由详情持有：「查看全部」需要从概况切到关系页签
  const [activeTab, setActiveTab] = useState('overview')
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
        onMerged={(id) => {
          // 合并后当前编辑记录可能已被删除,退出编辑态并切到保留者详情
          setEditing(false)
          onSelectTarget?.({ type: 'persons', id })
        }}
      />
    )
  }

  if (showQr) {
    return <PersonQrDialog person={person} onClose={() => setShowQr(false)} />
  }

  const expandedOrgName = person.expand?.current_org_id?.name

  return (
    <div className='flex h-full flex-col gap-3 p-2'>
      {/* 窄屏放不下时按钮组整体换行,避免挤压姓名标题 */}
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <h1 className='text-xl font-bold'>
          {person.last_name}
          {person.first_name}
        </h1>
        <div className='flex items-center gap-2'>
          {/* 编辑入口收敛为下拉:编辑联系人 / 新增关系 / 新增事件,减少头部并列按钮 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant='outline'
                size='sm'
                className='min-w-32 justify-center'>
                <PencilIcon className='size-4' /> 编辑
                <ChevronDownIcon className='size-3 opacity-60' />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
              <DropdownMenuItem onSelect={() => setEditing(true)}>
                <PencilIcon className='size-4' /> 编辑联系人
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setRelationOpen(true)}>
                <UserPlusIcon className='size-4' /> 新增关系
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setEventOpen(true)}>
                <PlusIcon className='size-4' /> 新增事件
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
          <Button
            variant='destructive'
            size='sm'
            onClick={() => {
              if (
                confirm(
                  `确定删除「${person.last_name}${person.first_name}」?该人员的联系人关系将级联删除;引用该人员的事件将保留(参与方显示为已删除)。此操作不可撤销。`
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
          { value: 'relations', label: '关系' },
          { value: 'events', label: '事件' }
        ]}
        defaultValue='overview'
        value={activeTab}
        onValueChange={setActiveTab}>
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
                    onViewAllRelations={() => setActiveTab('relations')}
                  />
                </aside>
              </div>
            )}
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
      {/* 头部「编辑」下拉打开:编辑联系人 / 新增关系 / 新增事件 */}
      <RelationFormDialog
        open={relationOpen}
        personId={personId}
        onOpenChange={setRelationOpen}
      />
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
