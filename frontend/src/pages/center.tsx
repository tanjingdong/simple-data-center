import { Link } from '@tanstack/react-router'
import { centerModules } from '@/lib/center-modules'

// 数据大厅:普通用户登录后的落地页,与数据库状态无关。
// 各业务功能以苹果风格方格呈现(圆角卡片 + 悬浮效果),由 centerModules 注册表驱动,
// 新增功能模块只需在注册表追加一条,无需改本页。
export default function CenterPage() {
  return (
    <main className='mx-auto flex w-full max-w-2xl flex-col items-center gap-y-8 px-4 py-10'>
      <div className='text-center'>
        <h1 className='text-3xl font-bold'>数据大厅</h1>
        <p className='text-muted-foreground mt-2 text-sm'>
          欢迎回来,请选择要使用的功能。
        </p>
      </div>

      <div className='grid w-full grid-cols-1 gap-4 sm:grid-cols-2'>
        {centerModules.map((module) => (
          <Link
            key={module.id}
            to={module.path}
            className='group flex min-h-40 flex-col justify-between rounded-3xl border bg-card p-6 transition-all duration-200 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5'>
            <span className='text-xl font-semibold group-hover:text-primary'>
              {module.label}
            </span>
            <span className='text-muted-foreground text-sm leading-relaxed'>
              {module.description}
            </span>
          </Link>
        ))}
      </div>
    </main>
  )
}
