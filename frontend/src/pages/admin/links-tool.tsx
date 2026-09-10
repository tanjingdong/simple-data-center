import InputField from '@/components/form/input-field'
import TextAreaField from '@/components/form/text-area-field'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { errorToast, successToast } from '@/lib/toast'
import {
  linksConfigSchema,
  type LinksConfigFields
} from '@/schemas/links-schema'
import { isSuperuserAuthed, logoutSuperuser } from '@/services/api-frpc'
import { getLinksConfig, saveLinksConfig } from '@/services/api-links'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ClientResponseError } from 'pocketbase'
import { useEffect, useRef } from 'react'
import { Resolver, useForm } from 'react-hook-form'

interface FieldMeta {
  option: keyof LinksConfigFields
  label: string
  hint: string
  type: 'text' | 'textarea'
  rows?: number
}

const configFields: FieldMeta[] = [
  {
    option: 'links_help_center_url',
    label: '帮助中心 URL',
    hint: '可填绝对地址(https://…、ftp://…)或 / 开头的根相对路径(如 /api/filestore/files/<文件ID>/download?inline=1);不接受裸相对地址(如 help.html,解析基准未定义)。留空 = 未配置,点击「帮助中心」将显示下方报错页。',
    type: 'text'
  },
  {
    option: 'links_error_html',
    label: '报错页 HTML',
    hint: '链接未配置或地址非法时,入口打开的内容(HTML 片段,可含 <style>)。留空使用内置默认文案。',
    type: 'textarea',
    rows: 8
  }
]

export default function LinksToolPage() {
  const queryClient = useQueryClient()
  const authed = isSuperuserAuthed()

  const { data: config, error } = useQuery({
    queryKey: ['links-config'],
    queryFn: getLinksConfig,
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

  const form = useForm<LinksConfigFields>({
    resolver: zodResolver(linksConfigSchema) as Resolver<LinksConfigFields>,
    defaultValues: {
      links_help_center_url: '',
      links_error_html: ''
    }
  })

  const filledRef = useRef(false)
  useEffect(() => {
    if (!config || filledRef.current) return
    filledRef.current = true
    form.reset({
      links_help_center_url: config.help_center_url ?? '',
      links_error_html: config.error_html ?? ''
    })
  }, [config, form])

  const saveMutation = useMutation({
    mutationFn: (fields: LinksConfigFields) =>
      saveLinksConfig(
        configFields.map((f) => ({
          option: f.option,
          value: fields[f.option]
        }))
      ),
    onSuccess: () => {
      successToast('配置已保存')
      queryClient.invalidateQueries({ queryKey: ['links-config'] })
    },
    onError: (error) => {
      const msg =
        error instanceof ClientResponseError
          ? error.response?.error || error.message
          : error
      errorToast('保存配置失败', msg)
    }
  })

  if (!authed) return null

  return (
    <div className='flex flex-col gap-6'>
      <div>
        <h1 className='text-xl font-bold'>链接管理</h1>
        <p className='text-muted-foreground text-sm'>
          导航栏「帮助中心」是固定入口{' '}
          <code className='bg-muted rounded px-1'>/links/help-center</code>
          (新标签页打开)。本页只配置它的目标地址与未配置时的报错页内容,保存后即时生效,无需重启。
        </p>
      </div>

      <div className='max-w-lg rounded-lg border p-6'>
        <h2 className='font-semibold'>链接配置</h2>
        <Form {...form}>
          <form
            className='mt-4 flex flex-col gap-4'
            onSubmit={form.handleSubmit((fields) =>
              saveMutation.mutate(fields)
            )}>
            {configFields.map((field) => (
              <div key={field.option}>
                {field.type === 'textarea' ? (
                  <TextAreaField
                    form={form}
                    name={field.option}
                    label={field.label}
                    rows={field.rows ?? 3}
                    disabled={saveMutation.isPending}
                  />
                ) : (
                  <InputField
                    form={form}
                    name={field.option}
                    type='text'
                    label={field.label}
                    disabled={saveMutation.isPending}
                  />
                )}
                {field.hint && (
                  <p className='text-muted-foreground mt-1 text-xs'>
                    {field.hint}
                  </p>
                )}
              </div>
            ))}
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
