import { Avatar, AvatarImage } from '@/components/ui/avatar'
import useAuth from '@/hooks/use-auth'
import { Link, useLocation } from '@tanstack/react-router'
import { DefaultUserAvatarLogo, LongHabitMainLogo } from '../shared/logos'

export default function Navigation() {
  const { user } = useAuth()
  const { avatar, id: userId, verified } = user ?? {}
  const location = useLocation()

  return (
    <nav className='flex items-center justify-between'>
      <Link to='/' className='focus:outline-hidden'>
        <LongHabitMainLogo />
      </Link>
      <div className='flex items-center gap-4'>
        <Link
          to='/tools-settings'
          className='text-muted-foreground hover:text-foreground text-sm transition-colors focus:outline-hidden'>
          工具设置
        </Link>
        <Link
          aria-label='用户账号或登录'
          to={verified ? '/tasks/settings' : '/login'}
          className='focus:outline-hidden'>
          <Avatar className='flex size-10 items-center justify-center'>
            {avatar && !location.search.logout ? (
              <AvatarImage
                src={`/api/files/users/${userId}/${avatar}?thumb=100x100`}
                alt='用户头像'
              />
            ) : (
              <DefaultUserAvatarLogo />
            )}
          </Avatar>
        </Link>
      </div>
    </nav>
  )
}
