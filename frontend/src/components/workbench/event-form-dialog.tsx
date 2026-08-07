import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { errorToast, successToast } from '@/lib/toast'
import {
  Event,
  EventFormFields,
  eventFormSchema,
  eventTypePresets
} from '@/schemas/event-schema'
import { createEvent, updateEvent } from '@/services/api-events'
import { organizationDetailQueryOptions } from '@/services/api-organizations'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import OrgPicker from './org-picker'
import PersonPicker from './person-picker'

// 事件录入弹窗,双上下文:
//  - personId 模式(人员详情页发起):人员固定,关联组织用 OrgPicker 可选
//  - orgId 模式(组织详情页发起):组织固定(顶部只读展示),人员用 PersonPicker 必选
//  - personId 优先;两者都未提供时按 org 分支处理(现有调用方恒只传一个上下文)
// 日期用浏览器 date 输入(输出 yyyy-MM-dd);类型开放值(预设 6 项建议 + 自定义),纪要必填
// event 存在时为编辑模式(预填日期/类型/组织/纪要;人员模式人员固定,org 模式人员可改派),否则为新增模式
export default function EventFormDialog({
  open,
  onOpenChange,
  personId,
  orgId,
  event
}: {
  open: boolean
  onOpenChange(open: boolean): void
  personId?: string
  orgId?: string
  event?: Event
}) {
  const queryClient = useQueryClient()
  // 模式判定:personId 提供即为人员模式(都未提供时走 org 分支)
  const isPersonMode = personId !== undefined
  // orgId 模式选中的事件主体人员(独立 state 管理,未选时禁止提交)
  const [selectedPersonId, setSelectedPersonId] = useState('')
  // orgId 模式需组织名做只读展示(useQuery 非 Suspense;人员模式 enabled=false 不发请求)
  const { data: org } = useQuery({
    ...organizationDetailQueryOptions(orgId ?? ''),
    enabled: !isPersonMode
  })

  // schema 中 org_id/type 带 default('') 使 zod 输入类型为可选,与 RHF 期望的字段类型不一致,
  // 故按输出类型(即 EventFormFields)断言 resolver;同时显式声明转换值类型避免泛型别名未解析
  const form = useForm<EventFormFields, any, EventFormFields>({
    resolver: zodResolver(eventFormSchema) as Resolver<EventFormFields>,
    defaultValues: { happen_at: '', type: '', org_id: '', summary: '' }
  })

  // 弹窗每次打开都重置表单与人员选择,避免上次未保存内容残留;
  // 编辑模式以 event 为初始值(org 模式同时预填事件主体人员),新增模式清空
  useEffect(() => {
    if (open) {
      form.reset({
        happen_at: event?.happen_at ?? '',
        type: event?.type ?? '',
        org_id: event?.org_id ?? '',
        summary: event?.summary ?? ''
      })
      setSelectedPersonId(event?.person_id ?? '')
    }
  }, [open, form, event])

  const mutation = useMutation({
    mutationFn: (data: EventFormFields) =>
      event
        ? // 编辑:人员模式人员固定为当前 personId;org 模式取下拉选择值(编辑时已预填原人员,可改派);
          // org_id 取表单值(org 模式编辑时表单预填了原 org_id,保持组织固定)
          updateEvent(event.id, {
            person_id: isPersonMode ? personId! : selectedPersonId,
            ...data,
            org_id: data.org_id || ''
          })
        : isPersonMode
          ? createEvent({ person_id: personId!, ...data })
          : // orgId 模式:人员取下拉选择值;org_id 置于末尾覆盖表单中的关联组织字段,保证组织固定
            createEvent({
              person_id: selectedPersonId,
              ...data,
              org_id: orgId!
            }),
    onSuccess: (_data, variables) => {
      successToast(event ? '事件已更新' : '事件已记录')
      if (isPersonMode) {
        queryClient.invalidateQueries({
          queryKey: ['persons', personId!, 'events']
        })
      } else {
        queryClient.invalidateQueries({
          queryKey: ['organizations', orgId!, 'events']
        })
        // org 模式编辑时人员改派:新人员的个人事件缓存一并失效
        if (event && selectedPersonId !== event.person_id) {
          queryClient.invalidateQueries({
            queryKey: ['persons', selectedPersonId, 'events']
          })
        }
      }
      if (variables.org_id) {
        queryClient.invalidateQueries({
          queryKey: ['organizations', variables.org_id, 'events']
        })
      }
      // 跨实体失效:组织侧列表/详情可能展示事件信息
      queryClient.invalidateQueries({ queryKey: ['organizations'] })
      form.reset({ happen_at: '', type: '', org_id: '', summary: '' })
      setSelectedPersonId('')
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
          {!isPersonMode && (
            <div className='space-y-1'>
              <Label>关联组织</Label>
              {/* 组织固定:只读展示,查询未返回时回退显示 #id */}
              <p className='bg-muted border-input rounded-md border px-3 py-2 text-sm'>
                {org?.name ?? `组织 #${orgId}`}
              </p>
            </div>
          )}
          {!isPersonMode && (
            <div className='space-y-1'>
              <Label>人员</Label>
              <PersonPicker
                value={selectedPersonId}
                onChange={setSelectedPersonId}
              />
              {!selectedPersonId && (
                <p className='text-muted-foreground text-xs'>
                  请选择事件关联的人员
                </p>
              )}
            </div>
          )}
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
          {isPersonMode && (
            <div className='space-y-1'>
              <Label>关联组织</Label>
              <OrgPicker
                value={form.watch('org_id')}
                onChange={(id) => form.setValue('org_id', id)}
              />
            </div>
          )}
          <div className='space-y-1'>
            <Label>纪要</Label>
            <Textarea
              rows={3}
              placeholder='事件纪要(必填)'
              {...form.register('summary')}
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
            <Button
              type='submit'
              disabled={
                mutation.isPending || (!isPersonMode && !selectedPersonId)
              }>
              保存
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
