import { Button } from '@/components/ui/button'
import { errorToast } from '@/lib/toast'
import {
  deleteFile,
  getDownloadUrl,
  getFile,
  uploadFile
} from '@/services/api-filestore'
import { useQueries } from '@tanstack/react-query'
import { FileTextIcon, TrashIcon, UploadIcon } from 'lucide-react'
import { useRef, useState } from 'react'

// 凭证上传与展示组件:选文件即时上传到 filestore(public),展示已上传凭证,
// 下载走 filestore 直链,删除调 filestore。receipt 为 filestore_files 记录 ID 数组。
export default function ReceiptUpload({
  receiptIds,
  onChange,
  accept = 'image/jpeg,image/png,image/webp,application/pdf'
}: {
  receiptIds: string[]
  onChange: (ids: string[]) => void
  accept?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  // 并行拉取每个凭证的元数据(展示 original_name);失败显示「文件已删除」占位
  const fileQueries = useQueries({
    queries: receiptIds.map((id) => ({
      queryKey: ['filestore', 'file', id],
      queryFn: () => getFile(id),
      retry: false,
      staleTime: 60 * 1000
    }))
  })

  const handleAdd = async (list: FileList | null) => {
    if (!list || list.length === 0) return
    setUploading(true)
    try {
      const uploaded: string[] = []
      for (let i = 0; i < list.length; i++) {
        const result = await uploadFile(list[i], 'public')
        uploaded.push(result.id)
      }
      onChange([...receiptIds, ...uploaded])
    } catch (err) {
      // 上传失败不写入 receiptIds;把后端错误透传给用户
      errorToast('凭证上传失败', err)
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const handleRemove = async (id: string) => {
    try {
      await deleteFile(id)
    } catch (err) {
      // 删除失败:仍从本地状态移除,避免悬挂;后端孤儿对账兜底;提示用户
      errorToast('凭证删除失败', err)
    }
    onChange(receiptIds.filter((x) => x !== id))
  }

  return (
    <div className='space-y-2'>
      <div className='flex flex-wrap gap-2'>
        {receiptIds.map((id, i) => {
          const q = fileQueries[i]
          const failed = q?.isError
          return (
            <div
              key={id}
              className='bg-muted flex items-center gap-1 rounded-md px-2 py-1 text-xs'>
              <FileTextIcon className='size-3.5' />
              {failed ? (
                <span className='text-muted-foreground'>文件已删除</span>
              ) : (
                <a
                  className='underline underline-offset-2'
                  href={getDownloadUrl(id)}
                  target='_blank'
                  rel='noreferrer'>
                  {q?.data?.original_name ?? id}
                </a>
              )}
              <Button
                variant='ghost'
                size='icon'
                className='size-5'
                onClick={() => handleRemove(id)}>
                <TrashIcon className='size-3.5' />
              </Button>
            </div>
          )
        })}
      </div>
      <input
        ref={inputRef}
        type='file'
        accept={accept}
        multiple
        className='hidden'
        onChange={(e) => {
          void handleAdd(e.target.files)
          e.target.value = ''
        }}
      />
      <Button
        type='button'
        variant='outline'
        size='sm'
        disabled={uploading}
        onClick={() => inputRef.current?.click()}>
        <UploadIcon className='size-4' />
        {uploading ? '上传中…' : '添加凭证(图片/PDF,最多 10 个)'}
      </Button>
    </div>
  )
}
