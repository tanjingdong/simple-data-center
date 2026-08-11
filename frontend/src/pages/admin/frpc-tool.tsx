import { Button } from '@/components/ui/button'
import { errorToast, successToast } from '@/lib/toast'
import {
  FrpcStatus,
  FrpcStatusInfo,
  getFrpcConfig,
  getFrpcStatus,
  isSuperuserAuthed,
  logoutSuperuser,
  restartFrpc,
  saveFrpcConfig,
  startFrpc,
  stopFrpc
} from '@/services/api-frpc'
import InputField from '@/components/form/input-field'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ClientResponseError } from 'pocketbase'
import { useEffect, useRef } from 'react'
import { Resolver, useForm } from 'react-hook-form'
import { z } from 'zod/v4'
import AdminLoginCard from './admin-login-card'

// 状态徽章的展示文案与配色
const statusMeta: Record<FrpcStatus, { label: string; className: string }> = {
  unused: { label: '未启用', className: 'bg-muted text-muted-foreground' },
  starting: { label: '启动中', className: 'bg-yellow-500/20 text-yellow-700' },
  running: { label: '运行中', className: 'bg-green-500/20 text-green-700' },
  stopped: { label: '已停止', className: 'bg-muted text-muted-foreground' },
  failed: { label: '失败', className: 'bg-destructive/20 text-destructive' }
}

const configSchema = z.object({
  frpc_server_addr: z.string().min(1, 'frps 服务器地址不能为空'),
  frpc_server_port: z.coerce
    .number()
    .int('端口必须是整数')
    .min(1, '端口范围 1-65535')
    .max(65535, '端口范围 1-65535'),
  frpc_token: z.string(),
  frpc_proxy_name: z.string().min(1, '代理名称不能为空'),
  frpc_local_port: z.coerce
    .number()
    .int('端口必须是整数')
    .min(1, '端口范围 1-65535')
    .max(65535, '端口范围 1-65535'),
  frpc_remote_port: z.coerce
    .number()
    .int('端口必须是整数')
    .min(1, '端口范围 1-65535')
    .max(65535, '端口范围 1-65535')
})
type ConfigFields = z.infer<typeof configSchema>

// 表单字段顺序与默认值来源(后端 GET /api/frpc/config 的 defaults)
const configFieldOrder = [
  { option: 'frpc_server_addr', label: 'frps 服务器地址' },
  { option: 'frpc_server_port', label: 'frps 服务端口' },
  { option: 'frpc_token', label: '认证 token' },
  { option: 'frpc_proxy_name', label: '代理名称' },
  { option: 'frpc_local_port', label: '本地服务端口' },
  { option: 'frpc_remote_port', label: '远程端口' }
] as const satisfies readonly { option: keyof ConfigFields; label: string }[]

// 端口类字段(数字输入)判断
function isNumberField(option: keyof ConfigFields) {
  return (
    option === 'frpc_server_port' ||
    option === 'frpc_local_port' ||
    option === 'frpc_remote_port'
  )
}

