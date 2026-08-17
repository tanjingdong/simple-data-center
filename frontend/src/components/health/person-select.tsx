import { CheckIcon, ChevronsUpDownIcon } from 'lucide-react'
import * as React from 'react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/shadcn'

// 人筛选下拉:从事件历史值中点选(「全部」+ 各人名)
export default function PersonSelect({
  value,
  options,
  onChange
}: {
  value: string
  options: string[]
  onChange: (v: string) => void
}) {
  const [open, setOpen] = React.useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant='outline'
          role='combobox'
          aria-expanded={open}
          className='w-full justify-between font-normal'>
          {value || '全部'}
          <ChevronsUpDownIcon className='size-4 opacity-50' />
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-[220px] p-0' align='start'>
        <Command>
          <CommandInput placeholder='搜索人名…' />
          <CommandList>
            <CommandEmpty>无匹配</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value=''
                onSelect={() => {
                  onChange('')
                  setOpen(false)
                }}>
                <CheckIcon
                  className={cn('mr-2 size-4', value === '' ? 'opacity-100' : 'opacity-0')}
                />
                全部
              </CommandItem>
              {options.map((name) => (
                <CommandItem
                  key={name}
                  value={name}
                  onSelect={() => {
                    onChange(name)
                    setOpen(false)
                  }}>
                  <CheckIcon
                    className={cn('mr-2 size-4', value === name ? 'opacity-100' : 'opacity-0')}
                  />
                  {name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
