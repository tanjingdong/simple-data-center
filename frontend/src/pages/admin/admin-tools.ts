import { NetworkIcon, type LucideIcon } from 'lucide-react'
import type { ComponentType } from 'react'
import FrpcToolPage from './frpc-tool'

export interface AdminTool {
  id: string
  label: string
  icon: LucideIcon
  path: string
  component: ComponentType
}

// 管理工具注册表:新增工具只需在此追加一条 + 提供一个组件文件,
// 侧边菜单与路由由 router.tsx 据此自动生成。
// as const 保留 path 的字面量类型,供 TanStack Router 的 to 属性类型推导。
export const adminTools = [
  {
    id: 'frpc',
    label: 'frpc 反向代理',
    icon: NetworkIcon,
    path: '/admin/frpc',
    component: FrpcToolPage
  }
] as const satisfies readonly AdminTool[]
