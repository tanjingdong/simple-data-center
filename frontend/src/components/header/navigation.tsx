import { Avatar, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import useAuth from '@/hooks/use-auth'
import { Link, useLocation } from '@tanstack/react-router'
import {
  DatabaseIcon,
  LogOutIcon,
  SettingsIcon,
  WrenchIcon
} from 'lucide-react'
import { DefaultUserAvatarLogo, MainLogo } from '../shared/logos'

export default function Navigation() {
  const { user, logout } = useAuth()
  const { avatar, id: userId, verified } = user ?? {}
  const location = useLocation()

  return (
    <nav className='flex items-center justify-between'>
      <Link to='/' className='focus:outline-hidden'>
        <MainLogo />
      </Link>
      <div className='flex items-center gap-4'>
        <Link
          to='/admin'
          className='text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm transition-colors focus:outline-hidden'>
          <WrenchIcon className='size-4' />
          管理工具
        </Link>
        <a
          href='/_/'
          target='_blank'
          rel='noreferrer'
          className='text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm transition-colors focus:outline-hidden'>
          <DatabaseIcon className='size-4' />
          数据管理
        </a>
        {verified ? (
          <>
            <button
              type='button'
              onClick={logout}
              className='text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-1.5 text-sm transition-colors focus:outline-hidden'>
              <LogOutIcon className='size-4' />
              退出
            </button>
            {/* 已登录:头像点击弹出「用户设置」菜单 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type='button'
                  aria-label='用户账号'
                  className='cursor-pointer focus:outline-hidden'>
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
                <DropdownMenuItem asChild>
                  <Link
                    to='/user-setting'
                    preload={false}
                    className='flex w-full items-center gap-2'>
                    <SettingsIcon className='size-4' />
                    用户设置
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : (
          // 未登录:头像点击跳转登录页
          <Link
            to='/login'
            aria-label='用户账号或登录'
            className='focus:outline-hidden'>
            <Avatar className='flex size-10 items-center justify-center'>
              <DefaultUserAvatarLogo />
            </Avatar>
          </Link>
        )}
      </div>
    </nav>
  )
}
