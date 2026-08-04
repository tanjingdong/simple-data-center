import { Button } from '@/components/ui/button'
import { Link } from '@tanstack/react-router'
import { BrainCircuitIcon, CircleHelpIcon, ListTodoIcon } from 'lucide-react'

export default function HomePage() {
  return (
    <main className='mx-auto flex max-w-3xl flex-col items-center gap-y-12 px-4'>
      <section className='w-full space-y-3 text-center'>
        <h1 className='my-6 text-5xl font-bold'>
          Long<span className='text-primary'> Habit</span>
        </h1>
        <h2 className='text-2xl font-semibold'>长期习惯的高效追踪</h2>
        <p className='text-muted-foreground text-xl font-light'>
          受 James Clear 畅销书{' '}
          <a
            target='_blank'
            rel='noreferrer'
            className='hover:underline'
            href='https://jamesclear.com/atomic-habits'>
            掌控习惯
          </a>
          的启发,Long Habit
          让周期性任务的管理变得简单而愉快,帮助您轻松建立持久的习惯。
        </p>
      </section>

      <section className='flex w-full flex-col justify-center gap-4 sm:flex-row'>
        <Button asChild size='lg' className='w-full sm:w-40'>
          <Link to='/register'>开始使用</Link>
        </Button>
        <Button asChild variant='outline' size='lg' className='w-full sm:w-40'>
          <Link to='/login'>登录</Link>
        </Button>
      </section>

      <section className='bg-popover w-full space-y-2 rounded-lg p-4'>
        <h2 className='flex items-center gap-x-2 text-2xl font-semibold'>
          <ListTodoIcon className='text-primary/80 size-6' /> 使用方式
        </h2>
        <ol className='text-muted-foreground list-decimal space-y-2 pl-4 text-sm'>
          <li>将你想追踪的任务添加到列表</li>
          <li>设置目标:你希望多久重复一次该任务?</li>
          <li>在完成任务的当天将其标记为完成</li>
          <li>错过目标、任务逾期时收到提醒</li>
        </ol>
      </section>

      <section className='bg-popover w-full space-y-4 rounded-lg p-4'>
        <h2 className='flex items-center gap-x-2 text-2xl font-semibold'>
          <BrainCircuitIcon className='text-primary/80 size-6' /> 智能功能
        </h2>
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          <div className='space-y-1'>
            <h4 className='font-semibold'>简单追踪</h4>
            <p className='text-muted-foreground text-sm'>
              查看每个任务上次完成的时间及已过去的天数
            </p>
          </div>
          <div className='space-y-1'>
            <h4 className='font-semibold'>灵活目标</h4>
            <p className='text-muted-foreground text-sm'>
              为每个周期性任务设置间隔
            </p>
          </div>
          <div className='space-y-1'>
            <h4 className='font-semibold'>智能提醒</h4>
            <p className='text-muted-foreground text-sm'>
              通过邮件接收可定制的通知
            </p>
          </div>
          <div className='space-y-1'>
            <h4 className='font-semibold'>便捷导航</h4>
            <p className='text-muted-foreground text-sm'>
              按分类排序、搜索、筛选和分组任务
            </p>
          </div>
        </div>
      </section>

      <section className='bg-popover mb-16 w-full space-y-4 rounded-lg p-4'>
        <h2 className='flex items-center gap-x-2 text-2xl font-semibold'>
          <CircleHelpIcon className='text-primary/80 size-6' /> 为什么选择 Long
          Habit?
        </h2>
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          <div className='space-y-1'>
            <h4 className='font-semibold'>极简设计</h4>
            <p className='text-muted-foreground text-sm'>
              轻量、快速,聚焦于核心功能
            </p>
          </div>
          <div className='space-y-1'>
            <h4 className='font-semibold'>完全免费</h4>
            <p className='text-muted-foreground text-sm'>
              无广告、无垃圾信息、无乞讨
            </p>
          </div>
          <div className='space-y-1'>
            <h4 className='font-semibold'>隐私优先</h4>
            <p className='text-muted-foreground text-sm'>开源且可自托管</p>
          </div>
          <div className='space-y-1'>
            <h4 className='font-semibold'>随处访问</h4>
            <p className='text-muted-foreground text-sm'>
              基于网页,任何设备、任何时间均可使用
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
