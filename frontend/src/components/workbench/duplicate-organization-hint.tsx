import { Button } from '@/components/ui/button'
import type { Organization } from '@/schemas/organization-schema'
import { TriangleAlertIcon } from 'lucide-react'

// 组织编辑页的重复录入警示:仅命中时显示;
// 行信息「名称 · 类型 · 电话」,点击在新标签页打开对方详情,
// 编辑页与已填内容完全不动(不使用站内跳转,避免丢失未保存输入)。
// 检测本身即「trim 后名称完全相等」,编辑模式(canMerge)下每行提供「合并信息」入口;
// 新建模式不传 canMerge,因此不出现合并入口。
export default function DuplicateOrganizationHint({
  orgs,
  canMerge = false,
  onMerge
}: {
  orgs: Organization[]
  canMerge?: boolean
  onMerge(org: Organization): void
}) {
  if (orgs.length === 0) return null

  return (
    <div className='rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm dark:border-amber-800 dark:bg-amber-950/40'>
      <p className='flex items-center gap-1.5 font-medium text-amber-900 dark:text-amber-200'>
        <TriangleAlertIcon className='size-4 shrink-0' />
        发现 {orgs.length} 个可能的重复组织
      </p>
      <ul className='mt-1 space-y-0.5'>
        {orgs.map((org) => (
          <li key={org.id} className='flex items-center gap-1'>
            <a
              href={`/social?org=${encodeURIComponent(org.id)}`}
              target='_blank'
              rel='noreferrer'
              title='在新标签页查看该组织'
              className='flex min-w-0 flex-1 items-center rounded-sm px-1 py-0.5 text-left hover:bg-amber-100 dark:hover:bg-amber-900/40'>
              <span className='shrink-0 font-medium'>{org.name}</span>
              {org.type && (
                <>
                  <span className='text-muted-foreground mx-1 shrink-0 text-xs'>
                    ·
                  </span>
                  <span className='text-muted-foreground min-w-0 truncate text-xs'>
                    {org.type}
                  </span>
                </>
              )}
              {org.phone && (
                <>
                  <span className='text-muted-foreground mx-1 shrink-0 text-xs'>
                    ·
                  </span>
                  <span className='text-muted-foreground shrink-0 text-xs'>
                    {org.phone}
                  </span>
                </>
              )}
            </a>
            {canMerge && (
              <Button
                type='button'
                variant='outline'
                size='sm'
                className='h-7 shrink-0 px-2 text-xs'
                title='将当前编辑的组织与该组织合并'
                onClick={() => onMerge(org)}>
                合并信息
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
