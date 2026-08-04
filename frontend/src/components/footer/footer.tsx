import ScrollToTopButton from '@/components/footer/scroll-to-top'
import { GitHubLogoIcon } from '@radix-ui/react-icons'
import { Link } from '@tanstack/react-router'

export default function Footer() {
  return (
    <footer className='mt-auto flex w-full flex-col pt-4'>
      <ScrollToTopButton />
      <div className='text-muted-foreground grid grid-cols-1 gap-1 px-2 text-xs select-none md:grid-cols-3'>
        <p className='text-center hover:underline md:text-left'>
          © {new Date().getFullYear()}{' '}
          <a target='_blank' rel='noreferrer' href='https://spweb.dev'>
            SP Web Development
          </a>
        </p>{' '}
        <div className='text-center'>
          <a
            target='_blank'
            rel='noreferrer'
            className='flex items-center justify-center hover:underline'
            href='https://github.com/s-petr/longhabit'>
            <GitHubLogoIcon className='mr-1' />
            源代码
          </a>
        </div>
        <p className='text-center md:text-right'>
          <Link
            resetScroll={true}
            to='/privacy-policy'
            className='hover:underline'>
            隐私政策
          </Link>
        </p>
      </div>
    </footer>
  )
}
