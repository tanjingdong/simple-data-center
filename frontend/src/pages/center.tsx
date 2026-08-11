import { Button } from '@/components/ui/button'
import { Link } from '@tanstack/react-router'
import { LayoutDashboardIcon } from 'lucide-react'

// 数据大厅:普通用户登录后的落地页,与数据库状态无关。
// 集中提供系统各业务功能的入口,将来新增功能只需在此追加链接;
// 业务数据有误时,报错由具体业务页面呈现,不影响本页。
export default function CenterPage() {
  return (
    <main className='mx-auto flex w-full max-w-xl flex-col items-center gap-y-6 px-4 py-8'>
      <h1 className='text-3xl font-bold'>数据大厅</h1>
      <p className='text-muted-foreground text-center text-sm'>
        欢迎回来,请选择要使用的功能。
      </p>

      <div className='w-full space-y-3'>
        <Button asChild size='lg' className='w-full justify-start'>
          <Link to='/tans-PIM'>
            <LayoutDashboardIcon className='size-5' />
            tans-PIM
          </Link>
        </Button>
      </div>
    </main>
  )
}
