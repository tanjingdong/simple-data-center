import { Outlet } from '@tanstack/react-router'
import Footer from './components/footer/footer'
import Navigation from './components/header/navigation'
import { Toaster } from './components/ui/sonner'

export default function RootLayout() {
  return (
    // data-app-shell:GTD 打印页在 @media print 时靠这个稳定选择器清零外层容器
    // 并隐藏导航栏与页脚。用 Tailwind 类名做选择器太脆,故加一个语义属性。
    <div
      data-app-shell
      className='mx-auto flex min-h-dvh max-w-[1600px] flex-col gap-4 px-4 py-2'>
      <Navigation />
      <Outlet />
      <Footer />
      <Toaster position='bottom-center' toastOptions={{ duration: 2500 }} />
    </div>
  )
}
