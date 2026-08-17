import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { Controller, useForm, type Resolver } from 'react-hook-form'
import { useRef, useState } from 'react'
import EventPicker from '@/components/health/event-picker'
import ReceiptUpload from '@/components/health/receipt-upload'
import AutoCompleteField from '@/components/form/autocomplete-field'
import InputField from '@/components/form/input-field'
import { dateToString } from '@/lib/date-convert'
import { errorToast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  healthEventFormSchema,
  HealthEventFormFields,
  HealthEvent,
  healthEventTypePresets
} from '@/schemas/health-event-schema'
import {
  createHealthEvent,
  departmentOptionsOf,
  healthEventsQueryOptions,
  personOptionsOf,
  updateHealthEvent
} from '@/services/api-health-events'

// 完整事件表单(新建/编辑共用)。页面与「插入事件链接」选择器内的新建模式
// 均嵌入本组件——两次新增流程的字段与逻辑完全一致。
// 关联完全由用户在详述中通过「插入事件链接」阐述,表单本身不建立任何结构化关联。
export default function EventForm({
  editingEvent,
  allowInsertLinks = true,
  onSaved,
  onCancel
}: {
  /** 编辑模式下的目标事件;缺省为新建 */
  editingEvent?: HealthEvent
  /** 是否显示详述区的「插入事件链接」;嵌套于选择器内时关闭,避免递归 */
  allowInsertLinks?: boolean
  /** 保存成功回调(页面跳转详情 / 选择器插入链接并关闭) */
  onSaved: (event: HealthEvent) => void
  /** 取消按钮回调(页面返回 / 选择器返回选择模式) */
  onCancel: () => void
}) {
  const queryClient = useQueryClient()
  const editing = Boolean(editingEvent)

  const eventsQuery = useSuspenseQuery(healthEventsQueryOptions(''))
  const allEvents = eventsQuery.data

  // schema 带 default('') 的字段使 zod 输入类型为可选,与 RHF 期望的字段类型不完全一致,
  // 故按输出类型(即 HealthEventFormFields)断言 resolver;同时显式声明转换值类型避免泛型别名未解析
  const form = useForm<HealthEventFormFields, any, HealthEventFormFields>({
    resolver: zodResolver(healthEventFormSchema) as Resolver<HealthEventFormFields>,
    defaultValues: editingEvent
      ? {
          person: editingEvent.person,
          happen_at: editingEvent.happen_at,
          event_type: editingEvent.event_type,
          item: editingEvent.item,
          department: editingEvent.department,
          institution: editingEvent.institution,
          doctor: editingEvent.doctor,
          conclusion: editingEvent.conclusion,
          detail: editingEvent.detail
        }
      : {
          person: '',
          // 默认取本地时区的今天(toISOString 是 UTC,跨时区会偏差一天)
          happen_at: dateToString(),
          event_type: '',
          item: '',
          department: '',
          institution: '',
          doctor: '',
          conclusion: '',
          detail: ''
        }
  })

  // 凭证状态:既有文件名 + 新增文件
  const [existingReceipts, setExistingReceipts] = useState<string[]>(editingEvent?.receipt ?? [])
  const [newFiles, setNewFiles] = useState<File[]>([])

  // 插入事件链接(光标位置插入)
  const detailRef = useRef<HTMLTextAreaElement>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const insertLink = (id: string) => {
    const current = form.getValues('detail')
    const el = detailRef.current
    const pos = el?.selectionStart ?? current.length
    form.setValue('detail', current.slice(0, pos) + `[[事件${id}]]` + current.slice(pos), {
      shouldValidate: true
    })
    setPickerOpen(false)
    // 链接全长 = 4(「[[事件」前缀) + id.length + 2(「]]」后缀),光标定位在链接末尾
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(pos + 6 + id.length, pos + 6 + id.length)
    })
  }

  const saveMutation = useMutation({
    mutationFn: async (values: HealthEventFormFields) => {
      if (editing && editingEvent) {
        return updateHealthEvent(editingEvent.id, values, existingReceipts, newFiles)
      }
      return createHealthEvent(values, newFiles)
    },
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ['health_events'] })
      onSaved(saved)
    },
    onError: (e) => errorToast('保存失败', e)
  })

  return (
    <>
      {/* 必须用 shadcn 的 Form(= FormProvider)包裹:FormItem 系组件经
          useFormContext 取字段状态,缺失会导致表单渲染崩溃 */}
      <Form {...form}>
        <form
          className='space-y-4'
          onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}>
          <AutoCompleteField form={form} name='person' label='人' options={personOptionsOf(allEvents)} />
          <InputField form={form} name='happen_at' label='时间' type='date' />
          <AutoCompleteField form={form} name='event_type' label='类型' options={[...healthEventTypePresets]} />
          <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
            <InputField form={form} name='item' label='项目' />
            <AutoCompleteField form={form} name='department' label='科属' options={departmentOptionsOf(allEvents)} />
            <InputField form={form} name='institution' label='机构' />
            <InputField form={form} name='doctor' label='接诊医师' />
          </div>
          <InputField form={form} name='conclusion' label='结论' />

          <div className='space-y-2'>
            <div className='flex items-center justify-between'>
              <Label>详述</Label>
              {allowInsertLinks && (
                <Button type='button' variant='outline' size='sm' onClick={() => setPickerOpen(true)}>
                  插入事件链接
                </Button>
              )}
            </div>
            <Controller
              control={form.control}
              name='detail'
              render={({ field }) => (
                <Textarea
                  {...field}
                  ref={(el) => {
                    field.ref(el)
                    detailRef.current = el
                  }}
                  rows={8}
                  placeholder='记录完整经过、主观判断、处置措施…可用「插入事件链接」引用其他事件'
                />
              )}
            />
          </div>

          <div className='space-y-2'>
            <Label>原始凭证</Label>
            <ReceiptUpload
              eventId={editingEvent?.id}
              existing={existingReceipts}
              files={newFiles}
              onExistingChange={setExistingReceipts}
              onFilesChange={setNewFiles}
            />
          </div>

          <div className='flex justify-end gap-2'>
            <Button type='button' variant='outline' onClick={onCancel}>
              取消
            </Button>
            <Button type='submit' disabled={saveMutation.isPending}>
              {saveMutation.isPending ? '保存中…' : '保存'}
            </Button>
          </div>
        </form>
      </Form>

      {allowInsertLinks && (
        <EventPicker
          events={allEvents}
          excludeId={editingEvent?.id}
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          onSelect={insertLink}
        />
      )}
    </>
  )
}
