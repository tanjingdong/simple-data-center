import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { formatFileSize, isImageMime } from '@/lib/file-format'
import { cn } from '@/lib/shadcn'
import { errorToast } from '@/lib/toast'
import type { FilestoreFileInfo } from '@/services/api-filestore'
import { downloadFile, getPreviewUrl } from '@/services/api-filestore'
import { format, isValid, parseISO } from 'date-fns'
import { DownloadIcon, FileTextIcon, ImageIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'

// 凭证预览弹窗:点击凭证芯片弹出。
// 图片 → 内联预览(稍大)+ 下载;非图片 → 文件属性 + 下载。
// 元数据由调用方传入(复用既有 useQueries→getFile 查询),不重复请求。
// 芯片外壳由本组件统一渲染;trailing 槽位用于在芯片内追加操作(如编辑页删除按钮)。
export default function FilePreviewDialog({
  fileId,
  file,
  failed = false,
  trailing
}: {
  fileId: string
  file?: FilestoreFileInfo
  failed?: boolean
  trailing?: ReactNode
}) {
  const name = file?.original_name ?? `${fileId.slice(0, 6)}…`
  const image = isImageMime(file?.mime)

  return (
    <div className='bg-muted flex items-center gap-1 rounded-md px-2 py-1 text-xs'>
      {failed ? (
        <span className='text-muted-foreground'>文件已删除</span>
      ) : (
        <Dialog>
          <DialogTrigger asChild>
            <button
              type='button'
              className='focus-visible:ring-ring inline-flex items-center gap-1 rounded underline-offset-2 outline-none hover:underline focus-visible:ring-2'>
              {image ? (
                <ImageIcon className='size-3.5' />
              ) : (
                <FileTextIcon className='size-3.5' />
              )}
              <span className='max-w-40 min-w-0 truncate'>{name}</span>
            </button>
          </DialogTrigger>
          <DialogContent className={image ? 'max-w-3xl' : 'max-w-md'}>
            <DialogHeader className='min-w-0'>
              <DialogTitle className='min-w-0 truncate text-base'>
                {name}
              </DialogTitle>
              <DialogDescription className='sr-only'>
                预览凭证内容并下载
              </DialogDescription>
            </DialogHeader>
            <PreviewBody fileId={fileId} file={file} image={image} />
            <div className='flex justify-center'>
              <DownloadButton fileId={fileId} file={file} />
            </div>
          </DialogContent>
        </Dialog>
      )}
      {trailing}
    </div>
  )
}

// 预览主体:元数据未到显加载态;图片内联;否则属性列表。
function PreviewBody({
  fileId,
  file,
  image
}: {
  fileId: string
  file?: FilestoreFileInfo
  image: boolean
}) {
  if (!file) {
    return (
      <div className='bg-muted/50 flex h-40 items-center justify-center rounded-md'>
        <span className='text-muted-foreground'>加载中…</span>
      </div>
    )
  }
  if (image) return <ImagePreview fileId={fileId} />
  return <FileAttributes file={file} />
}

// 图片内联预览:骨架 → 图片(opacity 渐显) → 加载失败兜底。
// 用 opacity-0 而非 display:none,确保 <img> 在现代浏览器稳定触发 onLoad/onError。
function ImagePreview({ fileId }: { fileId: string }) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  return (
    <div className='bg-muted/50 relative grid min-h-40 place-items-center rounded-md p-2'>
      <img
        src={getPreviewUrl(fileId)}
        alt='凭证预览'
        className={cn(
          'max-h-[70vh] max-w-full rounded object-contain transition-opacity',
          loaded && !error ? 'opacity-100' : 'opacity-0'
        )}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />
      {(error || !loaded) && (
        <span className='text-muted-foreground absolute text-sm'>
          {error ? '图片预览不可用,请下载查看' : '图片加载中…'}
        </span>
      )}
    </div>
  )
}

// 非图片:属性定义列表。
function FileAttributes({ file }: { file: FilestoreFileInfo }) {
  const rows: { label: string; value: string }[] = [
    { label: '文件名', value: file.original_name },
    { label: '类型', value: file.mime || '—' },
    { label: '大小', value: formatFileSize(file.size) },
    {
      label: '上传于',
      value: file.created ? formatTimestamp(file.created) : '—'
    },
    {
      label: '可见性',
      value: file.visibility === 'public' ? '公开' : '私有'
    }
  ]
  return (
    <dl className='divide-border min-w-0 divide-y'>
      {rows.map((r) => (
        <div
          key={r.label}
          className='flex justify-between gap-4 py-1.5 text-sm'>
          <dt className='text-muted-foreground'>{r.label}</dt>
          <dd className='min-w-0 text-right break-all'>{r.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function formatTimestamp(iso: string): string {
  const d = parseISO(iso)
  return isValid(d) ? format(d, 'yyyy-MM-dd HH:mm') : iso
}

// 下载按钮:复用 downloadFile(blob + auth + 文件名);进行中禁用。
function DownloadButton({
  fileId,
  file
}: {
  fileId: string
  file?: FilestoreFileInfo
}) {
  const [pending, setPending] = useState(false)
  const filename = file?.original_name ?? fileId
  const handle = async () => {
    setPending(true)
    try {
      await downloadFile(fileId, filename)
    } catch (err) {
      errorToast('下载失败', err)
    } finally {
      setPending(false)
    }
  }
  return (
    <Button
      type='button'
      variant='outline'
      size='sm'
      disabled={pending}
      onClick={handle}>
      <DownloadIcon className='size-4' />
      {pending ? '下载中…' : '下载'}
    </Button>
  )
}
