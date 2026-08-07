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
  Relation,
  RelationFormFields,
  relationFormSchema
} from '@/schemas/relation-schema'
import { createRelation, updateRelation } from '@/services/api-relations'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import PersonPicker from './person-picker'

// person_a 固定为当前对象,person_b 由选择器提供;服务端自动规范化 a<b
// relation 存在时为编辑模式(预填另一方与描述),否则为新增模式
export default function RelationFormDialog({
  open,
  onOpenChange,
  personId,
  relation
}: {
  open: boolean
  onOpenChange(open: boolean): void
  personId: string
  relation?: Relation
}) {
  const queryClient = useQueryClient()
  const form = useForm<RelationFormFields>({
    resolver: zodResolver(relationFormSchema),
    defaultValues: {
      person_a: personId,
      person_b: '',
      relation_description: ''
    }
  })

  // 每次打开都重置表单:编辑模式以 relation 为初始值,新增模式清空;避免残留上次内容
  useEffect(() => {
    if (open) {
      form.reset({
        person_a: personId,
        // 另一方 = 记录中不等于当前对象的那一侧
        person_b: relation
          ? relation.person_a === personId
            ? relation.person_b
            : relation.person_a
          : '',
        relation_description: relation?.relation_description ?? ''
      })
    }
  }, [open, form, relation, personId])

  const mutation = useMutation({
    // person_a 始终取当前 personId prop,置于末尾覆盖表单内挂载期的旧值,避免切换人员后写错归属
    mutationFn: (data: RelationFormFields) =>
      relation
        ? updateRelation(relation.id, { ...data, person_a: personId })
        : createRelation({ ...data, person_a: personId }),
    onSuccess: () => {
      successToast(relation ? '关系已更新' : '关系已建立')
      queryClient.invalidateQueries({
        queryKey: ['persons', personId, 'relations']
      })
      queryClient.invalidateQueries({ queryKey: ['persons', 'list'] })
      form.reset({ person_a: personId, person_b: '', relation_description: '' })
      onOpenChange(false)
    },
    onError: (error) =>
      errorToast(relation ? '保存失败' : '建立关系失败', error)
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{relation ? '编辑关系' : '建立关系'}</DialogTitle>
        </DialogHeader>
        <form
          className='flex flex-col gap-3'
          onSubmit={form.handleSubmit((d) => mutation.mutate(d))}>
          <div className='space-y-1'>
            <Label>选择另一人</Label>
            <PersonPicker
              value={form.watch('person_b')}
              excludeId={personId}
              onChange={(id) => form.setValue('person_b', id)}
            />
            {form.formState.errors.person_b && (
              <p className='text-destructive text-xs'>
                {form.formState.errors.person_b.message}
              </p>
            )}
          </div>
          <div className='space-y-1'>
            <Label>关系描述</Label>
            <Input
              placeholder='如:大学舍友、夫妻、上下级'
              {...form.register('relation_description')}
            />
            {form.formState.errors.relation_description && (
              <p className='text-destructive text-xs'>
                {form.formState.errors.relation_description.message}
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
