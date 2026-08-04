import InputField from '@/components/form/input-field'
import PasswordField from '@/components/form/password-field'
import SwitchField from '@/components/form/switch-field'
import ThemeSwitch from '@/components/settings/theme-switch'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel
} from '@/components/ui/form'
import {
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet'
import useAuth from '@/hooks/use-auth'
import useSettings from '@/hooks/use-settings'
import {
  UpdateUserSettingsFields,
  updateUserSettingsSchema
} from '@/schemas/user-schema'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from '@tanstack/react-router'
import { useRef } from 'react'
import { useForm } from 'react-hook-form'
import UploadFileField from '../form/file-upload-field'

// 主题值的中文显示名称
const themeNames: Record<string, string> = {
  light: '浅色',
  dark: '深色',
  system: '跟随系统'
}

export default function SettingsForm() {
  const formRef = useRef<HTMLFormElement>(null)
  const { logout } = useAuth()

  const {
    userId,
    name,
    remindEmail,
    remindByEmailEnabled,
    theme,
    authWithPasswordAvailable,
    updateSettings
  } = useSettings()

  const form = useForm<UpdateUserSettingsFields>({
    resolver: zodResolver(updateUserSettingsSchema),
    defaultValues: {
      name,
      avatar: undefined,
      theme,
      remindEmail,
      remindByEmailEnabled,
      oldPassword: '',
      password: '',
      passwordConfirm: ''
    }
  })

  const fieldsEdited = form.formState.isDirty

  return (
    <Form {...form}>
      <form
        ref={formRef}
        className='flex w-full flex-col items-center gap-y-4'
        onSubmit={form.handleSubmit(
          (userData) => userId && updateSettings(userId, userData)
        )}>
        <SheetHeader className='w-full'>
          <SheetTitle className='pb-4 text-4xl font-bold'>设置</SheetTitle>
          <SheetDescription className='hidden'>设置</SheetDescription>
        </SheetHeader>

        <p className='text-muted-foreground w-full text-xl font-light'>
          账户设置
        </p>

        <UploadFileField form={form} name='avatar' label='头像图片' />

        <InputField form={form} name='name' />

        <FormField
          control={form.control}
          name='theme'
          render={({ field }) => (
            <FormItem className='mr-auto'>
              <FormLabel className='mt-0! cursor-pointer'>主题</FormLabel>
              <div className='flex items-center gap-x-1'>
                <FormControl>
                  <ThemeSwitch
                    theme={field.value}
                    onThemeChange={field.onChange}
                  />
                </FormControl>
                <FormLabel className='mt-0! cursor-pointer'>
                  {themeNames[field.value]}
                </FormLabel>
              </div>
            </FormItem>
          )}
        />

        <p className='text-muted-foreground w-full text-xl font-light'>
          通知设置
        </p>

        <InputField
          form={form}
          name='remindEmail'
          type='email'
          label='提醒邮箱'
        />

        <SwitchField
          form={form}
          name='remindByEmailEnabled'
          label='启用邮件提醒'
        />

        {authWithPasswordAvailable && (
          <>
            <p className='text-muted-foreground w-full text-xl font-light'>
              修改密码
            </p>

            <PasswordField form={form} name='oldPassword' label='当前密码' />

            <PasswordField form={form} name='password' label='新密码' />

            <PasswordField
              form={form}
              name='passwordConfirm'
              label='确认新密码'
            />
          </>
        )}

        <SheetFooter className='mt-4 grid w-full grid-cols-2 gap-4 px-0 sm:space-x-0'>
          <Button disabled={!fieldsEdited} className='w-full' type='submit'>
            更新设置
          </Button>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant='outline' type='button' className='w-full'>
                退出登录
              </Button>
            </DialogTrigger>
            <DialogContent className='bg-popover sm:max-w-[300px]'>
              <DialogHeader>
                <DialogTitle>正在退出登录</DialogTitle>
                <DialogDescription>确定要退出登录吗?</DialogDescription>
              </DialogHeader>

              <DialogFooter className='flex items-center gap-4 sm:justify-between'>
                <Button className='w-full' onClick={logout}>
                  退出登录
                </Button>
                <DialogClose asChild>
                  <Button type='button' className='w-full' variant='secondary'>
                    取消
                  </Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button
            asChild
            variant='secondary'
            type='button'
            className='col-span-2 w-full'>
            <Link to='/tasks' preload={false}>
              返回
            </Link>
          </Button>
        </SheetFooter>
      </form>
    </Form>
  )
}
