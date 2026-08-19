import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { errorToast, successToast } from '@/lib/toast'
import {
  checkAlistHealth,
  getFilestoreConfig,
  reportOrphans,
  saveFilestoreConfig
} from '@/services/api-filestore'
import { isSuperuserAuthed, logoutSuperuser } from '@/services/api-frpc'
import InputField from '@/components/form/input-field'
import TextAreaField from '@/components/form/text-area-field'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ClientResponseError } from 'pocketbase'
import { useEffect, useRef } from 'react'
import { Resolver, useForm } from 'react-hook-form'
import { z } from 'zod/v4'

const configSchema = z.object({
  filestore_alist_url: z.string().min(1, 'Alist 服务地址不能为空'),
  filestore_alist_token: z.string().min(1, 'Alist 管理 token 不能为空'),
  filestore_max_size: z.coerce
    .number()
    .int('大小必须是整数')
    .min(1, '大小必须大于 0'),
  filestore_allowed_mimes: z.string(),
  filestore_download_mode: z.enum(['direct', 'proxy']),
  filestore_storage_path: z.string().min(1, '存储根路径不能为空'),
  filestore_placeholder_denied: z.string(),
  filestore_placeholder_error: z.string()
})
type ConfigFields = z.infer<typeof configSchema>

interface FieldMeta {
  option: keyof ConfigFields
  label: string
  hint: string
  type: 'text' | 'password' | 'number' | 'textarea'
  rows?: number
}

const configFields: FieldMeta[] = [
  {
    option: 'filestore_alist_url',
    label: 'Alist 服务地址',
    hint: '格式: http://192.168.1.100:5244 或 https://alist.example.com',
    type: 'text'
  },
  {
    option: 'filestore_alist_token',
    label: 'Alist 管理 token',
    hint: '在 Alist 管理后台 → 设置 → 其他 → Token 中获取',
    type: 'password'
  },
  {
    option: 'filestore_max_size',
    label: '单文件大小上限(字节)',
    hint: '默认 10485760(10MB), 超过此大小的文件上传将被拒绝',
    type: 'number'
  },
  {
    option: 'filestore_allowed_mimes',
    label: '允许的 MIME 类型',
    hint: '留空=允许所有。示例: image/jpeg,image/png,application/pdf',
    type: 'text'
  },
  {
    option: 'filestore_download_mode',
    label: '下载通道模式',
    hint: 'direct=浏览器直连 Alist 下载(速度快), proxy=经本服务中转(安全性高)',
    type: 'text'
  },
  {
    option: 'filestore_storage_path',
    label: '存储根路径',
    hint: '文件在 Alist 上的存储根目录, 例如 /NAS/Temp, 需与 Alist 挂载路径一致',
    type: 'text'
  },
  {
    option: 'filestore_placeholder_denied',
    label: '鉴权失败占位 HTML',
    hint: '无权限访问文件时返回此 HTML, 可填 <svg>...</svg> 或 <img src="..." />',
    type: 'textarea',
    rows: 3
  },
  {
    option: 'filestore_placeholder_error',
    label: '服务异常占位 HTML',
    hint: '存储服务异常时返回此 HTML, 可填 <svg>...</svg> 或 <img src="..." />',
    type: 'textarea',
    rows: 3
  }
]

