import { Link } from '@tanstack/react-router'
import { PaperclipIcon, PencilIcon, TrashIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { HealthEvent } from '@/schemas/health-event-schema'

// 事件表格:时间/类型/科属/项目/结论/凭证 + 操作
export default function EventTable({
  events,
  onDelete,
  emptyHint = '暂无事件,点击「新建事件」开始记录。'
}: {
  events: HealthEvent[]
  onDelete: (e: HealthEvent) => void
  emptyHint?: string
}) {
  if (events.length === 0) {
    return <p className='text-muted-foreground py-12 text-center'>{emptyHint}</p>
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>时间</TableHead>
          <TableHead>类型</TableHead>
          <TableHead>科属</TableHead>
          <TableHead>项目</TableHead>
          <TableHead>结论</TableHead>
          <TableHead className='w-14'>凭证</TableHead>
          <TableHead className='w-28'>操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {events.map((e) => (
          <TableRow key={e.id}>
            <TableCell className='whitespace-nowrap'>{e.happen_at}</TableCell>
            <TableCell>{e.event_type}</TableCell>
            <TableCell>{e.department}</TableCell>
            <TableCell>{e.item}</TableCell>
            <TableCell className='max-w-[320px] truncate'>{e.conclusion}</TableCell>
            <TableCell>
              {e.receipt.length > 0 && <PaperclipIcon className='text-muted-foreground size-4' />}
            </TableCell>
            <TableCell>
              <div className='flex gap-1'>
                <Button asChild variant='ghost' size='sm'>
                  <Link to='/health/events/$eventId' params={{ eventId: e.id }}>
                    详情
                  </Link>
                </Button>
                <Button asChild variant='ghost' size='icon'>
                  <Link to='/health/events/$eventId/edit' params={{ eventId: e.id }}>
                    <PencilIcon className='size-4' />
                  </Link>
                </Button>
                <Button variant='ghost' size='icon' onClick={() => onDelete(e)}>
                  <TrashIcon className='size-4' />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
