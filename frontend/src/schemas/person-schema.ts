import { z } from 'zod/v4'
import { pbIdSchema } from './pb-schema'

// 姓名必填,其余字段可空字符串;trust_level 必须 1-5
export const personSchema = z.object({
  id: pbIdSchema,
  last_name: z.string().min(1, '姓不能为空'),
  first_name: z.string().min(1, '名不能为空'),
  gender: z.enum(['', '男', '女']).default(''),
  birthday: z.string().regex(/^$|^\d{4}-\d{2}-\d{2}$/, '日期格式应为 yyyy-MM-dd').default(''),
  id_card: z.string().default(''),
  ethnicity: z.string().default(''),
  blood_type: z.enum(['', 'A', 'B', 'AB', 'O']).default(''),
  zodiac: z.string().default(''),
  native_place: z.string().default(''),
  birth_place: z.string().default(''),
  political_status: z.string().default(''),
  person_tags: z.string().default(''),
  social_tags: z.string().default(''),
  nickname: z.string().default(''),
  current_org_id: z.string().default(''),
  admin_position: z.string().default(''),
  tech_title: z.string().default(''),
  legal_info: z.string().default(''),
  graduate_school: z.string().default(''),
  degree: z.enum(['', '专科', '本科', '硕士', '博士']).default(''),
  major: z.string().default(''),
  continuing_edu: z.string().default(''),
  mobile: z.string().default(''),
  office_phone: z.string().default(''),
  email: z.string().default(''),
  office_address: z.string().default(''),
  home_address: z.string().default(''),
  interests: z.string().default(''),
  children_info: z.string().default(''),
  taboo: z.string().default(''),
  concern: z.string().default(''),
  trust_level: z.coerce
    .number()
    .int('信任评级必须为整数')
    .min(1, '信任评级必须为 1-5')
    .max(5, '信任评级必须为 1-5')
    .default(3)
})

// 响应解析 schema:PocketBase 序列化格式 → UI 格式
//  - 文本/select/relation:null → ''
//  - 日期:完整时间戳 → 'yyyy-MM-dd'(取前 10 位)
//  - 评级:非法值 → 0(服务端已保证 1-5)
export const personResponseSchema = z.object({
  id: pbIdSchema,
  last_name: z.string(),
  first_name: z.string(),
  gender: z.string().catch(''),
  birthday: z.string().catch('').transform((v) => v.slice(0, 10)),
  id_card: z.string().catch(''),
  ethnicity: z.string().catch(''),
  blood_type: z.string().catch(''),
  zodiac: z.string().catch(''),
  native_place: z.string().catch(''),
  birth_place: z.string().catch(''),
  political_status: z.string().catch(''),
  person_tags: z.string().catch(''),
  social_tags: z.string().catch(''),
  nickname: z.string().catch(''),
  current_org_id: z.string().catch(''),
  admin_position: z.string().catch(''),
  tech_title: z.string().catch(''),
  legal_info: z.string().catch(''),
  graduate_school: z.string().catch(''),
  degree: z.string().catch(''),
  major: z.string().catch(''),
  continuing_edu: z.string().catch(''),
  mobile: z.string().catch(''),
  office_phone: z.string().catch(''),
  email: z.string().catch(''),
  office_address: z.string().catch(''),
  home_address: z.string().catch(''),
  interests: z.string().catch(''),
  children_info: z.string().catch(''),
  taboo: z.string().catch(''),
  concern: z.string().catch(''),
  trust_level: z.number().catch(0)
})

// UI 使用的数据层类型:来自响应解析 schema(而非严格表单 schema)
export type Person = z.infer<typeof personResponseSchema>

// 新建/编辑共用的提交字段(不含系统字段;relation 字段以空串表示未选)
export const personFormSchema = personSchema.omit({ id: true })
export type PersonFormFields = z.infer<typeof personFormSchema>

// 信任评级选项(1-5 星)
export const trustLevelOptions = [1, 2, 3, 4, 5] as const

// 政治面貌建议列表(开放值,可自定义)
export const politicalStatusOptions = [
  '中共党员',
  '共青团员',
  '民革',
  '民盟',
  '民建',
  '民进',
  '农工党',
  '致公党',
  '九三学社',
  '台盟',
  '无党派人士',
  '群众'
] as const
