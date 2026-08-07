import { z } from 'zod/v4'
import { pbIdSchema } from './pb-schema'

export const userSchema = z.object({
  id: pbIdSchema,
  avatar: z.string(),
  email: z.email('邮箱格式不正确'),
  name: z.string().min(2, '内容过短').optional().or(z.literal('')),
  verified: z.boolean(),
  authWithPasswordAvailable: z.boolean()
})

export type User = z.infer<typeof userSchema>

export const updateUserProfileSchema = z.object({
  avatar: z.instanceof(File).nullish().optional(),
  name: z.string().min(2, '内容过短').optional().or(z.literal(''))
})

export type UpdateUserProfileFields = z.infer<typeof updateUserProfileSchema>
