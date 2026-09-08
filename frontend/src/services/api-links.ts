import { adminPb } from './api-frpc'

// ---- 管理端 API (superuser only) ----

export interface LinksConfig {
  help_center_url: string
  error_html: string
}

export async function getLinksConfig(): Promise<LinksConfig> {
  return adminPb.send('/api/links/config', { requestKey: null })
}

export async function saveLinksConfig(
  items: { option: string; value: string }[]
): Promise<{ ok: boolean }> {
  return adminPb.send('/api/links/config', {
    method: 'POST',
    body: { items },
    requestKey: null
  })
}
