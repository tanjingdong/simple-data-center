import { Event, eventResponseSchema } from '@/schemas/event-schema'
import { queryOptions } from '@tanstack/react-query'
import { pb } from './pocketbase'

// 事件展开类型:org_id(组织)与 person_id(人员)
export type EventWithExpand = Event & {
  expand?: {
    org_id?: { name: string }
    person_id?: { last_name: string; first_name: string }
  }
}

export function eventsOfPersonQueryOptions(personId: string) {
  return queryOptions({
    queryKey: ['persons', personId, 'events'],
    queryFn: async () => {
      const result = await pb.collection('events').getList(1, 100, {
        filter: `person_id='${personId}'`,
        sort: '-happen_at',
        expand: 'org_id'
      })
      return result.items.map(
        (item) =>
          ({
            ...eventResponseSchema.parse(item),
            expand: item.expand as EventWithExpand['expand']
          }) as EventWithExpand
      )
    }
  })
}

export function eventsOfOrgQueryOptions(orgId: string) {
  return queryOptions({
    queryKey: ['organizations', orgId, 'events'],
    queryFn: async () => {
      const result = await pb.collection('events').getList(1, 100, {
        filter: `org_id='${orgId}'`,
        sort: '-happen_at',
        expand: 'person_id'
      })
      return result.items.map(
        (item) =>
          ({
            ...eventResponseSchema.parse(item),
            expand: item.expand as EventWithExpand['expand']
          }) as EventWithExpand
      )
    }
  })
}

export async function createEvent(data: {
  person_id: string
  org_id?: string
  happen_at: string
  type?: string
  summary: string
}) {
  // org_id 空串与 undefined 均视为未关联组织(后端钩子容忍空值)
  await pb.collection('events').create({
    ...data,
    org_id: data.org_id || ''
  })
}

export async function updateEvent(
  id: string,
  data: {
    person_id?: string
    happen_at: string
    type?: string
    summary: string
    org_id?: string
  }
) {
  await pb.collection('events').update(id, {
    ...data,
    org_id: data.org_id || ''
  })
}

export async function deleteEvent(id: string) {
  await pb.collection('events').delete(id)
}