export default function FilestoreToolPage() {
  const queryClient = useQueryClient()
  const authed = isSuperuserAuthed()

  const { data: config, error } = useQuery({
    queryKey: ['filestore-config'],
    queryFn: getFilestoreConfig,
    enabled: authed
  })

  const sessionInvalid =
    error instanceof ClientResponseError && error.status === 403

  const sessionInvalidRef = useRef(false)
  useEffect(() => {
    if (!sessionInvalid || sessionInvalidRef.current) return
    sessionInvalidRef.current = true
    logoutSuperuser()
    queryClient.invalidateQueries()
  }, [sessionInvalid, queryClient])

  const form = useForm<ConfigFields>({
    resolver: zodResolver(configSchema) as Resolver<ConfigFields>,
    defaultValues: {
      filestore_alist_url: '',
      filestore_alist_token: '',
      filestore_max_size: 10485760,
      filestore_allowed_mimes: '',
      filestore_download_mode: 'direct',
      filestore_storage_path: '/simple-data-center',
      filestore_placeholder_denied: '',
      filestore_placeholder_error: ''
    }
  })

  const filledRef = useRef(false)
  useEffect(() => {
    if (!config || filledRef.current) return
    filledRef.current = true
    form.reset({
      filestore_alist_url: config.alist_url ?? '',
      filestore_alist_token: config.alist_token ?? '',
      filestore_max_size: config.max_size ?? 10485760,
      filestore_allowed_mimes: config.allowed_mimes ?? '',
      filestore_download_mode: (config.download_mode as 'direct' | 'proxy') ?? 'direct',
      filestore_storage_path: config.storage_path ?? '/simple-data-center',
      filestore_placeholder_denied: config.placeholder_denied ?? '',
      filestore_placeholder_error: config.placeholder_error ?? ''
    })
  }, [config, form])

  const saveMutation = useMutation({
    mutationFn: (fields: ConfigFields) =>
      saveFilestoreConfig(
        configFields.map((f) => ({
          option: f.option,
          value: String(fields[f.option])
        }))
      ),
    onSuccess: () => {
      successToast('配置已保存')
      queryClient.invalidateQueries({ queryKey: ['filestore-config'] })
    },
    onError: (error) => {
      const msg = error instanceof ClientResponseError
        ? error.response?.error || error.message
        : error
      errorToast('保存配置失败', msg)
    }
  })

  const checkMutation = useMutation({
    mutationFn: checkAlistHealth,
    onSuccess: (result) => {
      if (result.ok) {
        successToast('Alist 连通正常')
      } else {
        errorToast('Alist 连通性检查失败', new Error(result.error ?? '未知错误'))
      }
    },
    onError: (error) => errorToast('连通性检查失败', error)
  })

  const orphanMutation = useMutation({
    mutationFn: reportOrphans,
    onSuccess: (result) => {
      successToast(
        `对账完成: DB ${result.db_file_count} 个文件, Alist ${result.alist_file_count} 个文件, 孤儿 ${result.orphan_count} 个`
      )
    },
    onError: (error) => errorToast('孤儿文件对账失败', error)
  })

  if (!authed) return null

  return (
    <div className='flex flex-col gap-6'>
      <div>
        <h1 className='text-xl font-bold'>文件存储管理</h1>
        <p className='text-muted-foreground text-sm'>
          管理 Alist 外部存储服务的连接配置与全局约束。配置保存后即时生效。
        </p>
      </div>

      {/* 操作按钮区 */}
      <div className='flex gap-3'>
        <Button
          variant='secondary'
          disabled={checkMutation.isPending}
          onClick={() => checkMutation.mutate()}>
          {checkMutation.isPending ? '检查中...' : '连通性自检'}
        </Button>
        <Button
          variant='secondary'
          disabled={orphanMutation.isPending}
          onClick={() => orphanMutation.mutate()}>
          {orphanMutation.isPending ? '对账中...' : '孤儿文件对账'}
        </Button>
      </div>

      {/* 配置表单 */}
      <div className='max-w-lg rounded-lg border p-6'>
        <h2 className='font-semibold'>Alist 连接配置</h2>
        <Form {...form}>
          <form
            className='mt-4 flex flex-col gap-4'
            onSubmit={form.handleSubmit((fields) =>
              saveMutation.mutate(fields)
            )}>
            {configFields.map((field) => {
              if (field.type === 'textarea') {
                return (
                  <div key={field.option}>
                    <TextAreaField
                      form={form}
                      name={field.option}
                      label={field.label}
                      rows={field.rows ?? 3}
                      disabled={saveMutation.isPending}
                    />
                    {field.hint && (
                      <p className='text-muted-foreground mt-1 text-xs'>{field.hint}</p>
                    )}
                  </div>
                )
              }
              if (field.type === 'number') {
                return (
                  <div key={field.option}>
                    <InputField
                      form={form}
                      name={field.option}
                      type='number'
                      label={field.label}
                      min={1}
                      disabled={saveMutation.isPending}
                    />
                    {field.hint && (
                      <p className='text-muted-foreground mt-1 text-xs'>{field.hint}</p>
                    )}
                  </div>
                )
              }
              return (
                <div key={field.option}>
                  <InputField
                    form={form}
                    name={field.option}
                    type={field.type}
                    label={field.label}
                    disabled={saveMutation.isPending}
                  />
                  {field.hint && (
                    <p className='text-muted-foreground mt-1 text-xs'>{field.hint}</p>
                  )}
                </div>
              )
            })}
            <Button
              type='submit'
              className='w-fit'
              disabled={!form.formState.isDirty || saveMutation.isPending}>
              保存配置
            </Button>
          </form>
        </Form>
      </div>
    </div>
  )
}