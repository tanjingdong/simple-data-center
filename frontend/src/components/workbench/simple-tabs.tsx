import { cn } from '@/lib/shadcn'
import { useState, type ReactNode } from 'react'

// 轻量 Tab 容器(无第三方依赖,ui/tabs.tsx 未安装):分段按钮组 + useState 切换内容
// 用法:传入 tabs 定义与默认值,children 为接收当前激活值并渲染内容的函数
// (与 shadcn Tabs 语义一致:仅挂载当前 Tab 内容,懒加载查询)
export function SimpleTabs({
  tabs,
  defaultValue,
  value,
  onValueChange,
  children
}: {
  tabs: { value: string; label: string }[]
  defaultValue: string
  value?: string
  onValueChange?: (value: string) => void
  children: (active: string) => ReactNode
}) {
  const [internal, setInternal] = useState(defaultValue)
  // 受控时以 value 为准；非受控仍走内部 state，兼容组织详情等既有调用方
  const active = value ?? internal
  const select = (next: string) => {
    setInternal(next)
    onValueChange?.(next)
  }

  return (
    <div className='flex flex-1 flex-col gap-3'>
      {/* 分段按钮组(等价 TabsList) */}
      <div className='bg-muted/50 flex gap-1 rounded-md border p-1 text-sm'>
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type='button'
            className={cn(
              'flex-1 rounded px-3 py-1.5 transition-colors',
              active === tab.value
                ? 'bg-background font-medium shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => select(tab.value)}>
            {tab.label}
          </button>
        ))}
      </div>
      {/* Tab 内容区(等价 TabsContent) */}
      <div className='flex-1'>{children(active)}</div>
    </div>
  )
}
