import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { ChatButton } from '@/components/workbench/chat-drawer'
import ControlPanel from '@/components/workbench/control-panel'
import OrganizationDetail from '@/components/workbench/organization-detail'
import OrganizationForm from '@/components/workbench/organization-form'
import PersonDetail from '@/components/workbench/person-detail'
import PersonForm from '@/components/workbench/person-form'
import ResultTable from '@/components/workbench/result-table'
import type { SearchScope } from '@/lib/selection'
import {
  emptyOrganizationFilters,
  organizationDetailQueryOptions,
  OrganizationFilters,
  organizationsQueryOptions
} from '@/services/api-organizations'
import {
  emptyPersonFilters,
  personDetailQueryOptions,
  PersonFilters,
  personsQueryOptions,
  PersonViewMode
} from '@/services/api-persons'
import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { ChevronLeftIcon, SearchIcon } from 'lucide-react'
import { useState } from 'react'

export type WorkbenchTarget = {
  type: 'persons' | 'organizations'
  id: string
} | null

// 右侧新建模式(打开对应空表单)
type CreatingMode = 'persons' | 'organizations' | null

// 已应用的检索条件(点【查询】后冻结)
interface AppliedSearch {
  query: string
  personFilters: PersonFilters
  orgFilters: OrganizationFilters
}

