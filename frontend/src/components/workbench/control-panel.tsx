import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import type { SearchScope } from '@/lib/selection'
import type { OrganizationFilters } from '@/services/api-organizations'
import type { PersonFilters, PersonViewMode } from '@/services/api-persons'
import { PlusIcon, SearchIcon, SlidersHorizontalIcon } from 'lucide-react'
import { useState } from 'react'

interface ControlPanelProps {
  scope: SearchScope
  viewMode: PersonViewMode
  queryDraft: string
  personFiltersDraft: PersonFilters
  orgFiltersDraft: OrganizationFilters
  summary: string
  onScopeChange(scope: SearchScope): void
  onViewModeChange(mode: PersonViewMode): void
  onQueryDraftChange(value: string): void
  onPersonFiltersDraftChange(filters: PersonFilters): void
  onOrgFiltersDraftChange(filters: OrganizationFilters): void
  onApplySearch(): void
  onClearFilters(): void
  onAdd(type: 'persons' | 'organizations'): void
}

// 左栏控制区:新增入口、搜索(草稿 + 查询按钮)、高级过滤、视图/类型切换、说明区
export default function ControlPanel({
  scope,
  viewMode,
  queryDraft,
  personFiltersDraft,
  orgFiltersDraft,
  summary,
  onScopeChange,
  onViewModeChange,
  onQueryDraftChange,
  onPersonFiltersDraftChange,
  onOrgFiltersDraftChange,
  onApplySearch,
  onClearFilters,
  onAdd
}: ControlPanelProps) {
  const [showFilters, setShowFilters] = useState(false)

  return (
    <aside className='flex h-full flex-col gap-2 border-r p-2'>
      {/* 新增入口 */}
      <div className='flex gap-2'>
        <Button size='sm' className='flex-1' onClick={() => onAdd('persons')}>
          <PlusIcon className='size-4' /> 新增人员
        </Button>
        <Button
          size='sm'
          variant='outline'
          className='flex-1'
          onClick={() => onAdd('organizations')}>
          <PlusIcon className='size-4' /> 新增组织
        </Button>
      </div>

      {/* 搜索框 + 查询 + 高级过滤 */}
      <div className='flex items-center gap-2'>
        <div className='relative flex-1'>
          <SearchIcon className='text-muted-foreground absolute top-1/2 left-2 size-4 -translate-y-1/2' />
          <Input
            className='pl-8'
            placeholder='搜索姓名、昵称、手机号、组织…'
            value={queryDraft}
            onChange={(e) => onQueryDraftChange(e.target.value)}
            onKeyDown={(e) => {
              // 输入法组合态(如中文选词)下的 Enter 不触发查询
              if (e.nativeEvent.isComposing) return
              if (e.key === 'Enter') onApplySearch()
            }}
          />
        </div>
        <Button size='sm' onClick={onApplySearch}>
          查询
        </Button>
        <Button
          variant='outline'
          size='icon'
          aria-label='高级过滤'
          onClick={() => setShowFilters((v) => !v)}>
          <SlidersHorizontalIcon className='size-4' />
        </Button>
      </div>

      {/* 类型切换 */}
      <Select
        value={scope}
        onValueChange={(v) => onScopeChange(v as SearchScope)}>
        <SelectTrigger className='h-8 text-xs'>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value='all'>全部</SelectItem>
          <SelectItem value='persons'>人员</SelectItem>
          <SelectItem value='organizations'>组织</SelectItem>
        </SelectContent>
      </Select>

      {/* 检索视图:全部 / 最近更新 */}
      <div className='flex gap-1'>
        <Button
          size='sm'
          variant={viewMode === 'all' ? 'secondary' : 'outline'}
          className='flex-1'
          onClick={() => onViewModeChange('all')}>
          全部
        </Button>
        <Button
          size='sm'
          variant={viewMode === 'recent' ? 'secondary' : 'outline'}
          className='flex-1'
          onClick={() => onViewModeChange('recent')}>
          最近更新
        </Button>
      </div>

      {/* 高级过滤(可折叠) */}
      {showFilters && (
        <div className='flex flex-col gap-2 rounded-md border p-2 text-xs'>
          {(scope === 'all' || scope === 'persons') && (
            <>
              <Input
                placeholder='人脉标签,如 核心圈'
                value={personFiltersDraft.personTags}
                onChange={(e) =>
                  onPersonFiltersDraftChange({
                    ...personFiltersDraft,
                    personTags: e.target.value
                  })
                }
              />
              <Input
                placeholder='社会标签,如 医疗'
                value={personFiltersDraft.socialTags}
                onChange={(e) =>
                  onPersonFiltersDraftChange({
                    ...personFiltersDraft,
                    socialTags: e.target.value
                  })
                }
              />
              <Input
                placeholder='籍贯,如 湖南'
                value={personFiltersDraft.nativePlace}
                onChange={(e) =>
                  onPersonFiltersDraftChange({
                    ...personFiltersDraft,
                    nativePlace: e.target.value
                  })
                }
              />
              <Input
                placeholder='毕业学校'
                value={personFiltersDraft.graduateSchool}
                onChange={(e) =>
                  onPersonFiltersDraftChange({
                    ...personFiltersDraft,
                    graduateSchool: e.target.value
                  })
                }
              />
              <Select
                value={personFiltersDraft.trustLevel}
                onValueChange={(v) =>
                  onPersonFiltersDraftChange({
                    ...personFiltersDraft,
                    trustLevel: v
                  })
                }>
                <SelectTrigger className='h-8'>
                  <SelectValue placeholder='信任评级(不限)' />
                </SelectTrigger>
                <SelectContent>
                  {['1', '2', '3', '4', '5'].map((v) => (
                    <SelectItem key={v} value={v}>
                      {v} 星
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
          {(scope === 'all' || scope === 'organizations') && (
            <Input
              placeholder='组织类型,如 医疗机构'
              value={orgFiltersDraft.type}
              onChange={(e) =>
                onOrgFiltersDraftChange({
                  ...orgFiltersDraft,
                  type: e.target.value
                })
              }
            />
          )}
          <Button variant='ghost' size='sm' onClick={onClearFilters}>
            清除过滤
          </Button>
        </div>
      )}

      {/* 说明区 */}
      <div className='text-muted-foreground mt-auto border-t pt-2 text-xs'>
        {summary}
      </div>
    </aside>
  )
}
