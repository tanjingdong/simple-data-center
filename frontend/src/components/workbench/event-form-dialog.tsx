import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { errorToast, successToast } from '@/lib/toast'
import {
  Event,
  EventFormFields,
  eventFormSchema,
  eventTypePresets
} from '@/schemas/event-schema'
import { createEvent, updateEvent } from '@/services/api-events'
import { formatToken, type ParticipantKind } from '@/lib/event-tokens'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import MentionEditor from './mention-editor'

// 事件录入弹窗:日期 + 类型 + @提及纪要编辑器。
// prefill:从人/组织详情页发起时预插一个 token(保便利);event:编辑模式预填。
// submit 只发 happen_at/type/summary(参与方靠 summary 内 token,反查用 summary~)。
export default function EventFormDialog({
  open,
  onOpenChange,
  prefill,
  event
}: {
  open: boolean
  onOpenChange(open: boolean): void
  prefill?: { kind: ParticipantKind; id: string; label: string }
  event?: Event
}) {
  const queryClient = useQueryClient()

  const form = useForm<EventFormFields, any, EventFormFields>({
    resolver: zodResolver(eventFormSchema) as Resolver<EventFormFields>,
    defaultValues: { happen_at: '', type: '', summary: '' }
  })

  // 弹窗打开重置:编辑模式预填;新增模式若有 prefill 则在 summary 预插一个 token
  useEffect(() => {
    if (open) {
      const initialSummary =
        event?.summary ??
        (prefill ? formatToken(prefill.kind, prefill.id, prefill.label) : '')
      form.reset({
        happen_at: event?.happen_at ?? '',
        type: event?.type ?? '',
        summary: initialSummary
      })
    }
  }, [open, form, event, prefill])

  const mutation = useMutation({
    mutationFn: (data: EventFormFields) =>
      event ? updateEvent(event.id, data) : createEvent(data),
    onSuccess: () => {
      successToast(event ? '事件已更新' : '事件已记录')
      // 跨实体失效:summary 含多参与方,任一相关人/组织的事件缓存都需刷新。
      // 用前缀失效覆盖 ['persons', id, 'events'] 与 ['organizations', id, 'events']。
      queryClient.invalidateQueries({ queryKey: ['persons'] })
      queryClient.invalidateQueries({ queryKey: ['organizations'] })
      form.reset({ happen_at: '', type: '', summary: '' })
      onOpenChange(false)
    },
    onError: (error) => errorToast(event ? '保存失败' : '记录事件失败', error)
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{event ? '编辑事件' : '新增事件'}</DialogTitle>
        </DialogHeader>
        <form
          className='flex flex-col gap-3'
          onSubmit={form.handleSubmit((d) => mutation.mutate(d))}>
          <div className='space-y-1'>
            <Label>日期</Label>
            <Input type='date' {...form.register('happen_at')} />
            {form.formState.errors.happen_at && (
              <p className='text-destructive text-xs'>
                {form.formState.errors.happen_at.message}
              </p>
            )}
          </div>
          <div className='space-y-1'>
            <Label>类型</Label>
            <Input
              list='event-type-presets'
              placeholder='如:电话'
              {...form.register('type')}
            />
            <datalist id='event-type-presets'>
              {eventTypePresets.map((type) => (
                <option key={type} value={type} />
              ))}
            </datalist>
          </div>
          <div className='space-y-1'>
            <Label>纪要(用 @ 提及参与对象)</Label>
            <MentionEditor
              value={form.watch('summary')}
              onChange={(v) => form.setValue('summary', v, { shouldValidate: true })}
            />
            {form.formState.errors.summary && (
              <p className='text-destructive text-xs'>
                {form.formState.errors.summary.message}
              </p>
            )}
          </div>
          <div className='flex justify-end gap-2'>
            <Button
              type='button'
              variant='outline'
              onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type='submit' disabled={mutation.isPending}>
              保存
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
