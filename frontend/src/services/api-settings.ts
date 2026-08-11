import {
  UpdateUserProfileFields,
  UpdateUserSettingsFields
} from '@/schemas/user-schema'
import { loginWithPassword } from './api-auth'
import { pb } from './pocketbase'

export async function getSettings(userId?: string) {
  userId ??= pb.authStore.record?.id

  const settings = await pb
    .collection('settings')
    .getFirstListItem(`user="${userId}"`)

  if (!settings) throw new Error('Could not fetch settings data')

  return settings
}

export async function updateUserSettings(
  userId: string,
  formData: UpdateUserSettingsFields
) {
  const {
    remindEmail,
    remindByEmailEnabled,
    theme,
    name,
    avatar,
    oldPassword,
    password,
    passwordConfirm
  } = formData
  const userIsChangingPassword = oldPassword && password && passwordConfirm

  const newUserData = await pb
    .collection('users')
    .update(
      userId,
      userIsChangingPassword
        ? { name, avatar, oldPassword, password, passwordConfirm }
        : { name, avatar }
    )

  userIsChangingPassword &&
    (await loginWithPassword(newUserData.email, password))

  const settings = await pb
    .collection('settings')
    .getFirstListItem(`user="${newUserData.id}"`)

  settings &&
    (await pb.collection('settings').update(settings.id, {
      remindEmail,
      remindByEmailEnabled,
      theme
    }))
}

// 用户资料更新:仅操作 users 表,与 settings 表无关(供 /user-setting 设置页使用)。
export async function updateUserProfile(
  userId: string,
  formData: UpdateUserProfileFields
) {
  const {
    name,
    username,
    emailVisibility,
    avatar,
    oldPassword,
    password,
    passwordConfirm
  } = formData
  const userIsChangingPassword = oldPassword && password && passwordConfirm

  const newUserData = await pb.collection('users').update(
    userId,
    userIsChangingPassword
      ? {
          name,
          username,
          emailVisibility,
          avatar,
          oldPassword,
          password,
          passwordConfirm
        }
      : { name, username, emailVisibility, avatar }
  )

  // 改密码成功后重新登录(密码变更需重新认证)
  userIsChangingPassword &&
    (await loginWithPassword(newUserData.email, password))

  return newUserData
}

// 邮箱变更:请求 PocketBase 发送确认邮件,用户点击邮件链接后生效
// (PocketBase 限制普通用户不可直接更新 email,须走 requestEmailChange 流程)。
export async function requestUserEmailChange(newEmail: string) {
  await pb.collection('users').requestEmailChange(newEmail)
}
