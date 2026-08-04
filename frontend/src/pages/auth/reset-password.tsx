import PasswordField from '@/components/form/password-field'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import useAuth from '@/hooks/use-auth'
import { useThrottle } from '@/hooks/use-throttle'
import { ResetPasswordFields, resetPasswordSchema } from '@/schemas/auth-schema'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'

export default function ResetPasswordPage() {
  const { confirmPasswordReset } = useAuth()
  const navigate = useNavigate()

  const { token } = useSearch({ from: '/auth/reset-password' })

  const form = useForm<ResetPasswordFields>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: '',
      passwordConfirm: ''
    }
  })

  const [handleResetPassword, isResettingPassword] = useThrottle(
    ({ password, passwordConfirm }: ResetPasswordFields) =>
      confirmPasswordReset(password, passwordConfirm, token)
  )

  if (!token) return navigate({ to: '/login' })

  return (
    <main className='mx-auto flex w-full max-w-[350px] flex-col items-center gap-y-4'>
      <h2 className='mt-4 text-4xl font-bold'>重置密码</h2>
      <p className='text-muted-foreground text-center text-xl font-light'>
        输入您的新密码
      </p>
      <Form {...form}>
        <form
          className='flex w-full flex-col items-center gap-y-4'
          onSubmit={form.handleSubmit(handleResetPassword)}>
          <PasswordField form={form} name='password' label='新密码' />
          <PasswordField
            form={form}
            name='passwordConfirm'
            label='确认新密码'
          />

          <Button
            className='mt-4 w-full'
            type='submit'
            disabled={!form.formState.isDirty || isResettingPassword}>
            修改密码
          </Button>
        </form>
      </Form>
      <p className='text-sm'>
        返回{' '}
        <Link to='/login' className='text-primary'>
          登录
        </Link>
      </p>
    </main>
  )
}
