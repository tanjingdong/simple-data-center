import { Button } from '@/components/ui/button'
import { cn } from '@/lib/shadcn'
import {
  adminPb,
  isSuperuserAuthed,
  logoutSuperuser
} from '@/services/api-frpc'
import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import { LogOutIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { adminTools } from './admin-tools'

function ToolMenu() {
  const location = useRouterState({ select: (s) => s.location })

  return (
    <nav className='flex flex-col gap-1'>
      {adminTools.map((tool) => {
        const Icon = tool.icon
        const active = location.pathname === tool.path
        return (
          <Link
            key={tool.id}
            to={tool.path}
            className={cn(
              'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors focus:outline-hidden',
              active
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}>
            <Icon className='size-4' />
            {tool.label}
          </Link>
        )
      })}
    </nav>
  )
}

export default function AdminLayout() {
  // 管理会话与 PB Dashboard(/_ )共享 pb_auth 键,onChange 订阅登录/退出变化
  const [authed, setAuthed] = useState(isSuperuserAuthed)
  useEffect(() => adminPb.authStore.onChange(() => setAuthed(isSuperuserAuthed())), [])

  // 管理会话失效(主动退出、跨标签页 Dashboard 退出或 token 过期):整页跳转 /_ 重新登录
  useEffect(() => {
    if (!authed) window.location.assign('/_/')
  }, [authed])

  const handleLogout = () => {
    logoutSuperuser()
  }

  return (
    <div className='flex flex-1'>
      <aside className='hidden w-[220px] shrink-0 flex-col border-r p-4 md:flex'>
        <ToolMenu />
        {authed && (
          <Button
            variant='ghost'
            size='sm'
            onClick={handleLogout}
            className='mt-auto flex items-center justify-start gap-1.5 text-sm'>
            <LogOutIcon className='size-4' />
            退出管理
          </Button>
        )}
      </aside>
      <main className='min-w-0 flex-1 p-4 md:p-6'>
        <Outlet />
      </main>
    </div>
  )
}
