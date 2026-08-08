import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  buildDatasetKey,
  checkKey,
  countChecked,
  SearchScope,
  selectExportedPersons,
  toggleCheck
} from '@/lib/selection'
import { errorToast, successToast } from '@/lib/toast'
import { downloadVCard } from '@/lib/vcard'
import type { Organization } from '@/schemas/organization-schema'
import type { PersonWithOrg } from '@/services/api-persons'
import { DownloadIcon } from 'lucide-react'
import { useState } from 'react'
import { TrustStars } from './trust-stars'

// 行政职务 + 技术职称合并(逗号连接,去空)
function titlesOf(person: PersonWithOrg): string {
  return [person.admin_position, person.tech_title].filter(Boolean).join(',')
}

// 人脉标签 + 社会标签合并(去重,保留顺序)
function tagsOf(person: PersonWithOrg): string[] {
  const tags = [
    ...person.person_tags.split(','),
    ...person.social_tags.split(',')
  ]
    .map((t) => t.trim())
    .filter(Boolean)
  return [...new Set(tags)]
}

interface ResultTableProps {
  persons: PersonWithOrg[]
  orgs: Organization[]
  scope: SearchScope
  viewMode: string
  applied: unknown
  selectedTarget: { type: 'persons' | 'organizations'; id: string } | null
  onSelect(
    target: { type: 'persons' | 'organizations'; id: string } | null
  ): void
  emptyHint: string
}

