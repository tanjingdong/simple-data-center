import AutoCompleteField from '@/components/form/autocomplete-field'
import InputField from '@/components/form/input-field'
import TextAreaField from '@/components/form/text-area-field'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { errorToast, successToast } from '@/lib/toast'
import {
  importanceLevelOptions,
  Organization,
  OrganizationFormFields,
  organizationFormSchema
} from '@/schemas/organization-schema'
import {
  createOrganization,
  updateOrganization
} from '@/services/api-organizations'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, type Resolver } from 'react-hook-form'

// 组织新建/编辑共用表单;名称必填,资源评级 1-5,地图链接为可空 URL
export default function OrganizationForm({
  organization,
  onCancel,
  onSaved
}: {
  organization?: Organization
  onCancel(): void
  onSaved(): void
}) {
  const queryClient = useQueryClient()

  // schema 带 default 的字段使 zod 输入类型为可选,与 RHF 期望的字段类型不完全一致,
  // 故按输出类型(即 OrganizationFormFields)断言 resolver;同时显式声明转换值类型避免泛型别名未解析
  const form = useForm<OrganizationFormFields, any, OrganizationFormFields>({
    resolver: zodResolver(
      organizationFormSchema
    ) as Resolver<OrganizationFormFields>,
    defaultValues: organization
      ? {
          name: organization.name,
          type: organization.type,
          importance_level: organization.importance_level,
          phone: organization.phone,
          email: organization.email,
          map: organization.map,
          address: organization.address,
          notes: organization.notes
        }
      : {
          name: '',
          type: '',
          importance_level: 3,
          phone: '',
          email: '',
          map: '',
          address: '',
          notes: ''
        }
  })

  const saveMutation = useMutation({
    mutationFn: (data: OrganizationFormFields) =>
      organization
        ? updateOrganization(organization.id, data)
        : createOrganization(data),
    onSuccess: () => {
      successToast(organization ? '已保存' : '已创建')
      queryClient.invalidateQueries({ queryKey: ['organizations'] })
      onSaved()
    },
    onError: (error) =>
      errorToast(organization ? '保存失败' : '创建失败', error)
  })

  return (
    <Form {...form}>
      <form
        className='mx-auto max-w-2xl space-y-4 pb-8'
        onSubmit={form.handleSubmit((data) => saveMutation.mutate(data))}>
        <div className='flex items-center justify-between'>
          <h1 className='text-xl font-bold'>
            {organization ? '编辑组织' : '新增组织'}
          </h1>
          <div className='flex gap-2'>
            <Button type='button' variant='outline' onClick={onCancel}>
              取消
            </Button>
            <Button type='submit' disabled={saveMutation.isPending}>
              保存
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-base'>基本信息</CardTitle>
          </CardHeader>
          <CardContent className='grid grid-cols-2 gap-3'>
            <InputField form={form} name='name' label='名称' />
            <AutoCompleteField
              form={form}
              name='type'
              label='类型'
              options={[
                '国家机关',
                '事业单位',
                '企业',
                '学校',
                '医院',
                '媒体',
                '社会团体'
              ]}
            />
            <FormField
              control={form.control}
              name='importance_level'
              render={({ field }) => (
                <FormItem>
                  <div className='flex items-baseline justify-between'>
                    <FormLabel>资源评级</FormLabel>
                    <FormMessage className='text-xs font-normal' />
                  </div>
                  <Select
                    value={String(field.value)}
                    onValueChange={(value) => field.onChange(Number(value))}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder='选择评级' />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {importanceLevelOptions.map((level) => (
                        <SelectItem key={level} value={String(level)}>
                          {level} 星
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
            <InputField form={form} name='phone' label='电话' />
            <InputField form={form} name='email' label='邮箱' />
            <InputField form={form} name='map' label='地图链接' />
            <InputField form={form} name='address' label='地址' />
            <div className='col-span-2'>
              <TextAreaField form={form} name='notes' label='备注' rows={4} />
            </div>
          </CardContent>
        </Card>
      </form>
    </Form>
  )
}
