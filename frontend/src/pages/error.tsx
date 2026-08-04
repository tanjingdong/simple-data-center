import { Button } from '@/components/ui/button'
import { usePlausible } from '@/context/plausible-context'
import { useRouter } from '@tanstack/react-router'
import { useEffect } from 'react'

export default function ErrorPage({ error }: { error: Error }) {
  const { history } = useRouter()
  const { trackEvent } = usePlausible()

  useEffect(() => {
    trackEvent('error', { props: { error: error.message } })
  }, [])

  return (
    <main className='flex flex-col items-center gap-y-4 text-center'>
      <div className='mt-8 space-y-2 text-4xl font-bold sm:text-5xl'>
        服务器内部错误
      </div>
      <p className='text-lg font-light sm:text-xl'>
        出现了一些问题,给您带来不便,敬请谅解。
      </p>
      {error.message && <p className='text-sm'>{error.message}</p>}
      <Button
        variant='link'
        className='w-32 hover:no-underline'
        onClick={() => history.go(-1)}>
        ← 返回
      </Button>
    </main>
  )
}
