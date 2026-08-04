import InputField from '@/components/form/input-field'
import PasswordField from '@/components/form/password-field'
import { GoogleLogo } from '@/components/shared/logos'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import useAuth from '@/hooks/use-auth'
import { useThrottle } from '@/hooks/use-throttle'
import { RegisterFields, registerSchema } from '@/schemas/auth-schema'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'

export default function RegisterPage() {
  const { register, loginWithGoogle } = useAuth()

  const form = useForm<RegisterFields>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      passwordConfirm: ''
    }
  })

  const [handleRegister, isRegistering] = useThrottle(register)

  return (
    <main className='mx-auto flex w-full max-w-[350px] flex-col items-center gap-y-4'>
      <h2 className='mt-4 text-4xl font-bold'>注册</h2>
      <p className='text-muted-foreground text-center text-xl font-light'>
        填写信息创建新账号
      </p>
      <Form {...form}>
        <form
          className='flex w-full flex-col items-center gap-y-4'
          onSubmit={form.handleSubmit(handleRegister)}>
          <InputField form={form} name='name' />
          <InputField form={form} name='email' type='email' />
          <PasswordField form={form} name='password' />
          <PasswordField
            form={form}
            name='passwordConfirm'
            label='Confirm password'
          />

          <Button
            className='mt-4 w-full'
            type='submit'
            disabled={!form.formState.isDirty || isRegistering}>
            注册
          </Button>
          <Button
            className='w-full'
            variant='secondary'
            type='button'
            onClick={loginWithGoogle}>
            <GoogleLogo />
            使用 Google 注册
          </Button>
        </form>
      </Form>
      <p className='text-sm'>
        已有账号?{' '}
        <Link to='/login' className='text-primary'>
          登录
        </Link>
      </p>
    </main>
  )
}
