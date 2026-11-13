import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { formatMergeCreated, mergeLabels } from '@/lib/merge-labels'
import { errorToast, successToast } from '@/lib/toast'
import {
  commitMerge,
  fetchMergePreview,
  type MergeInput,
  type MergeKind
} from '@/services/api-pim-merge'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

// 合并确认对话框:字段结果由后端计算(与落库同一套规则),前端只负责展示与提交。
// kind 显式传入(不依赖 input.kind);关闭或 input 为 null 时不发起预览请求。
export default function MergeDialog({
  open,
  kind,
  input,
  editingLabel,
  otherLabel,
  onOpenChange,
  onMerged
}: {
  open: boolean
  kind: MergeKind
  input: MergeInput | null
  editingLabel: string
  otherLabel: string
  onOpenChange(open: boolean): void
  onMerged(survivorId: string): void
}) {
  const queryClient = useQueryClient()

  const previewQuery = useQuery({
    queryKey: ['pim', 'merge-preview', input],
    queryFn: () => {
      if (!input) throw new Error('缺少合并参数')
      return fetchMergePreview(input)
    },
    enabled: Boolean(open && input),
    retry: false
  })

  const commitMutation = useMutation({
    mutationFn: () => {
      if (!input) throw new Error('缺少合并参数')
      return commitMerge(input)
    },
    onSuccess: (res) => {
      // 合并可能改写人员与组织两个集合:只发起失效,不等待重取完成。
      // 被删记录的详情查询会 404 重试,等待会让对话框停在「合并中…」数秒;
      // 失效在后台进行,界面立刻关闭并切到保留者。
      queryClient.invalidateQueries({ queryKey: ['persons'] })
      queryClient.invalidateQueries({ queryKey: ['organizations'] })
      onOpenChange(false)
      onMerged(res.survivorId)
      successToast('已合并')
    },
    onError: (error) => errorToast('合并失败', error)
  })

  const preview = previewQuery.data
  const previewError = previewQuery.isError
    ? previewQuery.error instanceof Error
      ? previewQuery.error.message
      : String(previewQuery.error)
    : ''
  const labels = new Map(mergeLabels[kind].map((row) => [row.key, row.label]))
  // 隐藏 A/B/结果全空的字段行;若全空则退回后端返回的全部字段,至少展示身份列
  const nonEmptyFields = preview
    ? preview.fields.filter(
        (row) => row.a !== '' || row.b !== '' || row.result !== ''
      )
    : []
  const fields = nonEmptyFields.length
    ? nonEmptyFields
    : (preview?.fields ?? [])
  const survivorLabel = preview?.survivorIsEditing ? editingLabel : otherLabel
  const deletedLabel = preview?.survivorIsEditing ? otherLabel : editingLabel
  // 设计 §9.2:顶部说明要带上保留/删除记录的创建时间
  const survivorCreated = formatMergeCreated(preview?.survivorCreated)
  const deletedCreated = formatMergeCreated(preview?.deletedCreated)
  // 取消/关闭时父级同时把 input 置空,Radix 还在播放退出动画;
  // 这段文案只在 open 时渲染,避免关闭帧闪出「缺少合并参数」。
  const description = !input
    ? '缺少合并参数,无法预览。'
    : preview
      ? `将保留「${survivorLabel}」${
          survivorCreated ? `(创建于 ${survivorCreated})` : ''
        },删除「${deletedLabel}」${
          deletedCreated ? `(创建于 ${deletedCreated})` : ''
        }。${
          preview.survivorIsEditing
            ? '保留的是当前编辑的记录。'
            : '保留的是合并对象;当前编辑的内容会先合并进保留记录,再删除被合并记录。'
        }`
      : '正在计算合并结果…'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-3xl'>
        <DialogHeader>
          <DialogTitle>合并信息</DialogTitle>
          <DialogDescription>{open ? description : null}</DialogDescription>
        </DialogHeader>

        {open && previewError && (
          <p className='text-destructive text-sm'>预览失败:{previewError}</p>
        )}

        {open && preview && (
          <>
            <div className='max-h-[55vh] overflow-auto rounded-md border'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>字段</TableHead>
                    <TableHead>当前编辑(A)</TableHead>
                    <TableHead>合并对象(B)</TableHead>
                    <TableHead>合并结果</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fields.map((row) => (
                    <TableRow key={row.key}>
                      <TableCell className='font-medium'>
                        {labels.get(row.key) ?? row.key}
                      </TableCell>
                      <TableCell className='text-muted-foreground'>
                        {row.a || '—'}
                      </TableCell>
                      <TableCell className='text-muted-foreground'>
                        {row.b || '—'}
                      </TableCell>
                      <TableCell>{row.result || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className='text-destructive text-sm'>
              此操作不可撤销;被合并的记录将被删除,其关系、事件参与方会改指到保留记录。
            </p>
          </>
        )}

        <DialogFooter className='gap-2'>
          <Button
            type='button'
            variant='outline'
            onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            type='button'
            variant='destructive'
            disabled={
              !preview || previewQuery.isError || commitMutation.isPending
            }
            onClick={() => commitMutation.mutate()}>
            {commitMutation.isPending ? '合并中…' : '确认合并'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