// 右栏列表态:紧凑表格(人员/组织行 + 复选框)+ 勾选操作条 + 导出
export default function ResultTable({
  persons,
  orgs,
  scope,
  viewMode,
  applied,
  selectedTarget,
  onSelect,
  emptyHint
}: ResultTableProps) {
  const [checked, setChecked] = useState<Set<string>>(new Set())

  // 勾选状态生命周期 = 当前数据集:条件/视图/范围任一变化即清空勾选
  const datasetKey = buildDatasetKey(viewMode, scope, applied)
  const [prevDatasetKey, setPrevDatasetKey] = useState(datasetKey)
  if (prevDatasetKey !== datasetKey) {
    setPrevDatasetKey(datasetKey)
    setChecked(new Set())
  }

  const handleCheck = (
    type: 'persons' | 'organizations',
    id: string,
    c: boolean
  ) => {
    setChecked((prev) => toggleCheck(prev, checkKey(type, id), c))
  }

  // 全选/取消全选当前页(人员 + 组织)
  const visibleKeys: string[] = [
    ...persons.map((p) => checkKey('persons', p.id)),
    ...orgs.map((o) => checkKey('organizations', o.id))
  ]
  const allVisibleChecked =
    visibleKeys.length > 0 && visibleKeys.every((k) => checked.has(k))
  const toggleSelectAll = () => {
    setChecked((prev) => {
      const next = new Set(prev)
      if (allVisibleChecked) visibleKeys.forEach((k) => next.delete(k))
      else visibleKeys.forEach((k) => next.add(k))
      return next
    })
  }

  // 导出勾选的人员(组织跳过并提示;维持 200 人上限防御)
  const handleExport = () => {
    const { exported, skippedOrgs } = selectExportedPersons(checked, persons)
    if (exported.length === 0) {
      errorToast('没有可导出的联系人', '')
      return
    }
    if (exported.length > 200) {
      errorToast('一次最多导出 200 人', '请分批导出')
      return
    }
    if (skippedOrgs > 0) {
      successToast(`已跳过 ${skippedOrgs} 个组织`, 'vCard 仅支持人员')
    }
    downloadVCard(exported)
  }

  const { persons: checkedPersons, organizations: checkedOrgs } =
    countChecked(checked)
  const showPersons = scope === 'all' || scope === 'persons'
  const showOrgs = scope === 'all' || scope === 'organizations'
  // 任一显示区段(人员/组织)为空即视为空,避免 scope 过滤后无提示
  const isEmpty =
    (showPersons ? persons.length === 0 : true) &&
    (showOrgs ? orgs.length === 0 : true)

  return (
    <div className='flex h-full flex-col'>
      {/* 勾选操作条 */}
      <div className='flex items-center gap-2 border-b px-2 py-1'>
        <Button size='sm' variant='outline' onClick={toggleSelectAll}>
          {allVisibleChecked ? '取消全选' : '全选当前页'}
        </Button>
        <span className='text-muted-foreground flex-1 text-xs'>
          已选 {checkedPersons} 人 / {checkedOrgs} 个组织
        </span>
        <Button size='sm' disabled={checked.size === 0} onClick={handleExport}>
          <DownloadIcon className='size-4' /> 导出 vCard
        </Button>
      </div>

      {/* 紧凑表格 */}
      <div className='flex-1 overflow-y-auto'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className='w-8' />
              <TableHead>名称</TableHead>
              <TableHead>单位 / 类型</TableHead>
              <TableHead>标签 / 电话</TableHead>
              <TableHead>联系方式</TableHead>
              <TableHead className='w-24'>评级</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {showPersons &&
              persons.map((person) => (
                <TableRow
                  key={person.id}
                  className='cursor-pointer'
                  data-state={
                    selectedTarget?.type === 'persons' &&
                    selectedTarget.id === person.id
                      ? 'selected'
                      : undefined
                  }
                  onClick={() => onSelect({ type: 'persons', id: person.id })}>
                  <TableCell className='w-8'>
                    <Checkbox
                      checked={checked.has(checkKey('persons', person.id))}
                      aria-label={`选择 ${person.last_name}${person.first_name}`}
                      onCheckedChange={(v) =>
                        handleCheck('persons', person.id, v === true)
                      }
                      onClick={(e) => e.stopPropagation()}
                    />
                  </TableCell>
                  <TableCell className='max-w-[120px] truncate font-medium'>
                    {person.last_name}
                    {person.first_name}
                    {person.nickname && (
                      <span className='text-muted-foreground ml-1 text-xs font-normal'>
                        ({person.nickname})
                      </span>
                    )}
                  </TableCell>
                  <TableCell className='text-muted-foreground max-w-[160px] truncate'>
                    {person.expand?.current_org_id?.name
                      ? `${person.expand.current_org_id.name}${titlesOf(person) ? `(${titlesOf(person)})` : ''}`
                      : titlesOf(person) || '—'}
                  </TableCell>
                  <TableCell className='max-w-[140px] truncate'>
                    {tagsOf(person)
                      .slice(0, 2)
                      .map((tag) => (
                        <Badge
                          key={tag}
                          variant='outline'
                          className='mr-1 text-[10px]'>
                          {tag}
                        </Badge>
                      ))}
                  </TableCell>
                  <TableCell className='text-muted-foreground max-w-[130px] truncate'>
                    {person.mobile || '—'}
                  </TableCell>
                  <TableCell className='w-24'>
                    <TrustStars value={person.trust_level} />
                  </TableCell>
                </TableRow>
              ))}
            {showOrgs &&
              orgs.map((org) => (
                <TableRow
                  key={org.id}
                  className='cursor-pointer'
                  data-state={
                    selectedTarget?.type === 'organizations' &&
                    selectedTarget.id === org.id
                      ? 'selected'
                      : undefined
                  }
                  onClick={() =>
                    onSelect({ type: 'organizations', id: org.id })
                  }>
                  <TableCell className='w-8'>
                    <Checkbox
                      checked={checked.has(checkKey('organizations', org.id))}
                      aria-label={`选择 ${org.name}`}
                      onCheckedChange={(v) =>
                        handleCheck('organizations', org.id, v === true)
                      }
                      onClick={(e) => e.stopPropagation()}
                    />
                  </TableCell>
                  <TableCell className='max-w-[200px] truncate font-medium'>
                    {org.name}
                  </TableCell>
                  <TableCell className='max-w-[100px] truncate'>
                    {org.type && <Badge variant='secondary'>{org.type}</Badge>}
                  </TableCell>
                  <TableCell className='text-muted-foreground max-w-[130px] truncate'>
                    {org.phone || '—'}
                  </TableCell>
                  <TableCell />
                  <TableCell className='w-24'>
                    <TrustStars value={org.importance_level} />
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
        {isEmpty && (
          <p className='text-muted-foreground p-4 text-center text-sm'>
            {emptyHint}
          </p>
        )}
      </div>
    </div>
  )
}
