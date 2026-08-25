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
import { Check, ChevronsUpDown } from 'lucide-react'
import { useState } from 'react'

// 多选下拉(Popover+Command):复选、可搜索、点击切换不收起。
// 受控 value/onValueChange,不绑 react-hook-form;选项由调用方排序(如拼音序)。
export default function MultiSelect({
  options,
  value,
  onValueChange,
  placeholder = '选择…',
  className
}: {
  options: string[]
  value: string[]
  onValueChange: (v: string[]) => void
  placeholder?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)

  const toggle = (v: string) => {
    onValueChange(
      value.includes(v) ? value.filter((x) => x !== v) : [...value, v]
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type='button'
          variant='outline'
          role='combobox'
          aria-expanded={open}
          className={cn('h-9 w-full justify-between font-normal', className)}>
          <span className='truncate'>
            {value.length ? value.join('、') : placeholder}
          </span>
          <ChevronsUpDown className='ml-auto size-4 shrink-0 opacity-50' />
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-(--radix-popover-trigger-width) p-0'>
        <Command className='bg-transparent'>
          <CommandInput placeholder='搜索…' className='h-9' />
          <CommandList>
            <CommandEmpty>无匹配项</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option}
                  value={option}
                  onSelect={() => toggle(option)}>
                  <Check
                    className={cn(
                      'mr-2',
                      value.includes(option) ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <span>{option}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
