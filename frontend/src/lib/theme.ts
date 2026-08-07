import { Theme } from '@/schemas/settings-schema'

const THEME_KEY = 'theme'

// 读取本地存储的主题偏好,缺省为 system
export function getStoredTheme(): Theme {
  const raw = localStorage.getItem(THEME_KEY)
  if (raw === 'light' || raw === 'dark' || raw === 'system') return raw
  return 'system'
}

// 写入主题偏好并应用到根元素
export function setStoredTheme(theme: Theme) {
  if (theme === 'system') localStorage.removeItem(THEME_KEY)
  else localStorage.setItem(THEME_KEY, theme)
  applyTheme(theme)
}

// 将主题应用到 <html> 的 class
export function applyTheme(theme: Theme) {
  const root = window.document.documentElement
  root.classList.remove('light', 'dark')

  if (theme === 'light' || theme === 'dark') {
    root.classList.add(theme)
    return
  }

  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  root.classList.add(systemDark ? 'dark' : 'light')
}
