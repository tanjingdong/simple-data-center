import { z } from 'zod/v4'

// 与后端 backend/links/config.go 校验规则镜像,文案一致。
const FORBIDDEN_SCHEMES = ['javascript', 'data', 'vbscript', 'file'] as const
const SCHEME_PATTERN = /^[a-zA-Z][a-zA-Z0-9+.-]*:/
const CONTROL_PATTERN = /[\s\u0000-\u001f\u007f]/

export const MAX_URL_LEN = 500
export const MAX_ERROR_HTML_LEN = 32000

/** 校验链接目标地址:合法返回 null,否则返回中文错误。空串合法(未配置态)。
 * 仅收受:绝对地址(scheme 白名单外黑名单拒绝)或 "/" 开头的站点根相对
 * (含 "//host" 协议相对)。裸相对(help.html、./x、../x)基准未定义,拒绝。 */
export function validateLinkURL(value: string): string | null {
  if (value === '') return null
  if (value.length > MAX_URL_LEN) {
    return `链接地址过长(最多 ${MAX_URL_LEN} 字符)`
  }
  if (CONTROL_PATTERN.test(value)) {
    return '链接地址不能包含空白或控制字符'
  }
  const m = SCHEME_PATTERN.exec(value)
  if (m) {
    const scheme = m[0].slice(0, -1).toLowerCase()
    if ((FORBIDDEN_SCHEMES as readonly string[]).includes(scheme)) {
      return `不允许使用 ${scheme}: 协议`
    }
    return null
  }
  if (!value.startsWith('/')) {
    return '同源相对地址请以 / 开头,或填写完整绝对地址'
  }
  return null
}

export const linksConfigSchema = z.object({
  links_help_center_url: z
    .string()
    .trim()
    .superRefine((value, ctx) => {
      const err = validateLinkURL(value)
      if (err) ctx.addIssue({ code: 'custom', message: err })
    }),
  links_error_html: z
    .string()
    .max(MAX_ERROR_HTML_LEN, '报错 HTML 过长(最多 32000 字符)')
})

export type LinksConfigFields = z.infer<typeof linksConfigSchema>
