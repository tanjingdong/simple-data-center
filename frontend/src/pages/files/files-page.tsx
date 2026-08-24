import { Button } from '@/components/ui/button'
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { errorToast, successToast } from '@/lib/toast'
import {
  deleteFile,
  downloadFile,
  listFiles,
  updateFileVisibility,
  uploadFile
} from '@/services/api-filestore'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ClientResponseError } from 'pocketbase'
import { DownloadIcon, GlobeIcon, LockIcon, Trash2Icon, UploadIcon } from 'lucide-react'
import { useRef, useState } from 'react'

export default function FilesPage() {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['my-files'],
    queryFn: () => listFiles({ filter: 'my', per_page: 50 })
  })

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadFile(file, 'private'),
    onSuccess: () => {
      successToast('文件上传成功')
      queryClient.invalidateQueries({ queryKey: ['my-files'] })
    },
    onError: (error) => {
      const msg = error instanceof ClientResponseError
        ? error.response?.error || error.message
        : error
      errorToast('上传失败', msg)
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteFile(id),
    onSuccess: () => {
      successToast('文件已删除')
      queryClient.invalidateQueries({ queryKey: ['my-files'] })
    },
    onError: (error) => {
      const msg = error instanceof ClientResponseError
        ? error.response?.error || error.message
        : error
      errorToast('删除失败', msg)
    }
  })

  const visibilityMutation = useMutation({
    mutationFn: ({ id, visibility }: { id: string; visibility: 'public' | 'private' }) =>
      updateFileVisibility(id, visibility),
    onSuccess: () => {
      successToast('可见性已更新')
      queryClient.invalidateQueries({ queryKey: ['my-files'] })
    },
    onError: (error) => {
      const msg = error instanceof ClientResponseError
        ? error.response?.error || error.message
        : error
      errorToast('更新失败', msg)
    }
  })

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    setUploading(true)
    try {
      for (let i = 0; i < files.length; i++) {
        await uploadMutation.mutateAsync(files[i])
      }
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  if (isLoading) {
    return (
      <main className='mx-auto flex w-full max-w-4xl flex-col items-center gap-y-6 px-4 py-8'>
        <p className='text-muted-foreground'>加载中...</p>
      </main>
    )
  }

  const files = data?.items ?? []

  return (
    <main className='mx-auto flex w-full max-w-4xl flex-col gap-y-6 px-4 py-8'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold'>我的文件</h1>
          <p className='text-muted-foreground text-sm'>
            管理你上传的文件，共 {files.length} 个
          </p>
        </div>
        <div className='flex gap-2'>
          <input
            ref={fileInputRef}
            type='file'
            multiple
            onChange={handleUpload}
            className='hidden'
            id='file-upload-input'
          />
          <Button
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}>
            <UploadIcon className='mr-1 size-4' />
            {uploading ? '上传中...' : '上传文件'}
          </Button>
        </div>
      </div>

      {files.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>暂无文件</CardTitle>
            <CardDescription>
              点击右上角「上传文件」按钮上传你的第一个文件。
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className='space-y-2'>
          {files.map((file) => (
            <Card key={file.id} className='hover:border-foreground/30 transition'>
              <div className='flex items-center gap-4 p-4'>
                {/* 文件图标 */}
                <div className='bg-muted flex size-10 shrink-0 items-center justify-center rounded-lg text-sm'>
                  {getFileIcon(file.mime)}
                </div>

                {/* 文件信息 */}
                <div className='min-w-0 flex-1'>
                  <div className='flex items-center gap-2'>
                    <span className='truncate font-medium'>{file.original_name}</span>
                    <button
                      onClick={() =>
                        visibilityMutation.mutate({
                          id: file.id,
                          visibility: file.visibility === 'public' ? 'private' : 'public'
                        })
                      }
                      className='shrink-0'
                      title={file.visibility === 'public' ? '当前公开，点击设为私有' : '当前私有，点击设为公开'}>
                      {file.visibility === 'public' ? (
                        <GlobeIcon className='size-3.5 text-green-600' />
                      ) : (
                        <LockIcon className='size-3.5 text-muted-foreground' />
                      )}
                    </button>
                  </div>
                  <div className='text-muted-foreground flex items-center gap-3 text-xs'>
                    <span>{formatSize(file.size)}</span>
                    <span>{file.mime}</span>
                    <span>{formatDate(file.created)}</span>
                  </div>
                </div>

                {/* 操作按钮 */}
                <div className='flex shrink-0 gap-1'>
                  <Button
                    variant='ghost'
                    size='sm'
                    className='size-8 p-0'
                    title='下载'
                    onClick={() => {
                      downloadFile(file.id, file.original_name).catch((err) =>
                        errorToast('下载失败', err)
                      )
                    }}>
                    <DownloadIcon className='size-4' />
                  </Button>
                  <Button
                    variant='ghost'
                    size='sm'
                    className='size-8 p-0 text-destructive hover:text-destructive'
                    title='删除'
                    onClick={() => {
                      if (confirm('确定要删除这个文件吗？')) {
                        deleteMutation.mutate(file.id)
                      }
                    }}>
                    <Trash2Icon className='size-4' />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </main>
  )
}

function getFileIcon(mime: string): string {
  if (mime.startsWith('image/')) return '🖼'
  if (mime.startsWith('video/')) return '🎬'
  if (mime.startsWith('audio/')) return '🎵'
  if (mime.includes('pdf')) return '📄'
  if (mime.includes('zip') || mime.includes('rar') || mime.includes('7z')) return '📦'
  if (mime.includes('text') || mime.includes('json') || mime.includes('xml')) return '📝'
  return '📎'
}