export default function FrpcToolPage() {
  const queryClient = useQueryClient()
  // 认证状态取自隔离的管理会话(在登录卡片登录后即为 superuser)
  const authed = isSuperuserAuthed()

  // 已登录时轮询状态,实时反映启动/停止/重启结果
  const { data: status, error } = useQuery({
    queryKey: ['frpc-status'],
    queryFn: getFrpcStatus,
    enabled: authed,
    refetchInterval: authed ? 3000 : false
  })

  // 会话中途失效(如清库重建后残留旧 token)时回到未登录提示
  const sessionInvalid =
    error instanceof ClientResponseError && error.status === 403

  // 会话失效:清除管理会话,回到登录卡片(本地标记,避免重复清除)
  const sessionInvalidRef = useRef(false)
  useEffect(() => {
    if (!sessionInvalid || sessionInvalidRef.current) return
    sessionInvalidRef.current = true
    logoutSuperuser()
    queryClient.invalidateQueries()
  }, [sessionInvalid, queryClient])

  // 配置加载:已登录时获取,表单初始值 = 记录值或默认值
  const { data: config } = useQuery({
    queryKey: ['frpc-config'],
    queryFn: getFrpcConfig,
    enabled: authed
  })

  const form = useForm<ConfigFields>({
    // 与 task-form 一致:zod v4 的 coerce 字段输入/输出类型不同,需显式收窄为输出类型
    resolver: zodResolver(configSchema) as Resolver<ConfigFields>,
    defaultValues: {
      frpc_server_addr: '',
      frpc_server_port: 7000,
      frpc_token: '',
      frpc_proxy_name: 'simple-data-center',
      frpc_local_port: 8090,
      frpc_remote_port: 8090
    }
  })

  // 配置返回后填充表单(仅一次,避免用户编辑时被覆盖)
  const filledRef = useRef(false)
  useEffect(() => {
    if (!config || filledRef.current) return
    filledRef.current = true
    const valueMap = new Map(config.items.map((i) => [i.option, i.value]))
    // Record 承载 string|number 混合类型,规避 TS6 对联合键赋值的逐键校验
    const next = {} as Record<keyof ConfigFields, string | number>
    for (const field of configFieldOrder) {
      const raw = valueMap.get(field.option) ?? config.defaults[field.option]
      next[field.option] = isNumberField(field.option)
        ? Number(raw || 0)
        : (raw ?? '')
    }
    form.reset(next as ConfigFields)
  }, [config, form])

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

  const saveMutation = useMutation({
    mutationFn: (fields: ConfigFields) =>
      saveFrpcConfig(
        configFieldOrder.map((field) => ({
          option: field.option,
          value: String(fields[field.option])
        }))
      ),
    onSuccess: (info: FrpcStatusInfo) => {
      if (info.status === 'failed') {
        errorToast('配置已保存,但重启失败', new Error(info.error ?? '未知错误'))
      } else {
        successToast('配置已保存并重启')
      }
      // 注意:invalidateQueries 的 queryKey 是前缀匹配,须分别失效两个查询
      queryClient.invalidateQueries({ queryKey: ['frpc-status'] })
      queryClient.invalidateQueries({ queryKey: ['frpc-config'] })
    },
    onError: (error) => errorToast('保存配置失败', error)
  })

  // 未登录或会话失效:显示登录卡片
  if (!authed || sessionInvalid) {
    return (
      <div className='flex flex-col gap-4'>
        {sessionInvalid && (
          <p className='text-destructive text-sm'>
            管理员会话已失效,请重新登录。
          </p>
        )}
        <AdminLoginCard />
      </div>
    )
  }

  const current = status?.status ?? 'unused'
  const isStarting = current === 'starting'
  const isRunning = current === 'running'

  return (
    <div className='flex flex-col gap-6'>
      <div>
        <h1 className='text-xl font-bold'>frpc 反向代理</h1>
        <p className='text-muted-foreground text-sm'>
          通过 frp 反向代理将本服务暴露到公网。配置保存后自动重启生效。
        </p>
      </div>

      {/* 运行状态 */}
      <div className='max-w-md rounded-lg border p-6'>
        <div className='flex items-center gap-3'>
          <span className='text-sm'>frpc 状态:</span>
          <span
            className={`rounded-full px-3 py-1 text-sm ${statusMeta[current].className}`}>
            {statusMeta[current].label}
          </span>
        </div>
        {status?.error && (
          <p className='text-destructive mt-2 text-sm'>错误:{status.error}</p>
        )}
        <div className='mt-4 flex gap-3'>
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
      </div>

      {/* 连接配置 */}
      <div className='max-w-md rounded-lg border p-6'>
        <h2 className='font-semibold'>连接配置(保存后自动重启生效)</h2>
        <form
          className='mt-4 flex flex-col gap-4'
          onSubmit={form.handleSubmit((fields) =>
            saveMutation.mutate(fields)
          )}>
          {configFieldOrder.map((field) => {
            // 数字字段与文本字段分开渲染,保证 InputField 联合 props 的类型收窄
            if (isNumberField(field.option)) {
              return (
                <InputField
                  key={field.option}
                  form={form}
                  name={field.option}
                  type='number'
                  label={field.label}
                  min={1}
                  max={65535}
                  disabled={saveMutation.isPending}
                />
              )
            }
            return (
              <InputField
                key={field.option}
                form={form}
                name={field.option}
                type='text'
                label={field.label}
                disabled={saveMutation.isPending}
              />
            )
          })}
          <Button
            type='submit'
            className='w-fit'
            disabled={
              !form.formState.isDirty || saveMutation.isPending
            }>
            保存配置
          </Button>
        </form>
      </div>
    </div>
  )
}
