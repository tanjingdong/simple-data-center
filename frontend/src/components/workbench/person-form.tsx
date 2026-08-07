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
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { errorToast, successToast } from '@/lib/toast'
import {
  Person,
  PersonFormFields,
  personFormSchema,
  politicalStatusOptions,
  trustLevelOptions
} from '@/schemas/person-schema'
import { createPerson, updatePerson } from '@/services/api-persons'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, type Resolver } from 'react-hook-form'
import OrgPicker from './org-picker'

// 人员新建/编辑共用表单;字段按「个人信息/联系信息/人脉信息/个人档案/经历信息」分组
export default function PersonForm({
  person,
  onCancel,
  onSaved
}: {
  person?: Person
  onCancel(): void
  onSaved(): void
}) {
  const queryClient = useQueryClient()

  // schema 带 default('') 的字段使 zod 输入类型为可选,与 RHF 期望的字段类型不完全一致,
  // 故按输出类型(即 PersonFormFields)断言 resolver;同时显式声明转换值类型避免泛型别名未解析
  const form = useForm<PersonFormFields, any, PersonFormFields>({
    resolver: zodResolver(personFormSchema) as Resolver<PersonFormFields>,
    defaultValues: person
      ? {
          last_name: person.last_name,
          first_name: person.first_name,
          // 响应解析 schema 对枚举字段用宽松 string,此处收敛为表单枚举类型
          gender: person.gender as PersonFormFields['gender'],
          birthday: person.birthday,
          id_card: person.id_card,
          ethnicity: person.ethnicity,
          blood_type: person.blood_type as PersonFormFields['blood_type'],
          zodiac: person.zodiac,
          native_place: person.native_place,
          birth_place: person.birth_place,
          political_status:
            person.political_status as PersonFormFields['political_status'],
          person_tags: person.person_tags,
          social_tags: person.social_tags,
          nickname: person.nickname,
          current_org_id: person.current_org_id,
          admin_position: person.admin_position,
          tech_title: person.tech_title,
          legal_info: person.legal_info,
          graduate_school: person.graduate_school,
          degree: person.degree as PersonFormFields['degree'],
          major: person.major,
          continuing_edu: person.continuing_edu,
          mobile: person.mobile,
          office_phone: person.office_phone,
          email: person.email,
          office_address: person.office_address,
          home_address: person.home_address,
          interests: person.interests,
          children_info: person.children_info,
          taboo: person.taboo,
          concern: person.concern,
          trust_level: person.trust_level
        }
      : {
          last_name: '',
          first_name: '',
          gender: '',
          birthday: '',
          id_card: '',
          ethnicity: '',
          blood_type: '',
          zodiac: '',
          native_place: '',
          birth_place: '',
          political_status: '',
          person_tags: '',
          social_tags: '',
          nickname: '',
          current_org_id: '',
          admin_position: '',
          tech_title: '',
          legal_info: '',
          graduate_school: '',
          degree: '',
          major: '',
          continuing_edu: '',
          mobile: '',
          office_phone: '',
          email: '',
          office_address: '',
          home_address: '',
          interests: '',
          children_info: '',
          taboo: '',
          concern: '',
          trust_level: 3
        }
  })

  const saveMutation = useMutation({
    mutationFn: (data: PersonFormFields) =>
      person ? updatePerson(person.id, data) : createPerson(data),
    onSuccess: () => {
      successToast(person ? '已保存' : '已创建')
      queryClient.invalidateQueries({ queryKey: ['persons'] })
      onSaved()
    },
    onError: (error) => errorToast(person ? '保存失败' : '创建失败', error)
  })

  return (
    <Form {...form}>
      <form
        className='mx-auto max-w-2xl space-y-4 pb-8'
        onSubmit={form.handleSubmit((data) => saveMutation.mutate(data))}>
        <div className='flex items-center justify-between'>
          <h1 className='text-xl font-bold'>
            {person ? '编辑人员' : '新增人员'}
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

        {/* 分组 1:个人信息(姓/名/昵称/性别/生日/民族/血型/生肖/籍贯/出生地/政治面貌/当前单位/行政职务/技术职称/法人信息) */}
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-base'>个人信息</CardTitle>
          </CardHeader>
          <CardContent className='grid grid-cols-2 gap-3'>
            <InputField form={form} name='last_name' label='姓' />
            <InputField form={form} name='first_name' label='名' />
            <InputField form={form} name='nickname' label='昵称' />
            <AutoCompleteField
              form={form}
              name='gender'
              label='性别'
              options={['男', '女']}
            />
            <InputField form={form} name='birthday' label='生日' />
            <InputField form={form} name='id_card' label='身份证号' />
            <InputField form={form} name='ethnicity' label='民族' />
            <AutoCompleteField
              form={form}
              name='blood_type'
              label='血型'
              options={['A', 'B', 'AB', 'O']}
            />
            <InputField form={form} name='zodiac' label='生肖' />
            <InputField form={form} name='native_place' label='籍贯' />
            <InputField form={form} name='birth_place' label='出生地' />
            <AutoCompleteField
              form={form}
              name='political_status'
              label='政治面貌'
              options={[...politicalStatusOptions]}
            />
            <div className='space-y-1'>
              <Label>当前单位</Label>
              <OrgPicker
                value={form.watch('current_org_id')}
                onChange={(id) => form.setValue('current_org_id', id)}
              />
              {form.formState.errors.current_org_id && (
                <p className='text-destructive text-xs'>
                  {form.formState.errors.current_org_id.message}
                </p>
              )}
            </div>
            <InputField form={form} name='admin_position' label='行政职务' />
            <InputField form={form} name='tech_title' label='技术职称' />
            <InputField form={form} name='legal_info' label='法人信息' />
          </CardContent>
        </Card>

        {/* 分组 2:联系信息(手机/座机/邮箱/办公地址/住宅地址) */}
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-base'>联系信息</CardTitle>
          </CardHeader>
          <CardContent className='grid grid-cols-2 gap-3'>
            <InputField form={form} name='mobile' label='手机' />
            <InputField form={form} name='office_phone' label='座机' />
            <InputField form={form} name='email' label='邮箱' />
            <InputField form={form} name='office_address' label='办公地址' />
            <InputField form={form} name='home_address' label='住宅地址' />
          </CardContent>
        </Card>

        {/* 分组 3:人脉信息(人脉标签/社会标签/信任评级) */}
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-base'>人脉信息</CardTitle>
          </CardHeader>
          <CardContent className='grid grid-cols-2 gap-3'>
            <InputField form={form} name='person_tags' label='人脉标签' />
            <InputField form={form} name='social_tags' label='社会标签' />
            <FormField
              control={form.control}
              name='trust_level'
              render={({ field }) => (
                <FormItem>
                  <div className='flex items-baseline justify-between'>
                    <FormLabel>信任评级</FormLabel>
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
                      {trustLevelOptions.map((level) => (
                        <SelectItem key={level} value={String(level)}>
                          {level} 星
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* 分组 4:个人档案(兴趣/子女/禁忌/关注 — TextAreaField) */}
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-base'>个人档案</CardTitle>
          </CardHeader>
          <CardContent className='grid grid-cols-2 gap-3'>
            <TextAreaField form={form} name='interests' label='兴趣' />
            <TextAreaField form={form} name='children_info' label='子女' />
            <TextAreaField form={form} name='taboo' label='禁忌' />
            <TextAreaField form={form} name='concern' label='关注' />
          </CardContent>
        </Card>

        {/* 分组 5:经历信息(毕业学校/学历/专业/继续教育) */}
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-base'>经历信息</CardTitle>
          </CardHeader>
          <CardContent className='grid grid-cols-2 gap-3'>
            <InputField form={form} name='graduate_school' label='毕业学校' />
            <AutoCompleteField
              form={form}
              name='degree'
              label='学历'
              options={['专科', '本科', '硕士', '博士']}
            />
            <InputField form={form} name='major' label='专业' />
            <InputField form={form} name='continuing_edu' label='继续教育' />
          </CardContent>
        </Card>
      </form>
    </Form>
  )
}
