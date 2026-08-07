import { format, isValid } from 'date-fns'

// 解析 yyyy-MM-dd 字符串为 Date;无效时抛错
export function stringToDate(dateString: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    throw new Error(`无效日期格式:${dateString}(应为 yyyy-MM-dd)`)
  }
  const date = new Date(`${dateString}T00:00:00`)
  if (!isValid(date)) throw new Error(`无效日期:${dateString}`)
  return date
}

// Date 转 yyyy-MM-dd
export function dateToString(date: Date = new Date()): string {
  if (!(date instanceof Date) || !isValid(date))
    throw new Error('Invalid Date object provided')
  return format(date, 'yyyy-MM-dd')
}
