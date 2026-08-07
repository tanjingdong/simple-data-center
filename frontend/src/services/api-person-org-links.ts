import {
  PersonOrgLink,
  personOrgLinkResponseSchema
} from '@/schemas/person-org-link-schema'
import { queryOptions } from '@tanstack/react-query'
import { pb } from './pocketbase'

// 透传 expand 的链接类型:org_id 展开为组织对象
type ExpandedOrg = { name: string }
export type LinkWithOrg = PersonOrgLink & {
  expand?: { org_id?: ExpandedOrg }
}

export function linksOfPersonQueryOptions(personId: string) {
  return queryOptions({
    queryKey: ['persons', personId, 'links'],
    queryFn: async () => {
      const result = await pb.collection('person_org_links').getList(1, 100, {
        filter: `person_id='${personId}'`,
        sort: '-updated',
        expand: 'org_id'
      })
      return result.items.map(
        (item) =>
          ({
            ...personOrgLinkResponseSchema.parse(item),
            expand: item.expand as LinkWithOrg['expand']
          }) as LinkWithOrg
      )
    }
  })
}

export function linksOfOrgQueryOptions(orgId: string) {
  return queryOptions({
    queryKey: ['organizations', orgId, 'members'],
    queryFn: async () => {
      const result = await pb.collection('person_org_links').getList(1, 100, {
        filter: `org_id='${orgId}'`,
        sort: '-updated',
        expand: 'person_id'
      })
      return result.items.map(
        (item) =>
          ({
            ...personOrgLinkResponseSchema.parse(item),
            expand: item.expand as {
              person_id?: { last_name: string; first_name: string }
            }
          }) as PersonOrgLink & {
            expand?: { person_id?: { last_name: string; first_name: string } }
          }
      )
    }
  })
}

export async function createLink(data: {
  person_id: string
  org_id: string
  link_description: string
}) {
  await pb.collection('person_org_links').create(data)
}

export async function deleteLink(id: string) {
  await pb.collection('person_org_links').delete(id)
}
