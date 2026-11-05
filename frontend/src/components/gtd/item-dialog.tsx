import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { errorToast } from '@/lib/toast'
import {
  gtdItemFormSchema,
  type GtdItem,
  type GtdItemFormFields
} from '@/schemas/gtd-item-schema'
import { useState } from 'react'
import GtdItemForm, { emptyGtdItemForm, toFormFields } from './item-form'

interface GtdItemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** null 表示新建 */
  item: GtdItem | null
  /** 新建时的预填值(快捷添加行已填的字段) */
  preset?: Partial<GtdItemFormFields>
  onSubmit: (data: GtdItemFormFields) => Promise<void>
}

interface GtdItemDialogBodyProps {
  item: GtdItem | null
  preset?: Partial<GtdItemFormFields>
  onSubmit: (data: GtdItemFormFields) => Promise<void>
  onClose: () => void
}

/**
 * 弹框内容。表单初值在挂载时算一次即可——外层用 key 控制重挂载,
 * 因此不需要「用 effect 同步 props 到 state」那种会产生级联渲染的写法。
 */
function GtdItemDialogBody({
  item,
  preset,
  onSubmit,
  onClose
}: GtdItemDialogBodyProps) {
  const [value, setValue] = useState<GtdItemFormFields>(() =>
    item ? toFormFields(item) : emptyGtdItemForm(preset)
  )
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    const parsed = gtdItemFormSchema.safeParse(value)
    if (!parsed.success) {
      errorToast('请检查表单', parsed.error.issues[0]?.message ?? '输入不合法')
      return
    }
    setSubmitting(true)
    try {
      await onSubmit(parsed.data)
      onClose()
    } catch (err) {
      errorToast(item ? '更新失败' : '新增失败', err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{item ? '编辑事项' : '新增事项'}</DialogTitle>
        {item && (
          <DialogDescription className='font-mono text-xs'>
            ID: {item.id} | 创建: {item.created} | 更新: {item.updated}
          </DialogDescription>
        )}
      </DialogHeader>

      <GtdItemForm
        idPrefix={item ? `gtd-dlg-${item.id}` : 'gtd-dlg-new'}
        value={value}
        onChange={setValue}
      />

      <DialogFooter>
        <Button variant='outline' disabled={submitting} onClick={onClose}>
          取消
        </Button>
        <Button disabled={submitting} onClick={handleSubmit}>
          {submitting ? '保存中…' : '保存'}
        </Button>
      </DialogFooter>
    </>
  )
}

/** 管理界面的编辑弹框(站内统一 shadcn 风格);打印页用另一个黑白弹框,共用 GtdItemForm 内核 */
export default function GtdItemDialog({
  open,
  onOpenChange,
  item,
  preset,
  onSubmit
}: GtdItemDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[85vh] overflow-y-auto sm:max-w-lg'>
        {/* key 变化即重挂载,表单初值随之重置(换事项/开关弹框都不需要 effect 同步) */}
        <GtdItemDialogBody
          key={item?.id ?? 'new'}
          item={item}
          preset={preset}
          onSubmit={onSubmit}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
