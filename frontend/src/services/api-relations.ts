import { Relation, relationResponseSchema } from '@/schemas/relation-schema'
import { queryOptions } from '@tanstack/react-query'
import { pb } from './pocketbase'

// 透传 expand 的关系类型:person_a/person_b 展开为人员对象
type ExpandedPerson = { id: string; last_name: string; first_name: string }
export type RelationWithExpand = Relation & {
  expand?: { person_a?: ExpandedPerson; person_b?: ExpandedPerson }
}

// 某人的全部关系(双向),expand 对方与两人详情
export function relationsOfPersonQueryOptions(personId: string) {
  return queryOptions({
    queryKey: ['persons', personId, 'relations'],
    queryFn: async () => {
      const result = await pb.collection('relations').getList(1, 100, {
        filter: `(person_a='${personId}' || person_b='${personId}')`,
        sort: '-updated',
        expand: 'person_a,person_b'
      })
      return result.items.map(
        (item) =>
          ({
            ...relationResponseSchema.parse(item),
            expand: item.expand as RelationWithExpand['expand']
          }) as RelationWithExpand
      )
    }
  })
}

export async function createRelation(data: {
  person_a: string
  person_b: string
  relation_description: string
}) {
  await pb.collection('relations').create(data)
}

export async function updateRelation(
  id: string,
  data: { person_a: string; person_b: string; relation_description: string }
) {
  await pb.collection('relations').update(id, data)
}

export async function deleteRelation(id: string) {
  await pb.collection('relations').delete(id)
}
