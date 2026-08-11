import { z } from 'zod/v4'
import { pbIdSchema } from './pb-schema'
import { settingsSchema, themeSchema } from './settings-schema'

export const userSchema = z.object({
  id: pbIdSchema,
  avatar: z.string(),
  email: z.email('邮箱格式不正确'),
  name: z.string().min(2, '内容过短').optional().or(z.literal('')),
  username: z.string().min(2, '内容过短'),
  emailVisibility: z.boolean(),
  verified: z.boolean(),
  authWithPasswordAvailable: z.boolean()
})

export type User = z.infer<typeof userSchema>

export const userWithSettingsSchema = userSchema.extend({
  authWithPasswordAvailable: z.boolean(),
  settings: settingsSchema
})

export type UserWithSettings = z.infer<typeof userWithSettingsSchema>

export const updateUserSettingsSchema = z
  .object({
    remindEmail: z.email('邮箱格式不正确'),
    remindByEmailEnabled: z.boolean(),
    avatar: z.instanceof(File).nullish().optional(),
    name: z.string().min(2, '内容过短').optional().or(z.literal('')),
    theme: themeSchema,
    oldPassword: z.string().optional(),
    password: z.string().optional(),
    passwordConfirm: z.string().optional()
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: '两次输入的密码不一致',
    path: ['passwordConfirm']
  })
  .refine(
    (data) =>
      (data.oldPassword === '' && data.password === '') ||
      data.oldPassword !== data.password,
    {
      message: '新密码与原密码相同',
      path: ['password']
    }
  )
  .refine(
    (data) => {
      const anyPasswordFieldNotEmpty =
        data.oldPassword || data.password || data.passwordConfirm
      const allPasswordFieldsFilled =
        data.oldPassword && data.password && data.passwordConfirm
      return !anyPasswordFieldNotEmpty || allPasswordFieldsFilled
    },
    {
      message: '请填写全部密码字段',
      path: ['password']
    }
  )

export type UpdateUserSettingsFields = z.infer<typeof updateUserSettingsSchema>

// 用户资料更新:仅读写 users 表字段(供 /user-setting 设置页使用)。
export const updateUserProfileSchema = z
  .object({
    avatar: z.instanceof(File).nullish().optional(),
    name: z.string().min(2, '内容过短').optional().or(z.literal('')),
    username: z
      .string()
      .min(3, '内容过短')
      .regex(/^[\w][\w\.\-]*$/, '仅支持字母、数字、下划线、点与横线'),
    emailVisibility: z.boolean(),
    oldPassword: z.string().optional(),
    password: z.string().optional(),
    passwordConfirm: z.string().optional()
  })
  .refine(
    (data) => (data.password ?? '') === (data.passwordConfirm ?? ''),
    {
      message: '两次输入的密码不一致',
      path: ['passwordConfirm']
    }
  )
  .refine(
    (data) => {
      // 对 undefined 与空字符串一视同仁(表单字段可能未注册或未触碰)
      const oldPassword = data.oldPassword ?? ''
      const password = data.password ?? ''
      const passwordConfirm = data.passwordConfirm ?? ''
      const anyPasswordFieldNotEmpty =
        oldPassword || password || passwordConfirm
      const allPasswordFieldsFilled =
        oldPassword && password && passwordConfirm
      return !anyPasswordFieldNotEmpty || allPasswordFieldsFilled
    },
    {
      message: '请填写全部密码字段',
      path: ['password']
    }
  )

export type UpdateUserProfileFields = z.infer<typeof updateUserProfileSchema>
