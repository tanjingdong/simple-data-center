import PasswordField from '@/components/form/password-field'
import InputField from '@/components/form/input-field'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { errorToast } from '@/lib/toast'
import { loginSuperuser } from '@/services/api-frpc'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { ClientResponseError } from 'pocketbase'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod/v4'

// superuser 密码长度由后端校验,前端只要求非空
const adminLoginSchema = z.object({
  email: z.email('邮箱格式不正确'),
  password: z.string().min(1, '请输入密码')
})
type AdminLoginFields = z.infer<typeof adminLoginSchema>

export default function AdminLoginCard() {
  const queryClient = useQueryClient()
  const [authError, setAuthError] = useState<string>()

  const form = useForm<AdminLoginFields>({
    resolver: zodResolver(adminLoginSchema),
    defaultValues: { email: '', password: '' }
  })

  const handleLogin = async ({ email, password }: AdminLoginFields) => {
    setAuthError(undefined)
    try {
      await loginSuperuser(email, password)
      // 登录成功后失效 admin 相关查询,触发父级组件重渲染并就地切换为工具界面
      queryClient.invalidateQueries({ queryKey: ['frpc-status'] })
      queryClient.invalidateQueries({ queryKey: ['frpc-config'] })
    } catch (error) {
      if (error instanceof ClientResponseError && error.status === 400) {
        setAuthError('账号或密码错误')
      } else {
        errorToast('登录失败', error)
      }
    }
  }

  return (
    <div className='mx-auto w-full max-w-sm rounded-lg border p-6'>
      <h2 className='text-lg font-bold'>管理员登录</h2>
      <p className='text-muted-foreground mt-1 text-sm'>
        登录超级管理员账号后使用管理工具。
      </p>
      <Form {...form}>
        <form
          className='mt-4 flex flex-col gap-4'
          onSubmit={form.handleSubmit(handleLogin)}>
          <InputField form={form} name='email' type='email' label='邮箱' />
          <PasswordField form={form} name='password' label='密码' />
          {authError && (
            <p className='text-destructive text-sm'>{authError}</p>
          )}
          <Button
            type='submit'
            disabled={!form.formState.isDirty || form.formState.isSubmitting}>
            登录
          </Button>
        </form>
      </Form>
    </div>
  )
}
