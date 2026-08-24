import { checkVerifiedUserIsLoggedIn } from '@/services/api-auth'
import { redirect } from '@tanstack/react-router'

/**
 * 业务路由守卫:未登录或邮箱未验证则跳转登录页。
 *
 * 客户端路由守卫,仅用于体验层跳转;真正的安全仍由 PocketBase 后端 token 校验保证。
 * 传入 title 则同时返回面包屑标题,供根布局 RootLayoutWithTitle 拼接 document.title。
 * 未来新增业务路由,直接 `beforeLoad: requireVerifiedUser('模块名')` 一行接入鉴权与标题。
 */
export function requireVerifiedUser(title?: string) {
  return () => {
    if (!checkVerifiedUserIsLoggedIn()) throw redirect({ to: '/login' })
    return title ? { getTitle: () => title } : {}
  }
}
