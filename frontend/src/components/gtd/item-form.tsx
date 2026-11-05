import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  gtdConditionLabels,
  gtdConditions,
  gtdStatuses,
  gtdStatusLabels,
  gtdTypeLabels,
  gtdTypes,
  type GtdItem,
  type GtdItemFormFields,
  type GtdStatus,
  type GtdType
} from '@/schemas/gtd-item-schema'
import {
  assigneeNames,
  normalizeCondition,
  todayStr
} from '@/services/api-gtd-items'

/** 空表单;可用 overrides 预填(如按分区预设类型) */
export function emptyGtdItemForm(
  overrides: Partial<GtdItemFormFields> = {}
): GtdItemFormFields {
  return {
    thing: '',
    note: '',
    type: 'todo',
    schedule_on: todayStr(),
    hard_time: '',
    condition: '',
    assignee: [],
    status: 'active',
    ...overrides
  }
}

/** 把已有记录转成表单值 */
export function toFormFields(item: GtdItem): GtdItemFormFields {
  return {
    thing: item.thing,
    note: item.note,
    type: item.type,
    schedule_on: item.schedule_on,
    hard_time: item.hard_time,
    condition: normalizeCondition(item.condition),
    assignee: assigneeNames(item.assignee),
    status: item.status
  }
}

interface GtdItemFormProps {
  value: GtdItemFormFields
  onChange: (value: GtdItemFormFields) => void
  /** 避免两处弹框同时挂载时 id 冲突 */
  idPrefix: string
  className?: string
}

/**
 * 共用表单内核:只负责字段控件与值变更通知。
 * 不提交、不管弹框外壳、不触发校验(校验由外层在提交时调 gtdItemFormSchema)。
 * 管理界面的 shadcn Dialog 与打印页的黑白弹框共用本组件,只是外壳不同。
 */
export default function GtdItemForm({
  value,
  onChange,
  idPrefix,
  className
}: GtdItemFormProps) {
  const set = <K extends keyof GtdItemFormFields>(
    key: K,
    v: GtdItemFormFields[K]
  ) => onChange({ ...value, [key]: v })

  // 执行条件仅对 todo 有意义(原 MTR 语义);切走 todo 时不清空已填的值,
  // 只是禁用控件,避免用户误切换类型后丢数据。
  const conditionDisabled = value.type !== 'todo'

  return (
    <div className={className ?? 'flex flex-col gap-3'}>
      <div className='flex flex-col gap-1.5'>
        <Label htmlFor={`${idPrefix}-thing`}>事项名称</Label>
        <Input
          id={`${idPrefix}-thing`}
          value={value.thing}
          maxLength={255}
          onChange={(e) => set('thing', e.target.value)}
        />
      </div>

      <div className='flex flex-col gap-1.5'>
        <Label htmlFor={`${idPrefix}-note`}>备注</Label>
        <Textarea
          id={`${idPrefix}-note`}
          rows={2}
          value={value.note}
          onChange={(e) => set('note', e.target.value)}
        />
      </div>

      <div className='flex flex-col gap-1.5'>
        <Label htmlFor={`${idPrefix}-type`}>类型</Label>
        <Select
          value={value.type}
          onValueChange={(v) => set('type', v as GtdType)}>
          <SelectTrigger id={`${idPrefix}-type`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {gtdTypes.map((t) => (
              <SelectItem key={t} value={t}>
                {gtdTypeLabels[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className='flex flex-col gap-1.5'>
        <Label htmlFor={`${idPrefix}-schedule-on`}>生效日期</Label>
        <Input
          id={`${idPrefix}-schedule-on`}
          type='date'
          value={value.schedule_on}
          onChange={(e) => set('schedule_on', e.target.value)}
        />
      </div>

      <div className='flex flex-col gap-1.5'>
        <Label htmlFor={`${idPrefix}-hard-time`}>硬时间(可留空)</Label>
        <Input
          id={`${idPrefix}-hard-time`}
          type='datetime-local'
          // datetime-local 用 'T' 分隔,存储用空格分隔,这里做双向转换
          value={value.hard_time.replace(' ', 'T')}
          onChange={(e) => set('hard_time', e.target.value.replace('T', ' '))}
        />
      </div>

      <div className='flex flex-col gap-1.5'>
        <Label htmlFor={`${idPrefix}-condition`}>
          执行条件{conditionDisabled ? '(仅待办可用)' : ''}
        </Label>
        <Select
          value={value.condition || '__none__'}
          disabled={conditionDisabled}
          onValueChange={(v) => set('condition', normalizeCondition(v))}>
          <SelectTrigger id={`${idPrefix}-condition`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='__none__'>(无 / 其他)</SelectItem>
            {gtdConditions.map((c) => (
              <SelectItem key={c} value={c}>
                {gtdConditionLabels[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className='flex flex-col gap-1.5'>
        <Label htmlFor={`${idPrefix}-assignee`}>受让人</Label>
        <Input
          id={`${idPrefix}-assignee`}
          placeholder='多人以逗号分隔,如:张三,李四'
          value={value.assignee.join(',')}
          onChange={(e) =>
            set(
              'assignee',
              e.target.value
                .split(',')
                .map((s) => s.trim())
                .filter((s) => s !== '')
            )
          }
        />
      </div>

      <div className='flex flex-col gap-1.5'>
        <Label>状态</Label>
        <div className='flex gap-4'>
          {gtdStatuses.map((s) => (
            <label
              key={s}
              className='flex cursor-pointer items-center gap-1.5 text-sm'>
              <input
                type='radio'
                name={`${idPrefix}-status`}
                checked={value.status === s}
                onChange={() => set('status', s as GtdStatus)}
              />
              {gtdStatusLabels[s]}
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}
