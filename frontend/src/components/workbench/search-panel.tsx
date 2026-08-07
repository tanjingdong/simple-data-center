import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { useDebounce } from '@/hooks/use-debounce'
import {
  emptyOrganizationFilters,
  OrganizationFilters,
  organizationsQueryOptions
} from '@/services/api-organizations'
import {
  emptyPersonFilters,
  PersonFilters,
  personsQueryOptions
} from '@/services/api-persons'
import { useSuspenseQuery } from '@tanstack/react-query'
import { PlusIcon, SearchIcon, SlidersHorizontalIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { OrgTargetCard, PersonTargetCard } from './target-card'

export type SearchScope = 'all' | 'persons' | 'organizations'

interface SearchPanelProps {
  selectedTarget: { type: 'persons' | 'organizations'; id: string } | null
  onSelect(
    target: { type: 'persons' | 'organizations'; id: string } | null
  ): void
  // 新增人员/组织入口(右侧切换为新建表单)
  onAdd(type: 'persons' | 'organizations'): void
}

export default function SearchPanel({
  selectedTarget,
  onSelect,
  onAdd
}: SearchPanelProps) {
  const [scope, setScope] = useState<SearchScope>('all')
  const [query, setQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  // 人员高级过滤状态
  const [personFilters, setPersonFilters] =
    useState<PersonFilters>(emptyPersonFilters)
  // 组织高级过滤状态
  const [orgFilters, setOrgFilters] = useState<OrganizationFilters>(
    emptyOrganizationFilters
  )

  const debouncedQuery = useDebounce(query, 300)

  // 合并查询词到过滤器
  const mergedPersonFilters = useMemo<PersonFilters>(
    () => ({ ...personFilters, query: debouncedQuery }),
    [personFilters, debouncedQuery]
  )
  const mergedOrgFilters = useMemo<OrganizationFilters>(
    () => ({ ...orgFilters, query: debouncedQuery }),
    [orgFilters, debouncedQuery]
  )

  // 始终查询(记录量小),按 scope 过滤渲染;
  // 注意:不用 enabled 控制 useSuspenseQuery(禁用会永久挂起)
  const personsQuery = useSuspenseQuery(
    personsQueryOptions(mergedPersonFilters)
  )
  const orgsQuery = useSuspenseQuery(
    organizationsQueryOptions(mergedOrgFilters)
  )

  const showPersons = scope === 'all' || scope === 'persons'
  const showOrgs = scope === 'all' || scope === 'organizations'

  return (
    <aside className='flex h-full flex-col gap-2 border-r p-2'>
      {/* 新增入口 */}
      <div className='flex gap-2'>
        <Button
          size='sm'
          className='flex-1'
          onClick={() => onAdd('persons')}>
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

      {/* 搜索框与类型切换 */}
      <div className='flex items-center gap-2'>
        <div className='relative flex-1'>
          <SearchIcon className='text-muted-foreground absolute top-1/2 left-2 size-4 -translate-y-1/2' />
          <Input
            className='pl-8'
            placeholder='搜索姓名、昵称、手机号、组织…'
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Button
          variant='outline'
          size='icon'
          aria-label='高级过滤'
          onClick={() => setShowFilters((v) => !v)}>
          <SlidersHorizontalIcon className='size-4' />
        </Button>
      </div>

      {/* 类型切换 */}
      <Select value={scope} onValueChange={(v) => setScope(v as SearchScope)}>
        <SelectTrigger className='h-8 text-xs'>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value='all'>全部</SelectItem>
          <SelectItem value='persons'>人员</SelectItem>
          <SelectItem value='organizations'>组织</SelectItem>
        </SelectContent>
      </Select>

      {/* 高级过滤(可折叠) */}
      {showFilters && (
        <div className='flex flex-col gap-2 rounded-md border p-2 text-xs'>
          {/* 人员过滤 */}
          {showPersons && (
            <>
              <Input
                placeholder='人脉标签,如 核心圈'
                value={personFilters.personTags}
                onChange={(e) =>
                  setPersonFilters((f) => ({
                    ...f,
                    personTags: e.target.value
                  }))
                }
              />
              <Input
                placeholder='社会标签,如 医疗'
                value={personFilters.socialTags}
                onChange={(e) =>
                  setPersonFilters((f) => ({
                    ...f,
                    socialTags: e.target.value
                  }))
                }
              />
              <Input
                placeholder='籍贯,如 湖南'
                value={personFilters.nativePlace}
                onChange={(e) =>
                  setPersonFilters((f) => ({
                    ...f,
                    nativePlace: e.target.value
                  }))
                }
              />
              <Input
                placeholder='毕业学校'
                value={personFilters.graduateSchool}
                onChange={(e) =>
                  setPersonFilters((f) => ({
                    ...f,
                    graduateSchool: e.target.value
                  }))
                }
              />
              <Select
                value={personFilters.trustLevel}
                onValueChange={(v) =>
                  setPersonFilters((f) => ({ ...f, trustLevel: v }))
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
          {/* 组织过滤 */}
          {showOrgs && (
            <Input
              placeholder='组织类型,如 医疗机构'
              value={orgFilters.type}
              onChange={(e) =>
                setOrgFilters((f) => ({ ...f, type: e.target.value }))
              }
            />
          )}
          <Button
            variant='ghost'
            size='sm'
            onClick={() => {
              setPersonFilters(emptyPersonFilters)
              setOrgFilters(emptyOrganizationFilters)
            }}>
            清除过滤
          </Button>
        </div>
      )}

      {/* 结果列表 */}
      <div className='flex-1 space-y-1 overflow-y-auto scroll-smooth'>
        {showPersons &&
          personsQuery.data.map((person) => (
            <PersonTargetCard
              key={person.id}
              person={person}
              expandedOrgName={person.expand?.current_org_id?.name}
              selected={
                selectedTarget?.type === 'persons' &&
                selectedTarget.id === person.id
              }
              onClick={() => onSelect({ type: 'persons', id: person.id })}
            />
          ))}
        {showOrgs &&
          orgsQuery.data.map((org) => (
            <OrgTargetCard
              key={org.id}
              org={org}
              selected={
                selectedTarget?.type === 'organizations' &&
                selectedTarget.id === org.id
              }
              onClick={() => onSelect({ type: 'organizations', id: org.id })}
            />
          ))}
        {personsQuery.data.length === 0 && orgsQuery.data.length === 0 && (
          <p className='text-muted-foreground p-4 text-center text-sm'>
            没有匹配的结果
          </p>
        )}
      </div>
    </aside>
  )
}
