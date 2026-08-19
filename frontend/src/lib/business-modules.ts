import { FileIcon, SettingsIcon, type LucideIcon } from 'lucide-react'

export interface BusinessModule {
  /** 业务入口路由路径(字面量类型,编译期校验;新增业务时扩展为联合) */
  path: '/files' | '/user-setting'
  title: string
  description: string
  icon: LucideIcon
}

export const businessModules: BusinessModule[] = [
  {
    path: '/files',
    title: '我的文件',
    description: '管理你上传的文件',
    icon: FileIcon
  },
  {
    path: '/user-setting',
    title: '用户设置',
    description: '管理账户信息与偏好',
    icon: SettingsIcon
  }
]
