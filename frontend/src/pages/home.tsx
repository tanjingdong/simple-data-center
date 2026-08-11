import InputField from '@/components/form/input-field'
import PasswordField from '@/components/form/password-field'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import useAuth from '@/hooks/use-auth'
import { useThrottle } from '@/hooks/use-throttle'
import { LoginFields, loginSchema } from '@/schemas/auth-schema'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from '@tanstack/react-router'
import {
  BookOpenIcon,
  ChevronDownIcon,
  LogInIcon,
  UserPlusIcon
} from 'lucide-react'
import { useForm } from 'react-hook-form'

// 通用静态首页:不依赖任何数据库数据,空库(0 数据库)也能正常打开。
// 提供内嵌登录表单、注册入口、使用说明(默认折叠)与版权说明。
export default function HomePage() {
  const { loginWithPassword } = useAuth()

  const form = useForm<LoginFields>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' }
  })

  const [handleLogin, isLoggingIn] = useThrottle(
    ({ email, password }: LoginFields) => loginWithPassword(email, password)
  )

  return (
    <main className='mx-auto flex w-full max-w-3xl flex-col items-center gap-y-8 px-4'>
      <section className='w-full space-y-3 text-center'>
        <h1 className='my-4 text-4xl font-bold'>
          Simple<span className='text-primary'> Data Center</span>
        </h1>
        <p className='text-muted-foreground text-lg font-light'>
          基于 PocketBase 构建的自托管数据管理服务,内置 frp
          反向代理等管理工具,数据由您自己掌控。
        </p>
      </section>

      <section className='bg-popover w-full max-w-sm rounded-lg border p-4'>
        <h2 className='flex items-center gap-x-2 text-lg font-semibold'>
          <LogInIcon className='text-primary/80 size-5' /> 登录
        </h2>
        <Form {...form}>
          <form
            className='mt-3 flex flex-col gap-3'
            onSubmit={form.handleSubmit(handleLogin)}>
            <InputField form={form} name='email' type='email' label='邮箱' />
            <PasswordField form={form} name='password' label='密码' />
            <Button
              type='submit'
              disabled={!form.formState.isDirty || isLoggingIn}>
              登录
            </Button>
          </form>
        </Form>
        <div className='mt-3 border-t pt-3'>
          <p className='text-muted-foreground mb-2 text-center text-sm'>
            还没有账号?
          </p>
          <Button asChild variant='secondary' className='w-full'>
            <Link to='/register'>
              <UserPlusIcon className='size-4' />
              注册用户
            </Link>
          </Button>
        </div>
      </section>

      <section className='w-full space-y-4'>
        <details className='bg-popover w-full rounded-lg p-4'>
          <summary className='flex cursor-pointer list-none items-center gap-x-2 text-base font-semibold [&::-webkit-details-marker]:hidden'>
            <BookOpenIcon className='text-primary/80 size-5' /> 使用说明
            <ChevronDownIcon className='text-muted-foreground ml-auto size-4 transition-transform group-open:rotate-180' />
          </summary>

          <div className='text-muted-foreground mt-3 space-y-4 text-sm'>
            <div className='space-y-1.5'>
              <h3 className='text-foreground font-semibold'>忘记了其他操作?</h3>
              <p>
                本系统所有命令行操作(创建/重置超级管理员、启动参数、数据备份等)详见项目文档
                <code className='bg-muted rounded px-1'>
                  docs/superpowers/users/users.md
                </code>
                ;也可以在程序目录执行{' '}
                <code className='bg-muted rounded px-1'>
                  tans-pim.exe --help
                </code>{' '}
                或{' '}
                <code className='bg-muted rounded px-1'>
                  tans-pim.exe serve --help
                </code>{' '}
                查看命令行帮助。
              </p>
            </div>

            <div className='space-y-1.5'>
              <h3 className='text-foreground font-semibold'>数据准备</h3>
              <p>
                首次使用需由超级管理员在「数据管理」后台导入数据结构文件(
                <code className='bg-muted rounded px-1'>
                  backend/pb_schema.json
                </code>
                ),注册的新用户也需管理员在 users 表中将 verified 设为
                true(或配置邮件自动认证)后方可登录。
              </p>
            </div>

            <div className='space-y-1.5'>
              <h3 className='text-foreground font-semibold'>备份与恢复</h3>
              <p>
                数据全部存放在数据目录(默认 db 文件夹)中,停止服务后复制整个 db
                文件夹即可完成备份;恢复时把备份复制回去。
              </p>
            </div>
          </div>
        </details>
      </section>

      <footer className='text-muted-foreground w-full space-y-1 border-t pt-4 pb-6 text-center text-xs'>
        <p>
          Simple Data Center 基于{' '}
          <a
            href='https://github.com/s-petr/longhabit'
            target='_blank'
            rel='noreferrer'
            className='hover:underline'>
            Long Habit
          </a>{' '}
          (MIT License) 二次开发;后端基于{' '}
          <a
            href='https://pocketbase.io'
            target='_blank'
            rel='noreferrer'
            className='hover:underline'>
            PocketBase
          </a>{' '}
          (MIT License);反向代理功能基于{' '}
          <a
            href='https://github.com/fatedier/frp'
            target='_blank'
            rel='noreferrer'
            className='hover:underline'>
            frp
          </a>{' '}
          (Apache License 2.0)。
        </p>
      </footer>
    </main>
  )
}
