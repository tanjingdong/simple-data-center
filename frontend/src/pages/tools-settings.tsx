import { Button } from '@/components/ui/button'
import { errorToast, successToast } from '@/lib/toast'
import {
  FrpcStatus,
  FrpcStatusInfo,
  getFrpcStatus,
  isSuperuserAuthed,
  restartFrpc,
  startFrpc,
  stopFrpc
} from '@/services/api-frpc'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ClientResponseError } from 'pocketbase'

// 状态徽章的展示文案与配色
const statusMeta: Record<FrpcStatus, { label: string; className: string }> = {
  unused: { label: '未启用', className: 'bg-muted text-muted-foreground' },
  starting: { label: '启动中', className: 'bg-yellow-500/20 text-yellow-700' },
  running: { label: '运行中', className: 'bg-green-500/20 text-green-700' },
  stopped: { label: '已停止', className: 'bg-muted text-muted-foreground' },
  failed: { label: '失败', className: 'bg-destructive/20 text-destructive' }
}

export default function ToolsSettingsPage() {
  const queryClient = useQueryClient()
  // 认证状态取自与 admin 后台共享的会话(在 /_/ 登录后即为 superuser)
  const authed = isSuperuserAuthed()

  // 已登录时轮询状态,实时反映启动/停止结果
  const { data: status, error } = useQuery({
    queryKey: ['frpc-status'],
    queryFn: getFrpcStatus,
    enabled: authed,
    refetchInterval: authed ? 3000 : false
  })

  // 会话中途失效(如清库重建后残留旧 token)时回到未登录提示
  const sessionInvalid =
    error instanceof ClientResponseError && error.status === 403

  const controlMutation = useMutation({
    mutationFn: (action: 'start' | 'stop' | 'restart') => {
      if (action === 'start') return startFrpc()
      if (action === 'stop') return stopFrpc()
      return restartFrpc()
    },
    onSuccess: (info: FrpcStatusInfo) => {
      if (info.status === 'failed') {
        errorToast('frpc 启动失败', new Error(info.error ?? '未知错误'))
      } else {
        successToast('操作已提交')
      }
      queryClient.invalidateQueries({ queryKey: ['frpc-status'] })
    },
    onError: (error) => errorToast('操作失败', error)
  })

  const current = status?.status ?? 'unused'
  const isStarting = current === 'starting'
  const isRunning = current === 'running'

  return (
    <div className='flex flex-col gap-6 py-4'>
      <div>
        <h1 className='text-xl font-bold'>工具设置</h1>
        <p className='text-muted-foreground text-sm'>
          系统管理工具。配置项在管理后台(/_/)的 tools_settings 表中维护,
          修改后点击「重启」生效。
        </p>
      </div>

      {!authed || sessionInvalid ? (
        <div className='flex max-w-sm flex-col gap-4 rounded-lg border p-6'>
          <p className='text-sm'>
            {sessionInvalid
              ? '管理员会话已失效,请重新登录。'
              : '请先登录管理员账号后使用本页面。'}
          </p>
          <p className='text-muted-foreground text-xs'>
            登录后回到本页即可直接操作(共用的身份认证,无需再次输入)。
          </p>
          <a href='/_/' target='_blank' rel='noreferrer'>
            <Button>前往管理后台登录</Button>
          </a>
        </div>
      ) : (
        <div className='flex max-w-sm flex-col gap-4'>
          <div className='flex items-center gap-3'>
            <span className='text-sm'>frpc 状态:</span>
            <span
              className={`rounded-full px-3 py-1 text-sm ${statusMeta[current].className}`}>
              {statusMeta[current].label}
            </span>
          </div>

          {status?.error && (
            <p className='text-destructive text-sm'>错误:{status.error}</p>
          )}

          <div className='flex gap-3'>
            <Button
              disabled={isStarting || isRunning || controlMutation.isPending}
              onClick={() => controlMutation.mutate('start')}>
              启动
            </Button>
            <Button
              variant='secondary'
              disabled={
                (!isStarting && !isRunning) || controlMutation.isPending
              }
              onClick={() => controlMutation.mutate('stop')}>
              停止
            </Button>
            <Button
              variant='secondary'
              disabled={isStarting || controlMutation.isPending}
              onClick={() => controlMutation.mutate('restart')}>
              重启
            </Button>
          </div>

          <p className='text-muted-foreground text-xs'>
            提示:在管理后台修改 tools_settings 表后,点击「重启」使新配置生效。
          </p>

          <div>
            <a href='/_/' target='_blank' rel='noreferrer'>
              <Button variant='outline'>打开管理后台</Button>
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
