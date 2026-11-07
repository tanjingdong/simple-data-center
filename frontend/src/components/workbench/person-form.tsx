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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { type TagPoolEntry } from '@/lib/person-tags'
import { errorToast, successToast } from '@/lib/toast'
import {
  Person,
  PersonFormFields,
  personFormSchema,
  politicalStatusOptions,
  trustLevelOptions
} from '@/schemas/person-schema'
import {
  createPerson,
  duplicatePersonCandidatesQueryOptions,
  hasDuplicateCriteria,
  personTagPoolQueryOptions,
  updatePerson
} from '@/services/api-persons'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient
} from '@tanstack/react-query'
import { useMemo } from 'react'
import {
  useForm,
  useWatch,
  type Resolver,
  type UseFormReturn
} from 'react-hook-form'
import DuplicatePersonHint from './duplicate-person-hint'
import OrgPicker from './org-picker'
import TagSuggestRow from './tag-suggest-row'

// 标签字段输入块:文本框唯一事实源 + 下方候选行(行为风格对齐本文件 trust_level 块)
function TagFieldRow({
  form,
  name,
  label,
  pool
}: {
  form: UseFormReturn<PersonFormFields>
  name: 'person_tags' | 'social_tags'
  label: string
  pool: TagPoolEntry[]
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <div className='flex items-baseline justify-between'>
            <FormLabel>{label}</FormLabel>
            <FormMessage className='text-xs font-normal' />
          </div>
          <FormControl>
            <Input {...field} value={(field.value as string) ?? ''} />
          </FormControl>
          <TagSuggestRow
            pool={pool}
            text={(field.value as string) ?? ''}
            onChange={(value) => field.onChange(value)}
          />
        </FormItem>
      )}
    />
  )
}

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

  // 标签候选池(最近更新 10 人聚合);失败/加载中静默,由 TagSuggestRow 空池隐藏兜底
  const tagPoolQuery = useQuery(personTagPoolQueryOptions())

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

  // 重复联系人检索:监听姓/名/手机,去抖后查询聚合列并做拼接精确判定;编辑模式排除自身
  const watchedLastName = useWatch({ control: form.control, name: 'last_name' })
  const watchedFirstName = useWatch({
    control: form.control,
    name: 'first_name'
  })
  const watchedMobile = useWatch({ control: form.control, name: 'mobile' })
  const duplicateParams = useMemo(
    () => ({
      lastName: watchedLastName ?? '',
      firstName: watchedFirstName ?? '',
      mobile: watchedMobile ?? '',
      excludeId: person?.id
    }),
    [watchedLastName, watchedFirstName, watchedMobile, person?.id]
  )
  const debouncedDuplicateParams = useDebouncedValue(duplicateParams, 400)
  const duplicatesQuery = useQuery({
    ...duplicatePersonCandidatesQueryOptions(debouncedDuplicateParams),
    // 加载新结果时保留旧候选,避免警示块闪烁
    placeholderData: keepPreviousData
  })
  // 条件清空后即便缓存里还留着上一次结果(keepPreviousData)也不再展示,避免残留警示
  const duplicateCandidates = hasDuplicateCriteria(debouncedDuplicateParams)
    ? (duplicatesQuery.data ?? [])
    : []

  return (
    <Form {...form}>
      <form
        className='mx-auto max-w-2xl space-y-4 pb-8'
        onSubmit={form.handleSubmit((data) => saveMutation.mutate(data))}>
        {/* 标题与操作行吸顶:窗口滚动下贴视口,top-10 避让上方 h-10 返回条 */}
        <div className='bg-background sticky top-10 z-20 flex items-center justify-between border-b py-2'>
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

        {/* 疑似重复联系人警示(仅命中时显示,标题栏之下) */}
        <DuplicatePersonHint persons={duplicateCandidates} />

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

        {/* 分组 3:人脉信息(人脉标签/社会标签/信任评级);标签输入框下候选行可点击填入,数据源为最近更新 10 人 */}
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-base'>人脉信息</CardTitle>
          </CardHeader>
          <CardContent className='grid grid-cols-2 gap-3'>
            <TagFieldRow
              form={form}
              name='person_tags'
              label='人脉标签'
              pool={tagPoolQuery.data?.person ?? []}
            />
            <TagFieldRow
              form={form}
              name='social_tags'
              label='社会标签'
              pool={tagPoolQuery.data?.social ?? []}
            />
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
