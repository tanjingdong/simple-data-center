// 关系记录中「对方」的解析与概况页摘要截取（纯函数，便于单测）
export const RELATION_PREVIEW_LIMIT = 6

export type RelationPeer = {
  id: string
  last_name: string
  first_name: string
}

// 关系记录的最小结构：仅用到两侧 id 与 expand 的人员
export type RelationWithPeers = {
  person_a: string
  person_b: string
  expand?: { person_a?: RelationPeer; person_b?: RelationPeer }
}

// 找出关系记录中不等于当前人员的一侧；expand 缺失或两侧都不匹配时返回 undefined
export function getRelationOtherPerson(
  relation: RelationWithPeers,
  personId: string
): RelationPeer | undefined {
  const a = relation.expand?.person_a
  const b = relation.expand?.person_b
  if (a?.id === personId) return b
  if (b?.id === personId) return a
  return undefined
}

export function formatRelationPeerName(peer?: RelationPeer): string {
  return peer ? `${peer.last_name}${peer.first_name}` : '未知'
}

// 概况页只展示前 N 条（顺序沿用查询的 -updated）
export function takeRelationPreview<T>(
  relations: readonly T[],
  limit: number = RELATION_PREVIEW_LIMIT
): T[] {
  return relations.slice(0, limit)
}
