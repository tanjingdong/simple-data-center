import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { errorToast, successToast } from '@/lib/toast'
import { copyText } from '@/services/api-filestore'
import {
  deleteMyToken,
  generateMyToken,
  getMyTokenStatus
} from '@/services/api-usertoken'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ClientResponseError } from 'pocketbase'
import { useState } from 'react'

function formatDate(dateStr?: string) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function errMessage(error: unknown) {
  return error instanceof ClientResponseError
    ? error.response?.error || error.message
    : String(error)
}

export default function ApiTokenCard() {
  const queryClient = useQueryClient()
  const [plainToken, setPlainToken] = useState<string | null>(null)

  const {
    data: status,
    isLoading,
    error
  } = useQuery({
    queryKey: ['my-token-status'],
    queryFn: getMyTokenStatus
  })

  const generateMutation = useMutation({
    mutationFn: generateMyToken,
    onSuccess: (data) => {
      setPlainToken(data.token)
      successToast('令牌已生成')
      queryClient.invalidateQueries({ queryKey: ['my-token-status'] })
    },
    onError: (e) => errorToast('生成令牌失败', errMessage(e))
  })

  const deleteMutation = useMutation({
    mutationFn: deleteMyToken,
    onSuccess: () => {
      successToast('令牌已删除')
      queryClient.invalidateQueries({ queryKey: ['my-token-status'] })
    },
    onError: (e) => errorToast('删除令牌失败', errMessage(e))
  })

  const handleGenerate = () => {
    if (status?.has_token && !confirm('重置后旧令牌将立即失效，确定继续吗？')) {
      return
    }
    generateMutation.mutate()
  }

  const handleDelete = () => {
    if (!confirm('删除后使用该令牌的外部应用将无法访问，确定删除吗？')) {
      return
    }
    deleteMutation.mutate()
  }

  return (
    <Card className='w-full'>
      <CardHeader>
        <CardTitle>API 令牌</CardTitle>
        <CardDescription>
          令牌可供外部应用以你的身份调用本应用的公开
          API。令牌等同于你的登录凭据，请妥善保管。
        </CardDescription>
      </CardHeader>
      <CardContent className='flex flex-col gap-4'>
        {isLoading && (
          <p className='text-muted-foreground text-sm'>加载中...</p>
        )}
        {error && <p className='text-destructive text-sm'>加载令牌状态失败</p>}
        {status && !status.enabled && (
          <p className='text-muted-foreground text-sm'>
            管理员尚未开启 API 令牌功能。
          </p>
        )}
        {status && status.enabled && !status.has_token && (
          <div className='flex flex-col gap-2'>
            <p className='text-muted-foreground text-sm'>尚未生成令牌。</p>
            <Button
              className='w-fit'
              onClick={handleGenerate}
              disabled={generateMutation.isPending}>
              生成令牌
            </Button>
          </div>
        )}
        {status && status.enabled && status.has_token && (
          <div className='flex flex-col gap-3'>
            <div className='text-sm'>
              <div>创建时间：{formatDate(status.created_at)}</div>
              <div>最后使用：{formatDate(status.last_used_at)}</div>
              <div>
                状态：
                {status.admin_disabled ? '已被管理员禁用' : '正常'}
              </div>
            </div>
            <div className='flex gap-2'>
              <Button
                variant='secondary'
                onClick={handleGenerate}
                disabled={generateMutation.isPending}>
                重置令牌
              </Button>
              <Button
                variant='destructive'
                onClick={handleDelete}
                disabled={deleteMutation.isPending}>
                删除令牌
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      <Dialog
        open={plainToken !== null}
        onOpenChange={(open) => {
          if (!open) setPlainToken(null)
        }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>请保存你的 API 令牌</DialogTitle>
            <DialogDescription>
              此令牌仅显示一次，关闭后无法再次查看。请立即复制并妥善保存。
            </DialogDescription>
          </DialogHeader>
          <code className='bg-muted block rounded p-3 text-sm break-all'>
            {plainToken}
          </code>
          <DialogFooter>
            <Button
              onClick={() => {
                if (plainToken) copyText(plainToken)
                successToast('已复制到剪贴板')
              }}>
              复制令牌
            </Button>
            <Button variant='secondary' onClick={() => setPlainToken(null)}>
              我已保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
