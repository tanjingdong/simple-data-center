import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import {
  appendChatMessage,
  ChatMessage,
  clearChatMessages,
  loadChatMessages
} from '@/lib/chat'
import type { WorkbenchTarget } from '@/pages/workbench'
import { organizationDetailQueryOptions } from '@/services/api-organizations'
import { personDetailQueryOptions } from '@/services/api-persons'
import { useQuery } from '@tanstack/react-query'
import { MessageSquareIcon, SendIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

// 对话抽屉入口(右下角悬浮)
export function ChatButton({ target }: { target: WorkbenchTarget }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>(loadChatMessages)
  const [draft, setDraft] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages, open])

  const send = () => {
    const content = draft.trim()
    if (!content) return
    const msg: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      role: 'user',
      content,
      createdAt: new Date().toISOString()
    }
    setMessages((prev) => appendChatMessage(prev, msg))
    setDraft('')
  }

  // 按当前对象类型取详情名(非 Suspense;未选中 target 时 enabled=false 不发请求)
  const personQuery = useQuery({
    ...personDetailQueryOptions(target?.id ?? ''),
    enabled: target?.type === 'persons'
  })
  const orgQuery = useQuery({
    ...organizationDetailQueryOptions(target?.id ?? ''),
    enabled: target?.type === 'organizations'
  })

  // 当前查看对象上下文条:命中时显示姓名,查询未返回(加载中/失败)回退类型 + #id
  let contextLabel = '未选择对象'
  if (target?.type === 'persons') {
    const person = personQuery.data
    contextLabel = person
      ? `${person.last_name}${person.first_name}`
      : `人员 #${target.id}`
  } else if (target?.type === 'organizations') {
    const org = orgQuery.data
    contextLabel = org ? org.name : `组织 #${target.id}`
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          size='icon'
          className='fixed right-6 bottom-6 z-40 rounded-full shadow-lg'
          aria-label='打开对话'>
          <MessageSquareIcon className='size-5' />
        </Button>
      </SheetTrigger>
      <SheetContent side='right' className='flex w-[380px] flex-col gap-3 sm:w-[420px]'>
        <SheetHeader className='border-b pb-2'>
          <SheetTitle>对话</SheetTitle>
          <p className='text-muted-foreground text-xs'>
            正在查看:{contextLabel}
          </p>
        </SheetHeader>
        <div ref={listRef} className='flex-1 space-y-3 overflow-y-auto py-2'>
          {messages.length === 0 && (
            <p className='text-muted-foreground pt-8 text-center text-sm'>
              记录您的观察、想法与待办(本地保存,尚未接入大模型)
            </p>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={
                msg.role === 'user'
                  ? 'flex justify-end'
                  : 'flex justify-start'
              }>
              <div
                className={
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground max-w-[80%] rounded-2xl rounded-br-sm px-3 py-2 text-sm'
                    : 'bg-muted max-w-[80%] rounded-2xl rounded-bl-sm px-3 py-2 text-sm'
                }>
                {msg.content}
              </div>
            </div>
          ))}
        </div>
        <div className='flex gap-2 border-t pt-2'>
          <Input
            placeholder='输入内容…'
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) send()
            }}
          />
          <Button size='icon' aria-label='发送' onClick={send}>
            <SendIcon className='size-4' />
          </Button>
        </div>
        <Button
          variant='ghost'
          size='sm'
          className='self-end'
          onClick={() => {
            clearChatMessages()
            setMessages([])
          }}>
          清空记录
        </Button>
      </SheetContent>
    </Sheet>
  )
}
