import InputField from '@/components/form/input-field'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import useAuth from '@/hooks/use-auth'
import { useThrottle } from '@/hooks/use-throttle'
import { VerifyEmailFields, verifyEmailSchema } from '@/schemas/auth-schema'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useSearch } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'

export default function VerifyEmailPage() {
  const {
    emailSendCountdown,
    sendVerificationEmail,
    startEmailSendCountdown,
    verifyEmailByToken,
    logout
  } = useAuth()

  const { user } = useAuth()

  const params = useSearch({ from: '/auth/verify-email' })
  const token = (params && params.token) || ''

  const form = useForm<VerifyEmailFields>({
    resolver: zodResolver(verifyEmailSchema),
    defaultValues: { token }
  })

  useEffect(() => {
    token && verifyEmailByToken(token)
    startEmailSendCountdown({ resetTargetTime: false })
  }, [])

  const [handleVerifyEmail, isVerifyingEmail] = useThrottle(
    ({ token }: VerifyEmailFields) => verifyEmailByToken(token)
  )

  return (
    <main className='mx-auto flex w-full max-w-[350px] flex-col items-center gap-y-4'>
      <h2 className='mt-4 text-4xl font-bold'>验证邮箱</h2>
      <p className='text-muted-foreground text-xl font-light'>完成注册</p>
      <Form {...form}>
        <form
          className='flex w-full flex-col items-center gap-y-4'
          onSubmit={form.handleSubmit(handleVerifyEmail)}>
          <p className='text-center text-sm'>
            请查收您的收件箱并点击注册链接。
          </p>
          {user?.email && (
            <p className='text-center text-sm'>
              邮件已发送至:{' '}
              <span className='text-primary'>{user.email}</span>{' '}
            </p>
          )}
          <p className='text-center text-sm'>或在下方的输入框中输入验证令牌:</p>

          <InputField form={form} name='token' label='验证令牌' />

          <Button
            className='mt-4 w-full'
            type='submit'
            disabled={isVerifyingEmail}>
            使用令牌验证
          </Button>
          {user ? (
            <>
              <Button
                className='w-full'
                variant='secondary'
                type='button'
                disabled={emailSendCountdown > 0}
                onClick={() => sendVerificationEmail(user?.email)}>
                {emailSendCountdown > 0
                  ? `重新发送 (${emailSendCountdown})`
                  : '重新发送邮件'}
              </Button>
              <Button
                type='button'
                variant='link'
                className='w-full hover:no-underline'
                onClick={logout}>
                退出登录
              </Button>
            </>
          ) : (
            <p className='text-sm'>
              返回{' '}
              <Link to='/login' className='text-primary'>
                登录
              </Link>
            </p>
          )}
        </form>
      </Form>
    </main>
  )
}
