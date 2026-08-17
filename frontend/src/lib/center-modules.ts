// 数据大厅功能模块注册表:新增功能模块只需在此追加一条(模块名 + 说明 + 路由),
// 数据大厅会自动渲染为苹果风格的方格入口(当前不设图标,后续需要时可在条目中加 icon 字段)。
export interface CenterModule {
  id: string
  label: string
  description: string
  path: string
}

export const centerModules = [
  {
    id: 'tans-pim',
    label: 'tans-PIM',
    description: '联系人、组织与关系管理',
    path: '/tans-PIM'
  },
  {
    id: 'health',
    label: '个人健康信息',
    description: '健康事件聚合记录、归集与就诊参考',
    path: '/health'
  }
] as const satisfies readonly CenterModule[]
