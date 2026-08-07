import { getStoredTheme, setStoredTheme } from '@/lib/theme'
import { Theme } from '@/schemas/settings-schema'
import { useCallback, useState } from 'react'

export default function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme())

  const changeTheme = useCallback((next: Theme) => {
    setStoredTheme(next)
    setTheme(next)
  }, [])

  return { theme, changeTheme }
}
