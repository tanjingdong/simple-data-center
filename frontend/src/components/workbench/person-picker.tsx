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
import { emptyPersonFilters, personsQueryOptions } from '@/services/api-persons'
import { useQuery } from '@tanstack/react-query'
import { CheckIcon, ChevronsUpDownIcon } from 'lucide-react'
import { useState } from 'react'

// 搜索选择一个人(关系表单复用);excludeId 排除自己
export default function PersonPicker({
  value,
  onChange,
  excludeId
}: {
  value: string
  onChange(id: string): void
  excludeId?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const { data: persons } = useQuery(
    personsQueryOptions({ ...emptyPersonFilters, query })
  )

  const selected = persons?.find((p) => p.id === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant='outline'
          role='combobox'
          className='w-full justify-between'>
          {selected
            ? `${selected.last_name}${selected.first_name}`
            : '选择人员…'}
          <ChevronsUpDownIcon className='size-4 opacity-50' />
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-72 p-0'>
        <Command shouldFilter={false}>
          <CommandInput
            placeholder='搜索姓名…'
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>无匹配人员</CommandEmpty>
            <CommandGroup>
              {persons
                ?.filter((p) => p.id !== excludeId)
                .map((p) => (
                  <CommandItem
                    key={p.id}
                    value={p.id}
                    onSelect={() => {
                      onChange(p.id)
                      setOpen(false)
                    }}>
                    <CheckIcon
                      className={cn(
                        'mr-2 size-4',
                        value === p.id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    {p.last_name}
                    {p.first_name}
                    {p.nickname && (
                      <span className='text-muted-foreground ml-1 text-xs'>
                        ({p.nickname})
                      </span>
                    )}
                  </CommandItem>
                ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
