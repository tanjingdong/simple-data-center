import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from '@/components/ui/sheet'
import { cn } from '@/lib/shadcn'
import { logoutSuperuser } from '@/services/api-frpc'
import { useQueryClient } from '@tanstack/react-query'
import {
  Link,
  Outlet,
  useNavigate,
  useRouterState
} from '@tanstack/react-router'
import {
  DatabaseIcon,
  LogOutIcon,
  MenuIcon,
  WrenchIcon
} from 'lucide-react'
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
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const handleLogout = () => {
    logoutSuperuser()
    // 失效 admin 相关查询,触发内容区组件重渲染回登录卡片
    queryClient.invalidateQueries({ queryKey: ['frpc-status'] })
    queryClient.invalidateQueries({ queryKey: ['frpc-config'] })
    // 退出后返回数据大厅(未登录用户由该路由守卫重定向到 /login)
    navigate({ to: '/center' })
  }

  return (
    <div className='flex min-h-dvh flex-col'>
      <header className='border-b px-4 py-3 md:px-6'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-3'>
            {/* 移动端抽屉菜单 */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant='ghost' size='icon' className='md:hidden'>
                  <MenuIcon className='size-5' />
                </Button>
              </SheetTrigger>
              <SheetContent side='left' className='w-56'>
                <SheetHeader>
                  <SheetTitle>管理工具</SheetTitle>
                </SheetHeader>
                <div className='mt-4'>
                  <ToolMenu />
                </div>
              </SheetContent>
            </Sheet>
            <h1 className='flex items-center gap-2 text-lg font-bold'>
              <WrenchIcon className='size-5' /> 管理工具
            </h1>
          </div>
          <div className='flex items-center gap-3'>
            <a
              href='/_/'
              target='_blank'
              rel='noreferrer'
              className='text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm transition-colors focus:outline-hidden'>
              <DatabaseIcon className='size-4' />
              数据管理
            </a>
            <Button
              variant='ghost'
              size='sm'
              onClick={handleLogout}
              className='flex items-center gap-1.5 text-sm'>
              <LogOutIcon className='size-4' />
              退出
            </Button>
          </div>
        </div>
      </header>

      <div className='flex flex-1'>
        <aside className='hidden w-[220px] shrink-0 border-r p-4 md:block'>
          <ToolMenu />
        </aside>
        <main className='min-w-0 flex-1 p-4 md:p-6'>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
