import { z } from 'zod/v4'
import { pbTokenSchema } from './pb-schema'

export const loginSchema = z.object({
  email: z.email('邮箱格式不正确'),
  password: z.string().min(8, '密码无效')
})

export type LoginFields = z.infer<typeof loginSchema>

export const registerSchema = z
  .object({
    email: z.email('邮箱格式不正确'),
    name: z.string().min(2, '内容过短'),
    password: z.string().min(8, '内容过短'),
    passwordConfirm: z.string()
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: '两次输入的密码不一致',
    path: ['passwordConfirm']
  })

export type RegisterFields = z.infer<typeof registerSchema>

export const verifyEmailSchema = z.object({
  token: pbTokenSchema
})

export const verifyEmailParamsSchema = z.object({
  token: pbTokenSchema.catch('').optional()
})

export type VerifyEmailFields = z.infer<typeof verifyEmailSchema>

export const forgotPasswordSchema = z.object({
  email: z.email('邮箱格式不正确')
})
export type ForgotPasswordFields = z.infer<typeof forgotPasswordSchema>

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, '内容过短'),
    passwordConfirm: z.string()
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: '两次输入的密码不一致',
    path: ['passwordConfirm']
  })

export const resetPasswordParamsSchema = z.object({
  token: pbTokenSchema.catch('')
})

export type ResetPasswordFields = z.infer<typeof resetPasswordSchema>
