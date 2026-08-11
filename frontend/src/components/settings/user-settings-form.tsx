import UploadFileField from '@/components/form/file-upload-field'
import InputField from '@/components/form/input-field'
import PasswordField from '@/components/form/password-field'
import SwitchField from '@/components/form/switch-field'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import useAuth from '@/hooks/use-auth'
import { errorToast, successToast } from '@/lib/toast'
import {
  UpdateUserProfileFields,
  updateUserProfileSchema
} from '@/schemas/user-schema'
import {
  requestUserEmailChange,
  updateUserProfile
} from '@/services/api-settings'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { ClientResponseError } from 'pocketbase'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod/v4'

// 更改邮箱对话框的表单校验 schema
const newEmailSchema = z.object({
  newEmail: z.email('邮箱格式不正确')
})

export default function UserSettingsForm() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { name, username, email, emailVisibility, authWithPasswordAvailable } =
    user ?? {}

  // 更改邮箱对话框开关
  const [emailDialogOpen, setEmailDialogOpen] = useState(false)

  // 主表单:个人资料 + 改密码(不含 email,email 走独立确认流程)
  const form = useForm<UpdateUserProfileFields>({
    resolver: zodResolver(updateUserProfileSchema),
    defaultValues: {
      name,
      username,
      emailVisibility,
      avatar: undefined,
      oldPassword: '',
      password: '',
      passwordConfirm: ''
    }
  })

  // 更改邮箱表单
  const emailForm = useForm<{ newEmail: string }>({
    resolver: zodResolver(newEmailSchema),
    defaultValues: { newEmail: '' }
  })

  const fieldsEdited = form.formState.isDirty

  const onSubmit = async (userData: UpdateUserProfileFields) => {
    if (!user?.id) return
    try {
      await updateUserProfile(user.id, userData)
      queryClient.invalidateQueries({ queryKey: ['user'] })
      form.reset({
        name: userData.name,
        username: userData.username,
        emailVisibility: userData.emailVisibility,
        avatar: undefined,
        oldPassword: '',
        password: '',
        passwordConfirm: ''
      })
      successToast('成功!', '账户信息更新成功')
    } catch (error) {
      if (error instanceof ClientResponseError) {
        const fieldErrors = (error.response?.data ?? {}) as Record<
          string,
          { message?: string } | undefined
        >
        if (fieldErrors.username) {
          form.setError('username', { message: '该用户名已被使用' })
        }
        if (fieldErrors.oldPassword) {
          form.setError('oldPassword', { message: '当前密码不正确' })
        }
      }
      errorToast('更新账户信息失败', error)
    }
  }

  const onSubmitEmailChange = async ({ newEmail }: { newEmail: string }) => {
    try {
      await requestUserEmailChange(newEmail)
      setEmailDialogOpen(false)
      emailForm.reset()
      successToast(
        '确认邮件已发送',
        `请查收新邮箱(${newEmail})的邮件并点击链接完成更改`
      )
    } catch (error) {
      if (error instanceof ClientResponseError) {
        const fieldErrors = (error.response?.data ?? {}) as Record<
          string,
          { message?: string } | undefined
        >
        const msg = fieldErrors.newEmail?.message?.toLowerCase() ?? ''
        if (msg.includes('invalid new email')) {
          emailForm.setError('newEmail', { message: '该邮箱已被使用' })
        } else if (msg.includes('not in list')) {
          emailForm.setError('newEmail', { message: '新邮箱与当前邮箱相同' })
        } else if (fieldErrors.newEmail) {
          emailForm.setError('newEmail', { message: '邮箱格式不正确' })
        } else {
          // 无字段错误(如邮件发送失败)
          emailForm.setError('newEmail', {
            message: '邮件发送失败,请检查服务配置'
          })
        }
      }
      errorToast('更改邮箱失败', error)
    }
  }

  return (
    <Form {...form}>
      <form
        className='flex w-full flex-col items-center gap-y-4'
        onSubmit={form.handleSubmit(onSubmit)}>
        <UploadFileField form={form} name='avatar' label='头像图片' />

        <InputField form={form} name='name' label='昵称' />

        <InputField form={form} name='username' label='用户名' />

        <SwitchField
          form={form}
          name='emailVisibility'
          label='我的邮箱对外可见'
        />

        {/* 邮箱:只读展示,变更走 requestEmailChange 邮件确认流程 */}
        <div className='flex w-full flex-col gap-y-2'>
          <FormLabel>邮箱</FormLabel>
          <div className='flex items-center gap-2'>
            <Input readOnly value={email ?? ''} />
            <Button
              type='button'
              variant='outline'
              className='w-32 shrink-0'
              onClick={() => setEmailDialogOpen(true)}>
              更改邮箱
            </Button>
          </div>
        </div>

        {authWithPasswordAvailable && (
          <>
            <p className='text-muted-foreground w-full text-xl font-light'>
              修改密码
            </p>

            {/* autoComplete 显式声明,避免浏览器密码管理器自动填充干扰「是否改密码」判定 */}
            <PasswordField
              form={form}
              name='oldPassword'
              label='当前密码'
              autoComplete='current-password'
            />

            <PasswordField
              form={form}
              name='password'
              label='新密码'
              autoComplete='new-password'
            />

            <PasswordField
              form={form}
              name='passwordConfirm'
              label='确认新密码'
              autoComplete='new-password'
            />
          </>
        )}

        <Button disabled={!fieldsEdited} className='mt-4 w-full' type='submit'>
          保存设置
        </Button>
      </form>

      {/* 更改邮箱确认对话框 */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className='bg-popover sm:max-w-[400px]'>
          <DialogHeader>
            <DialogTitle>更改邮箱</DialogTitle>
            <DialogDescription>
              输入新邮箱地址,确认邮件将发送至新邮箱,点击邮件中的链接后更改生效。
            </DialogDescription>
          </DialogHeader>
          <Form {...emailForm}>
            <form
              className='flex flex-col gap-y-4'
              onSubmit={emailForm.handleSubmit(onSubmitEmailChange)}>
              <FormField
                control={emailForm.control}
                name='newEmail'
                render={({ field }) => (
                  <FormItem>
                    <div className='flex items-baseline justify-between'>
                      <FormLabel>新邮箱</FormLabel>
                      <FormMessage className='text-xs font-normal' />
                    </div>
                    <FormControl>
                      <Input type='email' {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <DialogFooter className='flex items-center gap-4 sm:justify-between'>
                <Button className='w-full' type='submit'>
                  发送确认邮件
                </Button>
                <DialogClose asChild>
                  <Button type='button' className='w-full' variant='secondary'>
                    取消
                  </Button>
                </DialogClose>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </Form>
  )
}
