import UserSettingsForm from '@/components/settings/user-settings-form'

export default function UserSettingPage() {
  return (
    <main className='mx-auto flex w-full max-w-xl flex-col items-center gap-y-6 px-4 py-8'>
      <h1 className='text-3xl font-bold'>用户设置</h1>
      <p className='text-muted-foreground text-center text-sm'>
        管理您的账户信息。
      </p>
      <UserSettingsForm />
    </main>
  )
}
