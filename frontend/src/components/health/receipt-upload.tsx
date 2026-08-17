import { FileTextIcon, ImageIcon, TrashIcon, UploadIcon } from 'lucide-react'
import { useRef } from 'react'
import { Button } from '@/components/ui/button'

// 凭证多文件上传:既有文件(文件名,展示链接/缩略入口)+ 新增文件(本地预览)。
// 删除操作通过 onExistingChange / onFilesChange 回调同步到表单状态。
export default function ReceiptUpload({
  eventId,
  existing,
  files,
  onExistingChange,
  onFilesChange
}: {
  eventId?: string
  existing: string[]
  files: File[]
  onExistingChange: (names: string[]) => void
  onFilesChange: (files: File[]) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  const addFiles = (list: FileList | null) => {
    if (!list) return
    onFilesChange([...files, ...Array.from(list)])
  }

  return (
    <div className='space-y-2'>
      <div className='flex flex-wrap gap-2'>
        {existing.map((name) => (
          <div
            key={name}
            className='bg-muted flex items-center gap-1 rounded-md px-2 py-1 text-xs'>
            <FileTextIcon className='size-3.5' />
            <a
              className='underline underline-offset-2'
              href={`/api/files/health_events/${eventId}/${encodeURIComponent(name)}`}
              target='_blank'
              rel='noreferrer'>
              {name}
            </a>
            <Button
              variant='ghost'
              size='icon'
              className='size-5'
              onClick={() => onExistingChange(existing.filter((n) => n !== name))}>
              <TrashIcon className='size-3.5' />
            </Button>
          </div>
        ))}
        {files.map((f, i) => (
          <div
            key={`${f.name}-${i}`}
            className='bg-muted flex items-center gap-1 rounded-md px-2 py-1 text-xs'>
            {f.type.startsWith('image/') ? <ImageIcon className='size-3.5' /> : <FileTextIcon className='size-3.5' />}
            <span className='max-w-40 truncate'>{f.name}</span>
            <Button
              variant='ghost'
              size='icon'
              className='size-5'
              onClick={() => onFilesChange(files.filter((_, j) => j !== i))}>
              <TrashIcon className='size-3.5' />
            </Button>
          </div>
        ))}
      </div>
      <input
        ref={inputRef}
        type='file'
        accept='image/jpeg,image/png,image/webp,application/pdf'
        multiple
        className='hidden'
        onChange={(e) => {
          addFiles(e.target.files)
          e.target.value = ''
        }}
      />
      <Button type='button' variant='outline' size='sm' onClick={() => inputRef.current?.click()}>
        <UploadIcon className='size-4' /> 添加凭证(图片/PDF,最多 10 个)
      </Button>
    </div>
  )
}
