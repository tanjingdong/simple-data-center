import { buildPersonCandidateDisplay } from '@/lib/person-candidate'
import type { PersonWithOrg } from '@/services/api-persons'
import { TriangleAlertIcon } from 'lucide-react'

// 联系人编辑页的重复录入警示:仅命中时显示;
// 行信息「姓名 (昵称) 单位 · 手机」,点击在新标签页打开对方详情,
// 编辑页与已填内容完全不动(不使用站内跳转,避免丢失未保存输入)。
export default function DuplicatePersonHint({
  persons
}: {
  persons: PersonWithOrg[]
}) {
  if (persons.length === 0) return null

  return (
    <div className='rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm dark:border-amber-800 dark:bg-amber-950/40'>
      <p className='flex items-center gap-1.5 font-medium text-amber-900 dark:text-amber-200'>
        <TriangleAlertIcon className='size-4 shrink-0' />
        发现 {persons.length} 个可能的重复联系人
      </p>
      <ul className='mt-1 space-y-0.5'>
        {persons.map((p) => {
          const d = buildPersonCandidateDisplay(p)
          return (
            <li key={p.id}>
              <a
                href={`/social?person=${encodeURIComponent(p.id)}`}
                target='_blank'
                rel='noreferrer'
                title='在新标签页查看该联系人'
                className='flex w-full min-w-0 items-center rounded-sm px-1 py-0.5 text-left hover:bg-amber-100 dark:hover:bg-amber-900/40'>
                <span className='shrink-0 font-medium'>{d.label}</span>
                {d.nickname && (
                  <span className='text-muted-foreground ml-1 shrink-0 text-xs'>
                    ({d.nickname})
                  </span>
                )}
                {d.orgName && (
                  <span className='text-muted-foreground ml-2 min-w-0 flex-1 truncate text-xs'>
                    {d.orgName}
                  </span>
                )}
                {p.mobile && (
                  <span className='text-muted-foreground ml-2 shrink-0 text-xs'>
                    {p.mobile}
                  </span>
                )}
              </a>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
