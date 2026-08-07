import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover'
import { cn } from '@/lib/shadcn'
import {
  createOrganization,
  emptyOrganizationFilters,
  organizationsQueryOptions
} from '@/services/api-organizations'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckIcon, ChevronsUpDownIcon, PlusIcon } from 'lucide-react'
import { useState } from 'react'

// 搜索选择一个组织(人员表单「当前单位」/事件表单「关联组织」复用)
export default function OrgPicker({
  value,
  onChange
}: {
  value: string
  onChange(id: string): void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const queryClient = useQueryClient()
  const { data: orgs } = useQuery(
    organizationsQueryOptions({ ...emptyOrganizationFilters, query })
  )

  const selected = orgs?.find((o) => o.id === value)
  // 查询词非空且结果中无同名组织时,允许直接新建
  const trimmedQuery = query.trim()
  const canCreate =
    trimmedQuery !== '' && !orgs?.some((o) => o.name === trimmedQuery)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant='outline'
          role='combobox'
          className='w-full justify-between'>
          {selected ? selected.name : '选择组织…'}
          <ChevronsUpDownIcon className='size-4 opacity-50' />
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-72 p-0'>
        <Command shouldFilter={false}>
          <CommandInput
            placeholder='搜索组织…'
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>无匹配组织</CommandEmpty>
            <CommandGroup>
              {orgs?.map((o) => (
                <CommandItem
                  key={o.id}
                  value={o.id}
                  onSelect={() => {
                    onChange(o.id)
                    setOpen(false)
                  }}>
                  <CheckIcon
                    className={cn(
                      'mr-2 size-4',
                      value === o.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {o.name}
                </CommandItem>
              ))}
            </CommandGroup>
            {canCreate && (
              <CommandItem
                value={`__create__${trimmedQuery}`}
                onSelect={async () => {
                  const created = await createOrganization({
                    name: trimmedQuery,
                    type: '',
                    importance_level: 3,
                    phone: '',
                    email: '',
                    map: '',
                    address: '',
                    notes: ''
                  })
                  queryClient.invalidateQueries({
                    queryKey: ['organizations', 'list']
                  })
                  onChange(created.id)
                  setOpen(false)
                }}>
                <PlusIcon className='mr-2 size-4' />
                新建组织「{trimmedQuery}」
              </CommandItem>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