export default function WorkbenchPage() {
  const [target, setTarget] = useState<WorkbenchTarget>(null)
  const [creating, setCreating] = useState<CreatingMode>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // 检索状态(草稿 + 已应用)
  const [scope, setScope] = useState<SearchScope>('all')
  const [viewMode, setViewMode] = useState<PersonViewMode>('all')
  const [queryDraft, setQueryDraft] = useState('')
  const [personFiltersDraft, setPersonFiltersDraft] =
    useState<PersonFilters>(emptyPersonFilters)
  const [orgFiltersDraft, setOrgFiltersDraft] = useState<OrganizationFilters>(
    emptyOrganizationFilters
  )
  const [applied, setApplied] = useState<AppliedSearch>({
    query: '',
    personFilters: emptyPersonFilters,
    orgFilters: emptyOrganizationFilters
  })

  // 查询列表(始终查询,按 scope 过滤渲染)
  const personsQuery = useSuspenseQuery(
    personsQueryOptions(
      { ...applied.personFilters, query: applied.query },
      viewMode
    )
  )
  const orgsQuery = useSuspenseQuery(
    organizationsQueryOptions({ ...applied.orgFilters, query: applied.query })
  )

  // 详情态说明区对象名(与详情组件共享查询缓存,无额外网络开销)
  const targetPerson = useQuery({
    ...personDetailQueryOptions(target?.type === 'persons' ? target.id : ''),
    enabled: target?.type === 'persons'
  })
  const targetOrg = useQuery({
    ...organizationDetailQueryOptions(
      target?.type === 'organizations' ? target.id : ''
    ),
    enabled: target?.type === 'organizations'
  })

  // 说明区文案
  const targetName =
    (targetPerson.data?.last_name || '') +
      (targetPerson.data?.first_name || '') ||
    targetOrg.data?.name ||
    ''
  const summary = creating
    ? creating === 'persons'
      ? '新增人员'
      : '新增组织'
    : target
      ? targetName
        ? `【${targetName}】- 详情`
        : '加载中…'
      : `共 ${personsQuery.data.length} 人 / ${orgsQuery.data.length} 个组织`

  // 默认检索判断(全部视图 + 空条件 = 未检索):空态文案区分
  const isDefaultSearch =
    viewMode === 'all' &&
    applied.query === '' &&
    applied.personFilters.personTags === '' &&
    applied.personFilters.socialTags === '' &&
    applied.personFilters.nativePlace === '' &&
    applied.personFilters.graduateSchool === '' &&
    applied.personFilters.trustLevel === '' &&
    applied.orgFilters.type === ''
  const emptyHint = isDefaultSearch ? '暂无联系人' : '没有匹配的结果'

  const closeCreating = () => setCreating(null)
  const clearTarget = () => setTarget(null)
  const handleSelect = (t: WorkbenchTarget) => {
    setTarget(t)
    setCreating(null)
    setMobileMenuOpen(false)
  }
  const handleAdd = (type: 'persons' | 'organizations') => {
    setTarget(null)
    setCreating(type)
    setMobileMenuOpen(false)
  }

  const controlPanel = (
    <ControlPanel
      scope={scope}
      viewMode={viewMode}
      queryDraft={queryDraft}
      personFiltersDraft={personFiltersDraft}
      orgFiltersDraft={orgFiltersDraft}
      summary={summary}
      onScopeChange={(s) => {
        setScope(s)
        // 检索切换回到列表态(详情/表单态下切换也应可见列表变化)
        setTarget(null)
        setCreating(null)
      }}
      onViewModeChange={(m) => {
        setViewMode(m)
        setTarget(null)
        setCreating(null)
      }}
      onQueryDraftChange={setQueryDraft}
      onPersonFiltersDraftChange={setPersonFiltersDraft}
      onOrgFiltersDraftChange={setOrgFiltersDraft}
      onApplySearch={() => {
        setApplied({
          query: queryDraft,
          personFilters: personFiltersDraft,
          orgFilters: orgFiltersDraft
        })
        setMobileMenuOpen(false)
      }}
      onClearFilters={() => {
        setQueryDraft('')
        setPersonFiltersDraft(emptyPersonFilters)
        setOrgFiltersDraft(emptyOrganizationFilters)
        setApplied({
          query: '',
          personFilters: emptyPersonFilters,
          orgFilters: emptyOrganizationFilters
        })
        setMobileMenuOpen(false)
      }}
      onAdd={handleAdd}
    />
  )

  // 右栏内容:列表态常驻挂载(隐藏而非卸载),详情/表单态条件渲染
  const detailOrForm = creating ? (
    creating === 'persons' ? (
      <PersonForm onCancel={closeCreating} onSaved={closeCreating} />
    ) : (
      <OrganizationForm onCancel={closeCreating} onSaved={closeCreating} />
    )
  ) : target?.type === 'persons' ? (
    <PersonDetail
      personId={target.id}
      onDeleted={clearTarget}
      onSelectTarget={handleSelect}
    />
  ) : target?.type === 'organizations' ? (
    <OrganizationDetail
      orgId={target.id}
      onDeleted={clearTarget}
      onSelectTarget={handleSelect}
    />
  ) : null

  return (
    <main className='flex min-h-[calc(100dvh-8rem)] flex-col gap-4 md:flex-row'>
      {/* 窄屏:菜单按钮 + 抽屉 */}
      <div className='md:hidden'>
        <Button
          variant='outline'
          className='w-full'
          onClick={() => setMobileMenuOpen(true)}>
          <SearchIcon className='size-4' /> 搜索 / 菜单
        </Button>
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetContent side='left' className='w-[320px] p-0'>
            {controlPanel}
          </SheetContent>
        </Sheet>
      </div>

      {/* 宽屏:常驻左栏控制区 */}
      <div className='hidden w-[300px] shrink-0 md:block'>{controlPanel}</div>

      {/* 右栏:分时使用 */}
      <section className='flex min-w-0 flex-1 flex-col overflow-y-auto'>
        {/* 详情/表单态返回条 */}
        {detailOrForm && (
          <div className='flex items-center gap-1 border-b px-2 py-1'>
            <Button
              variant='ghost'
              size='sm'
              onClick={() => {
                setCreating(null)
                setTarget(null)
              }}>
              <ChevronLeftIcon className='size-4' /> 返回列表
            </Button>
          </div>
        )}
        <div className={detailOrForm ? 'hidden flex-1' : 'min-h-0 flex-1'}>
          <ResultTable
            persons={personsQuery.data}
            orgs={orgsQuery.data}
            scope={scope}
            viewMode={viewMode}
            applied={applied}
            selectedTarget={target}
            emptyHint={emptyHint}
            onSelect={handleSelect}
          />
        </div>
        {detailOrForm && <div className='min-h-0 flex-1'>{detailOrForm}</div>}
      </section>
      <ChatButton target={target} />
    </main>
  )
}
