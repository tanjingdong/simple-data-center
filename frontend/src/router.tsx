import NotFoundPage from '@/pages/not-found'
import RootLayout from '@/root-layout'
import { taskQueryOptions, tasksQueryOptions } from '@/services/api-tasks'
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
import { setTheme } from './lib/set-theme'
import ForgotPasswordPage from './pages/auth/forgot-password'
import LoginPage from './pages/auth/login'
import RegisterPage from './pages/auth/register'
import ResetPasswordPage from './pages/auth/reset-password'
import VerifyEmailPage from './pages/auth/verify-email'
import ErrorPage from './pages/error'
import HomePage from './pages/home'
import PrivacyPolicyPage from './pages/privacy-policy'
import EditTaskPage from './pages/tasks/edit-task'
import NewTaskPage from './pages/tasks/new-task'
import SettingsPage from './pages/tasks/settings'
import TasksPage from './pages/tasks/tasks'
import ToolsSettingsPage from './pages/tools-settings'
import {
  resetPasswordParamsSchema,
  verifyEmailParamsSchema
} from './schemas/auth-schema'
import { pbIdSchema } from './schemas/pb-schema'
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
  beforeLoad: async ({ context: { queryClient } }) => {
    const user = queryClient.getQueryData(userQueryOptions.queryKey)
    setTheme(user?.settings?.theme)
    return { getTitle: () => 'Long Habit' }
  }
})

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
  pendingComponent: Spinner,
  beforeLoad: async () => {
    if (checkVerifiedUserIsLoggedIn()) throw redirect({ to: '/tasks' })
    return { getTitle: () => '' }
  }
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

const toolsSettingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'tools-settings',
  component: ToolsSettingsPage,
  beforeLoad: () => {
    return { getTitle: () => '工具设置' }
  }
})

const authRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'auth',
  beforeLoad: ({ location }) => {
    if (location.pathname.includes('reset-password')) return
    if (checkVerifiedUserIsLoggedIn()) throw redirect({ to: '/tasks' })
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

const tasksRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'tasks',
  component: TasksPage,
  pendingComponent: Spinner,
  beforeLoad: () => {
    if (!checkVerifiedUserIsLoggedIn()) throw redirect({ to: '/login' })
    return { getTitle: () => '任务' }
  },
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(tasksQueryOptions)
})

const settingsRoute = createRoute({
  getParentRoute: () => tasksRoute,
  path: 'settings',
  component: SettingsPage,
  beforeLoad: () => ({ getTitle: () => '设置' })
})

const newTaskRoute = createRoute({
  getParentRoute: () => tasksRoute,
  path: 'new',
  component: NewTaskPage,
  beforeLoad: () => {
    return { getTitle: () => '新建' }
  }
})

const editTaskRoute = createRoute({
  getParentRoute: () => tasksRoute,
  path: '$taskId',
  component: EditTaskPage,
  beforeLoad: () => {
    return { getTitle: () => '编辑' }
  },
  loader: async ({ context: { queryClient }, params: { taskId } }) => {
    const taskIdValidationResult = pbIdSchema.safeParse(taskId)
    if (taskIdValidationResult.error) throw redirect({ to: '/tasks' })
    const task = await queryClient.ensureQueryData(
      taskQueryOptions(taskIdValidationResult.data)
    )
    return task
  }
})

const routeTree = rootRoute.addChildren([
  homeRoute,
  privacyPolicyRoute,
  toolsSettingsRoute,
  authRoute.addChildren([
    loginRoute,
    registerRoute,
    verifyEmailRoute,
    forgotPasswordRoute,
    resetPasswordRoute
  ]),
  tasksRoute.addChildren([settingsRoute, newTaskRoute, editTaskRoute])
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
