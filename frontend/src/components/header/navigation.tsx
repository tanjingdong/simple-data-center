import { Avatar, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import ThemeSwitch from '@/components/settings/theme-switch'
import useAuth from '@/hooks/use-auth'
import useTheme from '@/hooks/use-theme'
import { Link, useLocation } from '@tanstack/react-router'
import { DefaultUserAvatarLogo, TansPimMainLogo } from '../shared/logos'

export default function Navigation() {
  const { user, logout } = useAuth()
  const { avatar, id: userId, verified } = user ?? {}
  const location = useLocation()
  const { theme, changeTheme } = useTheme()

  return (
    <nav className='flex items-center justify-between gap-4'>
      <Link to='/' className='focus:outline-hidden'>
        <TansPimMainLogo />
      </Link>
      <div className='flex items-center gap-4'>
        <Link
          to='/tools-settings'
          className='text-muted-foreground hover:text-foreground text-sm transition-colors focus:outline-hidden'>
          工具设置
        </Link>
        <ThemeSwitch theme={theme} onThemeChange={changeTheme} />
        {verified ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button aria-label='用户菜单' className='focus:outline-hidden'>
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
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
              <DropdownMenuLabel>{user?.email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => logout()}>
                退出登录
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Link
            to='/login'
            className='text-muted-foreground hover:text-foreground text-sm transition-colors'>
            登录
          </Link>
        )}
      </div>
    </nav>
  )
}
