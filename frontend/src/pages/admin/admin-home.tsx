import { Link } from '@tanstack/react-router'
import { adminTools } from './admin-tools'

// 工具选择页:/admin 默认首页,从注册表渲染工具卡片。
// 新增工具只需在 admin-tools.ts 注册一条,此页自动出现入口。
export default function AdminHomePage() {
  return (
    <div className='flex flex-col gap-6'>
      <div>
        <h1 className='text-xl font-bold'>管理工具</h1>
        <p className='text-muted-foreground text-sm'>选择一个工具开始操作。</p>
      </div>

      <div className='grid gap-4 sm:grid-cols-2'>
        {adminTools.map((tool) => {
          const Icon = tool.icon
          return (
            <Link
              key={tool.id}
              to={tool.path}
              className='bg-popover hover:bg-muted flex items-center gap-3 rounded-lg border p-4 transition-colors focus:outline-hidden'>
              <Icon className='text-primary size-8 shrink-0' />
              <div className='min-w-0'>
                <h3 className='font-semibold'>{tool.label}</h3>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
