import NotFoundPage from '@/pages/not-found'
import RootLayout from '@/root-layout'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  redirect,
  RouterProvider,
  useMatches
} from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { useEffect } from 'react'
import { z } from 'zod/v4'
import Spinner from './components/shared/spinner'
import { requireVerifiedUser } from './lib/route-guards'
import AdminHomePage from './pages/admin/admin-home'
import AdminLayout from './pages/admin/admin-layout'
import { adminTools } from './pages/admin/admin-tools'
import { isSuperuserAuthed } from './services/api-frpc'
import ForgotPasswordPage from './pages/auth/forgot-password'
import LoginPage from './pages/auth/login'
import RegisterPage from './pages/auth/register'
import ResetPasswordPage from './pages/auth/reset-password'
import VerifyEmailPage from './pages/auth/verify-email'
import CenterPage from './pages/center'
import ErrorPage from './pages/error'
import HomePage from './pages/home'
import PrivacyPolicyPage from './pages/privacy-policy'
import FilesPage from './pages/files/files-page'
import UserSettingPage from './pages/user-setting'
import WorkbenchPage from './pages/workbench'
import EventListPage from './pages/health/event-list'
import EventFormPage from './pages/health/event-form'
import EventDetailPage from './pages/health/event-detail'
import EventSummaryPage, {
  eventSummarySearchSchema
} from './pages/health/event-summary'
import {
  resetPasswordParamsSchema,
  verifyEmailParamsSchema
} from './schemas/auth-schema'
import {
  checkEmailIsVerified,
  checkUserIsLoggedIn,
  checkVerifiedUserIsLoggedIn,
  userQueryOptions
} from './services/api-auth'

interface RootContext {
  queryClient: QueryClient
  getTitle?: () => string | Promise<string>
}

function RootLayoutWithTitle() {
  const matches = useMatches()

  useEffect(() => {
    const breadcrumbPromises = [...matches]
      .reverse()
      .map((match) => {
        const context = match.context as RootContext
        return context.getTitle?.()
      })
      .filter(Boolean)

    void Promise.all(breadcrumbPromises).then((titles) => {
      document.title = titles.join(' · ')
    })
  }, [matches])

  return <RootLayout />
}

const rootRoute = createRootRouteWithContext<RootContext>()({
  component: RootLayoutWithTitle,
  notFoundComponent: NotFoundPage,
  errorComponent: ErrorPage,
  validateSearch: z.object({
    logout: z.boolean().optional()
  }),

  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(userQueryOptions),
  beforeLoad: async () => {
    return { getTitle: () => 'tans-PIM' }
  }
})

// 首页:未登录展示静态首页(不依赖数据库,0 数据库也能打开);
// 已登录用户访问根路径跳转到数据大厅(/center)。
const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
  pendingComponent: Spinner,
  beforeLoad: async () => {
    if (checkVerifiedUserIsLoggedIn()) throw redirect({ to: '/center' })
    return { getTitle: () => '' }
  }
})

// 联系人管理(原 tans-PIM 业务):独立路由,登录用户经数据大厅入口进入。
// 集合访问规则公开,登录仅作界面入口(与 PIM 设计决策一致)。
const socialRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/social',
  component: WorkbenchPage,
  pendingComponent: Spinner,
  beforeLoad: () => {
    if (!checkVerifiedUserIsLoggedIn()) throw redirect({ to: '/login' })
    return { getTitle: () => '联系人管理' }
  }
})

// 个人健康信息管理:独立业务路由,登录用户经数据大厅入口进入。
// 集合访问规则仅登录用户(健康数据敏感,与 PIM 公开规则不同)。
const healthRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'health',
  beforeLoad: () => {
    if (!checkVerifiedUserIsLoggedIn()) throw redirect({ to: '/login' })
    return { getTitle: () => '个人健康' }
  }
})
const healthIndexRoute = createRoute({
  getParentRoute: () => healthRoute,
  path: '/',
  component: EventListPage,
  beforeLoad: () => ({ getTitle: () => '健康事件' })
})
const healthNewRoute = createRoute({
  getParentRoute: () => healthRoute,
  path: 'events/new',
  component: EventFormPage,
  beforeLoad: () => ({ getTitle: () => '新建事件' })
})
const healthDetailRoute = createRoute({
  getParentRoute: () => healthRoute,
  path: 'events/$eventId',
  component: EventDetailPage,
  beforeLoad: () => ({ getTitle: () => '事件详情' })
})
const healthEditRoute = createRoute({
  getParentRoute: () => healthRoute,
  path: 'events/$eventId/edit',
  component: EventFormPage,
  beforeLoad: () => ({ getTitle: () => '编辑事件' })
})
const healthSummaryRoute = createRoute({
  getParentRoute: () => healthRoute,
  path: 'summary',
  component: EventSummaryPage,
  validateSearch: eventSummarySearchSchema,
  beforeLoad: () => ({ getTitle: () => '归集' })
})

const privacyPolicyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/privacy-policy',
  component: PrivacyPolicyPage,
  pendingComponent: Spinner,
  beforeLoad: () => {
    return { getTitle: () => '隐私政策' }
  }
})

const authRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'auth',
  beforeLoad: ({ location }) => {
    if (location.pathname.includes('reset-password')) return
    if (checkVerifiedUserIsLoggedIn()) throw redirect({ to: '/center' })
    return { getTitle: () => '' }
  }
})

const loginRoute = createRoute({
  getParentRoute: () => authRoute,
  path: 'login',
  component: LoginPage,
  beforeLoad: () => {
    if (checkUserIsLoggedIn() && !checkEmailIsVerified())
      throw redirect({ to: '/verify-email' })
    return { getTitle: () => '登录' }
  }
})

const registerRoute = createRoute({
  getParentRoute: () => authRoute,
  path: 'register',
  component: RegisterPage,
  beforeLoad: () => {
    if (checkUserIsLoggedIn() && !checkEmailIsVerified())
      throw redirect({ to: '/verify-email' })
    return { getTitle: () => '注册' }
  }
})

const verifyEmailRoute = createRoute({
  getParentRoute: () => authRoute,
  path: 'verify-email',
  component: VerifyEmailPage,
  validateSearch: verifyEmailParamsSchema,
  beforeLoad: () => {
    return { getTitle: () => '验证邮箱' }
  }
})

const forgotPasswordRoute = createRoute({
  getParentRoute: () => authRoute,
  path: 'forgot-password',
  component: ForgotPasswordPage,
  beforeLoad: () => {
    if (checkUserIsLoggedIn() && !checkEmailIsVerified())
      throw redirect({ to: '/verify-email' })
    return { getTitle: () => '忘记密码' }
  }
})

const resetPasswordRoute = createRoute({
  getParentRoute: () => authRoute,
  path: 'reset-password',
  component: ResetPasswordPage,
  validateSearch: resetPasswordParamsSchema,
  beforeLoad: () => ({ getTitle: () => '重置密码' })
})

const centerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'center',
  component: CenterPage,
  pendingComponent: Spinner,
  beforeLoad: requireVerifiedUser('数据大厅')
})

const filesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'files',
  component: FilesPage,
  pendingComponent: Spinner,
  beforeLoad: requireVerifiedUser('我的文件')
})

const userSettingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'user-setting',
  component: UserSettingPage,
  pendingComponent: Spinner,
  beforeLoad: requireVerifiedUser('用户设置')
})

// /admin 的管理端认证统一由 PB Dashboard(/_ )负责:
// 未登录超级管理员时整页跳转到 /_ 登录,登录后同一会话对 /admin 可见
// 注意:相对路径 href 必须带 reloadDocument,否则 TanStack 会按内部路由导航,
// 而路由树中无 /_/ 匹配,会渲染本项目的 404 页而非 Dashboard。
const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'admin',
  component: AdminLayout,
  beforeLoad: () => {
    if (!isSuperuserAuthed()) {
      throw redirect({ href: '/_/', reloadDocument: true })
    }
    return { getTitle: () => '管理工具' }
  }
})

// /admin 默认显示工具选择页(不再自动跳入第一个工具)
const adminIndexRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/',
  component: AdminHomePage,
  beforeLoad: () => ({ getTitle: () => '管理工具' })
})

// 各工具路由:与 adminTools 注册表一一对应,新增工具时需在此同步加一行。
// (map 动态生成会丢失 path 字面量类型,导致 typed routes 无法包含 /admin/frpc,故用显式声明。)
const adminToolRoutes = [
  createRoute({
    getParentRoute: () => adminRoute,
    path: 'frpc',
    component: adminTools[0].component,
    beforeLoad: () => ({ getTitle: () => adminTools[0].label })
  }),
  createRoute({
    getParentRoute: () => adminRoute,
    path: 'filestore',
    component: adminTools[1].component,
    beforeLoad: () => ({ getTitle: () => adminTools[1].label })
  })
]

// 兜底:不存在的工具路径跳回 /admin 工具选择页
const adminCatchAllRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '*',
  beforeLoad: () => {
    throw redirect({ to: '/admin' })
  }
})

const routeTree = rootRoute.addChildren([
  homeRoute,
  socialRoute,
  healthRoute.addChildren([
    healthIndexRoute,
    healthNewRoute,
    healthDetailRoute,
    healthEditRoute,
    healthSummaryRoute
  ]),
  privacyPolicyRoute,
  authRoute.addChildren([
    loginRoute,
    registerRoute,
    verifyEmailRoute,
    forgotPasswordRoute,
    resetPasswordRoute
  ]),
  centerRoute,
  filesRoute,
  userSettingRoute,
  adminRoute.addChildren([
    adminIndexRoute,
    ...adminToolRoutes,
    adminCatchAllRoute
  ])
])

const queryClient = new QueryClient()

const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
  context: { queryClient }
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

export default function Router({
  devToolsEnabled
}: {
  devToolsEnabled?: boolean
}) {
  devToolsEnabled ??= import.meta.env.DEV

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      {devToolsEnabled && (
        <>
          <ReactQueryDevtools
            initialIsOpen={false}
            buttonPosition='bottom-left'
          />
          <TanStackRouterDevtools router={router} position='bottom-right' />
        </>
      )}
    </QueryClientProvider>
  )
}
