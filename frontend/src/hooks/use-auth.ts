import { usePlausible } from '@/context/plausible-context'
import { errorToast, successToast } from '@/lib/toast'
import { RegisterFields } from '@/schemas/auth-schema'
import { User } from '@/schemas/user-schema'
import {
  authRefresh,
  confirmPasswordReset as confirmPasswordResetApi,
  createNewUser,
  loginWithGoogle as loginWithGoogleApi,
  loginWithPassword as loginWithPasswordApi,
  logout as logoutApi,
  requestPasswordReset as requestPasswordResetApi,
  sendVerificationEmail as sendVerificationEmailApi,
  subscribeToUserChanges,
  unsubscribeFromUserChanges,
  userQueryOptions,
  verifyEmailByToken as verifyEmailByTokenApi
} from '@/services/api-auth'
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { useState } from 'react'

export default function useAuth() {
  const [emailSendCountdown, setEmailSendCountdown] = useState(0)
  const router = useRouter()
  const queryClient = useQueryClient()
  const { trackEvent } = usePlausible()

  const { data: user } = useSuspenseQuery(userQueryOptions)

  const logout = () => {
    logoutApi()
    queryClient.clear()
    unsubscribeFromUserChanges()
    router.navigate({ to: '/', search: () => ({ logout: true }) })
  }

  const subscribeUserChangeCallback = async (record: User) => {
    await authRefresh()
    router.invalidate()
    queryClient.setQueryData(['user'], record)
  }

  const loginWithPassword = async (email: string, password: string) => {
    try {
      const authResult = await loginWithPasswordApi(email, password)
      trackEvent('login', { props: { method: 'password' } })
      subscribeToUserChanges(authResult.record.id, subscribeUserChangeCallback)
      queryClient.invalidateQueries({ queryKey: ['user'] })
      router.navigate({ to: '/' })
    } catch (error) {
      errorToast('登录失败', error)
    }
  }

  const loginWithGoogle = async () => {
    try {
      const authResult = await loginWithGoogleApi()
      trackEvent('login', { props: { method: 'google' } })
      subscribeToUserChanges(authResult.record.id, subscribeUserChangeCallback)
      queryClient.invalidateQueries({ queryKey: ['user'] })
      router.invalidate()
      router.navigate({ to: '/' })
    } catch (error) {
      errorToast('登录失败', error)
    }
  }

  const register = async (newUserData: RegisterFields) => {
    try {
      await createNewUser(newUserData)
      trackEvent('signup')
      successToast('注册成功!', '请查收邮箱中的验证邮件')
      router.navigate({ to: '/login' })
    } catch (error) {
      errorToast('注册失败', error)
    }
  }

  const startEmailSendCountdown = ({
    resetTargetTime = true
  }: {
    resetTargetTime?: boolean
  } = {}) => {
    let targetTime = parseInt(localStorage.getItem('sendEmailTimeout') || '')
    if (resetTargetTime && !targetTime) {
      targetTime = Date.now() + 60 * 1000
      localStorage.setItem('sendEmailTimeout', targetTime.toString())
    }

    const ticker = setInterval(() => {
      const secondsRemaining = Math.ceil((targetTime - Date.now()) / 1000)
      if (secondsRemaining > 0) {
        setEmailSendCountdown(secondsRemaining)
      } else {
        setEmailSendCountdown(0)
        localStorage.removeItem('sendEmailTimeout')
        clearInterval(ticker)
      }
    })
  }

  const requestPasswordReset = async (email: string) => {
    try {
      await requestPasswordResetApi(email)
      successToast('重置密码邮件已发送', '密码重置说明已发送至您的邮箱')
      startEmailSendCountdown()
    } catch (error) {
      errorToast('发送密码重置邮件失败', error)
    }
  }

  const confirmPasswordReset = async (
    password: string,
    passwordConfirm: string,
    token: string
  ) => {
    try {
      await confirmPasswordResetApi(password, passwordConfirm, token)
      successToast('密码已修改', '您的密码已更新')
      router.navigate({ to: '/login' })
    } catch (error) {
      errorToast('更新密码失败', error)
    }
  }

  const sendVerificationEmail = async (email: string | undefined) => {
    try {
      if (!email) throw new Error('无法获取当前登录用户的邮箱')
      await sendVerificationEmailApi(email)
      successToast('验证邮件已发送', '请查收邮箱中的验证邮件')
      startEmailSendCountdown()
    } catch (error) {
      errorToast('发送验证邮件失败', error)
    }
  }

  const verifyEmailByToken = async (token: string) => {
    try {
      await verifyEmailByTokenApi(token)
      queryClient.setQueryData(['user'], (userData: User) =>
        userData
          ? {
              ...userData,
              verified: true
            }
          : userData
      )
      successToast('验证成功', '您的邮箱地址已验证')
      router.navigate({ to: '/login' })
    } catch (error) {
      errorToast('邮箱验证失败', error)
    }
  }

  return {
    user,
    logout,
    loginWithPassword,
    loginWithGoogle,
    register,
    requestPasswordReset,
    confirmPasswordReset,
    sendVerificationEmail,
    verifyEmailByToken,
    startEmailSendCountdown,
    emailSendCountdown
  }
}
