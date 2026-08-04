import { Button } from '@/components/ui/button'
import { usePlausible } from '@/context/plausible-context'
import { useLocation, useRouter } from '@tanstack/react-router'
import { useEffect } from 'react'

export default function NotFoundPage() {
  const { history } = useRouter()
  const location = useLocation()
  const { trackEvent } = usePlausible()

  useEffect(() => {
    trackEvent('404', { props: { path: location.pathname } })
  }, [])

  return (
    <main className='flex flex-col items-center gap-y-4 text-center'>
      <div className='mt-4 space-y-2 text-4xl font-bold sm:text-5xl'>
        页面不存在
      </div>
      <p className='text-lg font-light sm:text-xl'>抱歉,未找到您访问的页面</p>
      <Button
        variant='link'
        className='w-32 hover:no-underline'
        onClick={() => history.go(-1)}>
        ← 返回
      </Button>
    </main>
  )
}
