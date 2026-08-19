import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { errorToast } from '@/lib/toast'
import {
  deleteFile,
  listFiles,
  uploadFile
} from '@/services/api-filestore'
import { useQuery } from '@tanstack/react-query'
import { useRef, useState } from 'react'

interface FilePickerProps {
  mode: 'upload' | 'select' | 'both'
  visibility?: 'private' | 'public'
  value?: string[]
  onChange?: (fileIds: string[]) => void
  accept?: string
  multiple?: boolean
}

export default function FilePicker({
  mode,
  visibility = 'private',
  value = [],
  onChange,
  accept,
  multiple = false
}: FilePickerProps) {
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: fileList, refetch: refetchFiles } = useQuery({
    queryKey: ['filestore-files', 'my'],
    queryFn: () => listFiles({ filter: 'my', per_page: 50 }),
    enabled: mode === 'select' || mode === 'both'
  })

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return

    setUploading(true)
    try {
      const uploadedIds: string[] = []
      for (let i = 0; i < files.length; i++) {
        const result = await uploadFile(files[i], visibility)
        uploadedIds.push(result.id)
      }
      const newIds = multiple ? [...value, ...uploadedIds] : [uploadedIds[uploadedIds.length - 1]]
      onChange?.(newIds)
      refetchFiles()
    } catch (err) {
      errorToast('上传失败', err)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSelect = (fileId: string) => {
    const isSelected = value.includes(fileId)
    let newIds: string[]
    if (multiple) {
      newIds = isSelected
        ? value.filter((id) => id !== fileId)
        : [...value, fileId]
    } else {
      newIds = isSelected ? [] : [fileId]
    }
    onChange?.(newIds)
  }

  const handleDelete = async (fileId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await deleteFile(fileId)
      onChange?.(value.filter((id) => id !== fileId))
      refetchFiles()
    } catch (err) {
      errorToast('删除失败', err)
    }
  }

  const showUpload = mode === 'upload' || mode === 'both'
  const showSelect = mode === 'select' || mode === 'both'

  return (
    <div className='flex flex-col gap-4'>
      {showUpload && (
        <div>
          <input
            ref={fileInputRef}
            type='file'
            accept={accept}
            multiple={multiple}
            onChange={handleUpload}
            className='hidden'
            id='file-picker-upload'
          />
          <Button
            variant='outline'
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}>
            {uploading ? '上传中...' : '上传文件'}
          </Button>
        </div>
      )}

      {showSelect && fileList?.items && (
        <div className='grid gap-2 sm:grid-cols-2'>
          {fileList.items.map((file) => {
            const isSelected = value.includes(file.id)
            return (
              <Card
                key={file.id}
                className={`cursor-pointer transition ${
                  isSelected
                    ? 'border-primary ring-primary/30 ring-2'
                    : 'hover:border-foreground/30'
                }`}
                onClick={() => handleSelect(file.id)}>
                <CardHeader className='p-3'>
                  <div className='flex items-start justify-between'>
                    <div className='min-w-0 flex-1'>
                      <CardTitle className='truncate text-sm'>
                        {file.original_name}
                      </CardTitle>
                      <CardDescription className='text-xs'>
                        {(file.size / 1024).toFixed(1)} KB ·{' '}
                        {file.visibility === 'public' ? '公开' : '私有'}
                      </CardDescription>
                    </div>
                    <Button
                      variant='ghost'
                      size='sm'
                      className='size-6 p-0 text-destructive'
                      onClick={(e) => handleDelete(file.id, e)}>
                      ×
                    </Button>
                  </div>
                </CardHeader>
              </Card>
            )
          })}
          {fileList.items.length === 0 && (
            <p className='text-muted-foreground col-span-full py-4 text-center text-sm'>
              暂无文件
            </p>
          )}
        </div>
      )}
    </div>
  )
}