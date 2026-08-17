import { useMutation } from '@tanstack/react-query'
import { RefreshCcwIcon } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { pb } from '@/services/pocketbase'

// 重建索引:health 业务功能(入口与「新建事件」并列于 /health 右上角)。
// 点击先确认(全库重扫、可安全重复执行),确认后调用 POST /api/health/rebuild
// (登录用户),完成后弹窗告知执行结果。
export default function RebuildIndexButton() {
  const [stage, setStage] = useState<'idle' | 'confirm' | 'running' | 'done' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const rebuildMutation = useMutation({
    mutationFn: async () => {
      await pb.send('/api/health/rebuild', { method: 'POST', requestKey: null })
    },
    onSuccess: () => setStage('done'),
    onError: (e) => {
      setErrorMsg(e instanceof Error ? e.message : '未知错误')
      setStage('error')
    }
  })

  const start = () => {
    setStage('running')
    rebuildMutation.mutate()
  }

  const close = () => {
    setStage('idle')
    setErrorMsg('')
  }

  return (
    <>
      <Button variant='outline' size='default' onClick={() => setStage('confirm')}>
        <RefreshCcwIcon className='size-4' /> 重建索引
      </Button>

      {/* 确认对话框 */}
      <Dialog open={stage === 'confirm'} onOpenChange={(v) => !v && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重建引用索引</DialogTitle>
            <DialogDescription className='space-y-1'>
              <p>
                将按全部事件的详述文本重新计算「被关联」列表(清除历史遗留的引用关系)。
              </p>
              <p className='text-muted-foreground'>
                操作在服务端事务内完成,可安全重复执行。
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant='outline' onClick={close}>
              取消
            </Button>
            <Button onClick={start} disabled={stage === 'running'}>
              {stage === 'running' ? '重建中…' : '确认重建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 结果对话框 */}
      <Dialog open={stage === 'done' || stage === 'error'} onOpenChange={(v) => !v && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{stage === 'done' ? '重建完成' : '重建失败'}</DialogTitle>
            <DialogDescription>
              {stage === 'done'
                ? '已按全部事件的详述文本重新生成被关联列表。'
                : `重建失败:${errorMsg}`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={close}>确定</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
