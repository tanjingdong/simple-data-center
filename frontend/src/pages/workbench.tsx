import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { ChatButton } from '@/components/workbench/chat-drawer'
import OrganizationDetail from '@/components/workbench/organization-detail'
import OrganizationForm from '@/components/workbench/organization-form'
import PersonDetail from '@/components/workbench/person-detail'
import PersonForm from '@/components/workbench/person-form'
import SearchPanel from '@/components/workbench/search-panel'
import { SearchIcon } from 'lucide-react'
import { useState } from 'react'

export type WorkbenchTarget = {
  type: 'persons' | 'organizations'
  id: string
} | null

// 右侧新建模式(打开对应空表单)
type CreatingMode = 'persons' | 'organizations' | null

export default function WorkbenchPage() {
  const [target, setTarget] = useState<WorkbenchTarget>(null)
  const [creating, setCreating] = useState<CreatingMode>(null)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)

  // 新建/编辑完成后回到空态
  const closeCreating = () => setCreating(null)

  const panel = (
    <SearchPanel
      selectedTarget={target}
      onSelect={(t) => {
        setTarget(t)
        setCreating(null)
        setMobileSearchOpen(false)
      }}
      onAdd={(type) => {
        setTarget(null)
        setCreating(type)
        setMobileSearchOpen(false)
      }}
    />
  )

  return (
    <main className='flex min-h-[calc(100dvh-8rem)] flex-col gap-4 md:flex-row'>
      {/* 窄屏:搜索按钮 + 抽屉 */}
      <div className='md:hidden'>
        <Button
          variant='outline'
          className='w-full'
          onClick={() => setMobileSearchOpen(true)}>
          <SearchIcon className='size-4' /> 搜索人员 / 组织
        </Button>
        <Sheet open={mobileSearchOpen} onOpenChange={setMobileSearchOpen}>
          <SheetContent side='left' className='w-[320px] p-0'>
            {panel}
          </SheetContent>
        </Sheet>
      </div>

      {/* 宽屏:常驻检索栏 */}
      <div className='hidden w-[320px] shrink-0 md:block'>{panel}</div>

      <section className='flex-1 overflow-y-auto'>
        {creating === 'persons' ? (
          <PersonForm onCancel={closeCreating} onSaved={closeCreating} />
        ) : creating === 'organizations' ? (
          <OrganizationForm onCancel={closeCreating} onSaved={closeCreating} />
        ) : target === null ? (
          <EmptyState />
        ) : target.type === 'persons' ? (
          <PersonDetail
            personId={target.id}
            onDeleted={() => setTarget(null)}
          />
        ) : (
          <OrganizationDetail
            orgId={target.id}
            onDeleted={() => setTarget(null)}
          />
        )}
      </section>
      <ChatButton target={target} />
    </main>
  )
}

function EmptyState() {
  return (
    <div className='flex h-full flex-col items-center justify-center gap-2 text-center'>
      <p className='text-muted-foreground text-lg'>
        从左侧检索并选择一个人或组织
      </p>
      <p className='text-muted-foreground text-sm'>
        或点击左上角「新增人员 / 新增组织」开始录入
      </p>
    </div>
  )
}
