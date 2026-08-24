import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { businessModules } from '@/lib/business-modules'
import { Link } from '@tanstack/react-router'

// 数据大厅:普通用户登录后的落地页,与数据库状态无关。
// 集中提供系统各业务功能的入口,新增业务只需在 business-modules 追加一项;
// 业务数据有误时,报错由具体业务页面呈现,不影响本页。
// 各业务功能以苹果风格方格呈现(圆角卡片 + 悬浮效果),由 businessModules 注册表驱动。
export default function CenterPage() {
  return (
    <main className='mx-auto flex w-full max-w-5xl flex-col items-center gap-y-8 px-4 py-8'>
      <h1 className='text-3xl font-bold'>数据大厅</h1>
      <p className='text-muted-foreground text-center text-sm'>
        欢迎回来,请选择要使用的功能。
      </p>

      <div className='grid w-full grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3'>
        {businessModules.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.path}
              to={item.path}
              className='group focus:outline-hidden'>
              <Card className='hover:border-foreground/30 group-focus-visible:ring-ring h-full transition group-focus-visible:ring-2 group-focus-visible:ring-offset-2 hover:-translate-y-0.5 hover:shadow-md'>
                <CardHeader>
                  <Icon className='size-6' />
                  <CardTitle className='text-base'>{item.title}</CardTitle>
                  <CardDescription>{item.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          )
        })}
      </div>
    </main>
  )
}
