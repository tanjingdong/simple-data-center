import { PlusIcon } from 'lucide-react'
import * as React from 'react'
import EventForm from '@/components/health/event-form'
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import type { HealthEvent } from '@/schemas/health-event-schema'

// 「插入事件链接」选择器:两种模式——
//  1. 选择模式:搜索已有事件(人/类型/项目/时间),选中后回调插入 [[事件<ID>]];
//  2. 新建模式:嵌入完整 EventForm(与新增事件页面同字段同逻辑,但关闭嵌套的
//     「插入事件链接」避免递归),保存后回调插入——关联由用户在详述中阐述,
//     创建动作不写任何结构化关联。
export default function EventPicker({
  events,
  excludeId,
  open,
  onOpenChange,
  onSelect
}: {
  events: HealthEvent[]
  excludeId?: string
  open: boolean
  onOpenChange: (v: boolean) => void
  onSelect: (id: string) => void
}) {
  const [mode, setMode] = React.useState<'pick' | 'create'>('pick')

  // 关闭时复位到选择模式(在事件处理器中复位,避免 effect 内同步 setState)
  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setMode('pick')
    }
    onOpenChange(v)
  }

  const candidates = events.filter((e) => e.id !== excludeId)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className='sm:max-w-xl'>
        <DialogHeader>
          <DialogTitle>插入事件链接</DialogTitle>
          <div className='flex gap-2'>
            <Button
              type='button'
              variant={mode === 'pick' ? 'default' : 'outline'}
              size='sm'
              onClick={() => setMode('pick')}>
              选择已有事件
            </Button>
            <Button
              type='button'
              variant={mode === 'create' ? 'default' : 'outline'}
              size='sm'
              onClick={() => setMode('create')}>
              <PlusIcon className='size-4' /> 新建关联事件
            </Button>
          </div>
        </DialogHeader>

        {mode === 'pick' ? (
          <Command>
            <CommandInput placeholder='搜索人 / 类型 / 项目 / 结论…' />
            <CommandList>
              <CommandEmpty>无匹配事件</CommandEmpty>
              <CommandGroup>
                {candidates.map((e) => (
                  <CommandItem
                    key={e.id}
                    value={`${e.person} ${e.event_type} ${e.item} ${e.conclusion} ${e.happen_at}`}
                    onSelect={() => {
                      onSelect(e.id)
                      onOpenChange(false)
                    }}>
                    <span className='text-muted-foreground mr-2 whitespace-nowrap'>
                      {e.happen_at}
                    </span>
                    <span className='truncate'>
                      {e.event_type}
                      {e.item ? ` · ${e.item}` : ''}
                      {e.conclusion ? ` · ${e.conclusion}` : ''}
                    </span>
                    <span className='text-muted-foreground ml-auto whitespace-nowrap'>
                      {e.person}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        ) : (
          <div className='max-h-[70vh] overflow-y-auto pr-1'>
            <p className='text-muted-foreground mb-3 text-xs'>
              新建关联事件(保存后自动插入链接到详述光标位置)
            </p>
            <EventForm
              allowInsertLinks={false}
              onSaved={(created) => {
                onSelect(created.id)
                onOpenChange(false)
              }}
              onCancel={() => setMode('pick')}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
