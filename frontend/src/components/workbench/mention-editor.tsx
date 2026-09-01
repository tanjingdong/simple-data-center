import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Mention from '@tiptap/extension-mention'
import { PluginKey } from '@tiptap/pm/state'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { buildInitialContent, htmlToTokenText } from '@/lib/mention-serialize'
import {
  emptyPersonFilters,
  personsQueryOptions
} from '@/services/api-persons'
import {
  emptyOrganizationFilters,
  organizationsQueryOptions
} from '@/services/api-organizations'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'

// 候选项统一结构:kind p=人 / o=组织
type Candidate = { kind: 'p' | 'o'; id: string; label: string }

// @ 提及 suggestion 插件的 plugin key(选中时据此取整个 @query 选区替换)
const mentionPluginKey = new PluginKey('event-mention-suggest')

// Mention 扩展:默认只带 id/label,补一个 kind(p=人 / o=组织)属性,
// 序列化时输出 data-kind,供 htmlToTokenText 反解出 token。
const MentionWithKind = Mention.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      kind: {
        default: null as string | null,
        parseHTML: (element) => element.getAttribute('data-kind'),
        renderHTML: (attributes) =>
          attributes.kind ? { 'data-kind': attributes.kind } : {}
      }
    }
  }
})

// @提及编辑器:输 @ 弹候选(人/组织),选中插入 mention node;
// 序列化为 [[p|o:id|名]] 文本回吐 onChange(与 splitSummary 对称)。
//
// 焦点/IME 关键设计:候选浮层用 Radix Popover 但 **不抢焦点**——
//  - onOpenAutoFocus/onCloseAutoFocus 阻止 Radix 把焦点移到浮层;
//  - 浮层里不放输入框(查询词来自编辑器内的 @query,经 suggestion.onUpdate 流入),
//    避免 cmdk 的 CommandInput 抢焦点——否则每输入一字 Radix 重抢焦点、
//    且中文 IME 合成被焦点跳转打断。
export default function MentionEditor({
  value,
  onChange
}: {
  value: string
  onChange(v: string): void
}) {
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [query, setQuery] = useState('')
  // 记录已应用到编辑器的 value,避免受控回灌时反复 setContent
  const lastValueRef = useRef(value)

  const { data: persons } = useQuery(
    personsQueryOptions({ ...emptyPersonFilters, query })
  )
  const { data: orgs } = useQuery(
    organizationsQueryOptions(emptyOrganizationFilters)
  )

  // extensions 用 useMemo 固定引用,避免每次渲染让 useEditor 重新配置编辑器
  // (contenteditable 被重建会丢焦点 + 打断 IME)。
  const extensions = useMemo(
    () => [
      StarterKit,
      MentionWithKind.configure({
        HTMLAttributes: { class: 'bg-muted rounded px-1' },
        suggestion: {
          char: '@',
          pluginKey: mentionPluginKey,
          render: () => ({
            onStart: () => setSuggestOpen(true),
            onUpdate: ({ query: q }) => {
              setQuery(q)
              setSuggestOpen(true)
            },
            onExit: () => {
              setSuggestOpen(false)
              setQuery('')
            }
          })
        }
      })
    ],
    []
  )

  const editor = useEditor({
    extensions,
    content: buildInitialContent(value),
    onUpdate: ({ editor }) => {
      // 序列化:把 mention 节点转成 [[kind:id|label]] 文本,普通文本原样
      const text = htmlToTokenText(editor.getHTML())
      lastValueRef.current = text
      onChange(text)
    }
  })

  // value 变化时重新加载(编辑模式回灌),不触发 onChange
  useEffect(() => {
    if (!editor || value === lastValueRef.current) return
    lastValueRef.current = value
    editor.commands.setContent(buildInitialContent(value), { emitUpdate: false })
  }, [editor, value])

  const candidates: Candidate[] = [
    ...(persons ?? []).map((p) => ({
      kind: 'p' as const,
      id: p.id,
      label: `${p.last_name}${p.first_name}`
    })),
    ...(orgs ?? []).map((o) => ({ kind: 'o' as const, id: o.id, label: o.name }))
  ].filter((c) => c.label.includes(query))

  const insertMention = (c: Candidate) => {
    if (!editor) return
    const state = mentionPluginKey.getState(editor.state)
    if (state?.active && state.range) {
      // suggestion 激活中:整体替换 @query 选区(与插件默认 command 行为一致)
      editor
        .chain()
        .focus()
        .insertContentAt(state.range, [
          { type: 'mention', attrs: { id: c.id, label: c.label, kind: c.kind } },
          { type: 'text', text: ' ' }
        ])
        .run()
    } else {
      editor
        .chain()
        .focus()
        .insertContent({
          type: 'mention',
          attrs: { id: c.id, label: c.label, kind: c.kind }
        })
        .insertContent(' ')
        .run()
    }
    setSuggestOpen(false)
    setQuery('')
  }

  return (
    <Popover open={suggestOpen} onOpenChange={setSuggestOpen}>
      {/* PopoverAnchor 锚到编辑器,浮层定位到编辑器下方(无锚点会飘到视口左上角不可见)。
          asChild 包外层 div:该 div 既是单层边框容器,又是浮层锚点。 */}
      <PopoverAnchor asChild>
        <div className='border-input bg-background rounded-md border text-sm'>
          <EditorContent
            editor={editor}
            className='[&_.ProseMirror]:min-h-20 [&_.ProseMirror]:p-2 [&_.ProseMirror]:outline-none'
          />
        </div>
      </PopoverAnchor>
      {/* onOpenAutoFocus/onCloseAutoFocus 阻止抢焦点:编辑器保持焦点、IME 不被打断。
          键盘输入不触发 focus/interact-outside(只有指针/焦点移动才触发),故无需额外阻止,
          点击外部自然关闭、suggestion.onExit 与 insertMention 也会关闭。 */}
      <PopoverContent
        className='w-72 p-1'
        align='start'
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}>
        {candidates.length === 0 ? (
          <p className='text-muted-foreground px-2 py-1.5 text-xs'>无匹配</p>
        ) : (
          <ul className='max-h-60 overflow-auto'>
            {candidates.map((c) => (
              <li key={`${c.kind}:${c.id}`}>
                <button
                  type='button'
                  onClick={() => insertMention(c)}
                  className='hover:bg-accent flex w-full items-center gap-1.5 rounded-sm px-2 py-1.5 text-left'>
                  <span className='text-muted-foreground text-xs'>
                    {c.kind === 'p' ? '人' : '组'}
                  </span>
                  {c.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  )
}
