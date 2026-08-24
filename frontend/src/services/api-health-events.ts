import {
  HealthEvent,
  HealthEventFormFields,
  healthEventResponseSchema
} from '@/schemas/health-event-schema'
import { queryOptions } from '@tanstack/react-query'
import { pb } from './pocketbase'

// 列表查询:person 过滤走服务端(数据量小,其余筛选在前端完成)
export function healthEventsQueryOptions(person: string) {
  const p = person.trim()
  // PocketBase filter 字符串内单引号反斜杠转义;留实机验证
  const escaped = p.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
  return queryOptions({
    queryKey: ['health_events', 'list', p],
    queryFn: async () => {
      const result = await pb.collection('health_events').getList(1, 500, {
        filter: p ? `person='${escaped}'` : undefined,
        sort: '-happen_at'
      })
      return result.items.map((item) => healthEventResponseSchema.parse(item))
    },
    staleTime: 30 * 1000
  })
}

// 详情查询(详情页与归集页展开用)
export function healthEventDetailQueryOptions(id: string) {
  return queryOptions({
    queryKey: ['health_events', 'detail', id],
    queryFn: async () => {
      const record = await pb.collection('health_events').getOne(id)
      return healthEventResponseSchema.parse(record)
    }
  })
}

// 列表页筛选条件(全部在前端过滤,数据量小、即时响应)
export interface HealthEventFilters {
  person: string // '' = 全部
  eventTypes: string[] // 多选
  departments: string[]
  from: string // yyyy-MM-dd,含当天
  to: string
  keyword: string // 项目/结论/详述/机构/医师/类型/科属
}

export const emptyHealthEventFilters: HealthEventFilters = {
  person: '',
  eventTypes: [],
  departments: [],
  from: '',
  to: '',
  keyword: ''
}

// 纯函数:按条件前端筛选(供列表页与测试复用)
export function filterHealthEvents(
  events: HealthEvent[],
  filters: HealthEventFilters
): HealthEvent[] {
  const kw = filters.keyword.trim().toLowerCase()
  return events.filter((e) => {
    if (filters.person.trim() && e.person !== filters.person.trim())
      return false
    if (filters.eventTypes.length && !filters.eventTypes.includes(e.event_type))
      return false
    if (
      filters.departments.length &&
      !filters.departments.includes(e.department)
    )
      return false
    if (filters.from && e.happen_at < filters.from) return false
    if (filters.to && e.happen_at > filters.to) return false
    if (kw) {
      const haystack = [
        e.item,
        e.conclusion,
        e.detail,
        e.institution,
        e.doctor,
        e.event_type,
        e.department
      ]
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(kw)) return false
    }
    return true
  })
}

// 纯函数:事件里的人名历史值(筛选下拉与表单联想)
export function personOptionsOf(events: HealthEvent[]): string[] {
  return [...new Set(events.map((e) => e.person).filter(Boolean))].sort()
}

// 纯函数:科属历史值(筛选多选与表单联想)
export function departmentOptionsOf(events: HealthEvent[]): string[] {
  return [...new Set(events.map((e) => e.department).filter(Boolean))].sort()
}

// 创建事件:字段 + 凭证 file ID 数组(JSON body,凭证经 filestore 服务存储)
export async function createHealthEvent(
  data: HealthEventFormFields,
  receiptIds: string[]
): Promise<HealthEvent> {
  const record = await pb
    .collection('health_events')
    .create({ ...data, receipt: receiptIds })
  return healthEventResponseSchema.parse(record)
}

// 更新事件:字段 + 凭证 file ID 数组(JSON body);空数组=清空全部凭证
export async function updateHealthEvent(
  id: string,
  data: HealthEventFormFields,
  receiptIds: string[]
): Promise<HealthEvent> {
  const record = await pb
    .collection('health_events')
    .update(id, { ...data, receipt: receiptIds })
  return healthEventResponseSchema.parse(record)
}

export async function deleteHealthEvent(id: string) {
  await pb.collection('health_events').delete(id)
}
