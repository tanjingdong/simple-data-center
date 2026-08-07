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
  PersonOrgLinkFormFields,
  personOrgLinkFormSchema
} from '@/schemas/person-org-link-schema'
import { createLink } from '@/services/api-person-org-links'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import OrgPicker from './org-picker'

// 任职录入弹窗:person_id 固定为当前对象,org_id 由选择器提供
export default function LinkFormDialog({
  open,
  onOpenChange,
  personId
}: {
  open: boolean
  onOpenChange(open: boolean): void
  personId: string
}) {
  const queryClient = useQueryClient()
  const form = useForm<PersonOrgLinkFormFields>({
    resolver: zodResolver(personOrgLinkFormSchema),
    defaultValues: { org_id: '', link_description: '' }
  })

  const mutation = useMutation({
    mutationFn: (data: PersonOrgLinkFormFields) =>
      createLink({ person_id: personId, ...data }),
    onSuccess: (_data, variables) => {
      successToast('任职已记录')
      queryClient.invalidateQueries({
        queryKey: ['persons', personId, 'links']
      })
      queryClient.invalidateQueries({
        queryKey: ['organizations', variables.org_id, 'members']
      })
      // 跨实体失效:组织侧列表/详情可能展示成员信息
      queryClient.invalidateQueries({ queryKey: ['organizations'] })
      form.reset({ org_id: '', link_description: '' })
      onOpenChange(false)
    },
    onError: (error) => errorToast('记录任职失败', error)
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新增任职</DialogTitle>
        </DialogHeader>
        <form
          className='flex flex-col gap-3'
          onSubmit={form.handleSubmit((d) => mutation.mutate(d))}>
          <div className='space-y-1'>
            <Label>选择组织</Label>
            <OrgPicker
              value={form.watch('org_id')}
              onChange={(id) => form.setValue('org_id', id)}
            />
            {form.formState.errors.org_id && (
              <p className='text-destructive text-xs'>
                {form.formState.errors.org_id.message}
              </p>
            )}
          </div>
          <div className='space-y-1'>
            <Label>关联描述</Label>
            <Input
              placeholder='如:就职、挂职、曾在职'
              {...form.register('link_description')}
            />
            {form.formState.errors.link_description && (
              <p className='text-destructive text-xs'>
                {form.formState.errors.link_description.message}
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
