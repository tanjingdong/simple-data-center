import {
  ContactIcon,
  FileIcon,
  HeartPulseIcon,
  SettingsIcon,
  type LucideIcon
} from 'lucide-react'

export interface BusinessModule {
  /** 业务入口路由路径(字面量类型,编译期校验;新增业务时扩展为联合) */
  path: '/social' | '/health' | '/files' | '/user-setting'
  title: string
  description: string
  icon: LucideIcon
}

// 数据大厅业务入口注册表:新增业务只需在此追加一项(路由 path、名称、说明、图标)。
// 顺序即数据大厅展示顺序;path 为字面量联合,与 router.tsx 的路由一一对应,
// TanStack Router 据此对 <Link to> 做编译期类型校验。
export const businessModules: BusinessModule[] = [
  {
    path: '/social',
    title: '联系人管理',
    description: '联系人、组织与关系管理',
    icon: ContactIcon
  },
  {
    path: '/health',
    title: '健康信息管理',
    description: '健康事件聚合记录、归集与就诊参考',
    icon: HeartPulseIcon
  },
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
