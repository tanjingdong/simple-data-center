import { Event, eventResponseSchema } from '@/schemas/event-schema'
import { buildOrgFilter, buildPersonFilter } from '@/lib/event-tokens'
import { queryOptions } from '@tanstack/react-query'
import { pb } from './pocketbase'

// 反查某人的事件:token 子串过滤(同 person_tags~ 机制)
export function eventsOfPersonQueryOptions(personId: string) {
  return queryOptions({
    queryKey: ['persons', personId, 'events'],
    queryFn: async () => {
      const result = await pb.collection('events').getList(1, 100, {
        filter: buildPersonFilter(personId),
        sort: '-happen_at'
      })
      return result.items.map((item) => eventResponseSchema.parse(item) as Event)
    }
  })
}

// 反查某组织的事件
export function eventsOfOrgQueryOptions(orgId: string) {
  return queryOptions({
    queryKey: ['organizations', orgId, 'events'],
    queryFn: async () => {
      const result = await pb.collection('events').getList(1, 100, {
        filter: buildOrgFilter(orgId),
        sort: '-happen_at'
      })
      return result.items.map((item) => eventResponseSchema.parse(item) as Event)
    }
  })
}

export async function createEvent(data: {
  happen_at: string
  type?: string
  summary: string
}) {
  await pb.collection('events').create(data)
}

export async function updateEvent(
  id: string,
  data: { happen_at: string; type?: string; summary: string }
) {
  await pb.collection('events').update(id, data)
}

export async function deleteEvent(id: string) {
  await pb.collection('events').delete(id)
}
