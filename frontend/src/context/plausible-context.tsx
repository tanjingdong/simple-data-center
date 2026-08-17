import Plausible, { EventOptions } from 'plausible-tracker'
import { createContext, use, useEffect } from 'react'

type TrackEvent = (eventName: string, options?: EventOptions) => void

// 未配置 domain 与 apiHost 时完全禁用埋点:
// plausible-tracker 在 apiHost 缺失时会向「当前页面路径 + /undefined/api/event」
// 发送请求(每次路由导航都触发),产生噪音 404;局域网自部署场景无需统计,
// 配置 VITE_DOMAIN + VITE_PLAUSIBLE_API_HOST 后自动启用。
const plausibleEnabled =
  Boolean(import.meta.env.VITE_DOMAIN) &&
  Boolean(import.meta.env.VITE_PLAUSIBLE_API_HOST)

const plausible = plausibleEnabled
  ? Plausible({
      domain: import.meta.env.VITE_DOMAIN,
      apiHost: import.meta.env.VITE_PLAUSIBLE_API_HOST,
      trackLocalhost: true
    })
  : null

// 禁用态下的空操作,保证调用方(如 ErrorPage 的 trackEvent)无需判空
const noopTrackEvent: TrackEvent = () => {}

const PlausibleContext = createContext<{ trackEvent: TrackEvent }>({
  trackEvent: noopTrackEvent
})

function PlausibleProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!plausible) return
    const cleanup = plausible.enableAutoPageviews()
    return () => cleanup()
  }, [])

  return (
    <PlausibleContext value={{ trackEvent: plausible?.trackEvent ?? noopTrackEvent }}>
      {children}
    </PlausibleContext>
  )
}

function usePlausible() {
  const context = use(PlausibleContext)
  if (context === undefined)
    throw new Error('PlausibleContext is being used outside PlausibleProvider')
  return context
}

export { PlausibleProvider, usePlausible }
