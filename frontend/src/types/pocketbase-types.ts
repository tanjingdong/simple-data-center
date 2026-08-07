/**
 * 本文件手写维护,与 backend/pb_schema.json 字段一致(未使用 typegen)
 */
import type PocketBase from 'pocketbase'
import type { RecordService } from 'pocketbase'

export enum Collections {
  Persons = 'persons',
  Organizations = 'organizations',
  Relations = 'relations',
  PersonOrgLinks = 'person_org_links',
  Events = 'events',
  ToolsSettings = 'tools_settings',
  Users = 'users'
}

export type IsoDateString = string
export type RecordIdString = string

export type BaseSystemFields<T = never> = {
  id: RecordIdString
  created: IsoDateString
  updated: IsoDateString
  collectionId: string
  collectionName: Collections
  expand?: T
}

export type AuthSystemFields<T = never> = {
  email: string
  emailVisibility: boolean
  username: string
  verified: boolean
} & BaseSystemFields<T>

// —— persons ——
export type PersonsRecord = {
  last_name: string
  first_name: string
  gender?: '' | '男' | '女'
  birthday?: string
  id_card?: string
  ethnicity?: string
  blood_type?: '' | 'A' | 'B' | 'AB' | 'O'
  zodiac?: string
  native_place?: string
  birth_place?: string
  political_status?: string
  person_tags?: string
  social_tags?: string
  nickname?: string
  current_org_id?: RecordIdString
  admin_position?: string
  tech_title?: string
  legal_info?: string
  graduate_school?: string
  degree?: '' | '专科' | '本科' | '硕士' | '博士'
  major?: string
  continuing_edu?: string
  mobile?: string
  office_phone?: string
  email?: string
  office_address?: string
  home_address?: string
  interests?: string
  children_info?: string
  taboo?: string
  concern?: string
  trust_level: number
}

// —— organizations ——
export type OrganizationsRecord = {
  name: string
  type?: string
  importance_level: number
  phone?: string
  email?: string
  map?: string
  address?: string
  notes?: string
}

// —— relations ——
export type RelationsRecord = {
  person_a: RecordIdString
  person_b: RecordIdString
  relation_description: string
}

// —— person_org_links ——
export type PersonOrgLinksRecord = {
  person_id: RecordIdString
  org_id: RecordIdString
  link_description: string
}

// —— events ——
export type EventsRecord = {
  person_id: RecordIdString
  org_id?: RecordIdString
  happen_at: string
  type?: string
  summary: string
}

// —— tools_settings ——
export type ToolsSettingsRecord = {
  option: string
  description?: string
  type: 'string' | 'number' | 'bool'
  value?: string
}

// —— users ——
export type UsersRecord = {
  authWithPasswordAvailable?: boolean
  avatar?: string
  name?: string
}

// Response 类型(含系统字段)
export type PersonsResponse<Texpand = unknown> = Required<PersonsRecord> &
  BaseSystemFields<Texpand>
export type OrganizationsResponse<Texpand = unknown> = Required<OrganizationsRecord> &
  BaseSystemFields<Texpand>
export type RelationsResponse<Texpand = unknown> = Required<RelationsRecord> &
  BaseSystemFields<Texpand>
export type PersonOrgLinksResponse<Texpand = unknown> = Required<PersonOrgLinksRecord> &
  BaseSystemFields<Texpand>
export type EventsResponse<Texpand = unknown> = Required<EventsRecord> &
  BaseSystemFields<Texpand>
export type ToolsSettingsResponse<Texpand = unknown> = Required<ToolsSettingsRecord> &
  BaseSystemFields<Texpand>
export type UsersResponse<Texpand = unknown> = Required<UsersRecord> &
  AuthSystemFields<Texpand>

export type CollectionRecords = {
  persons: PersonsRecord
  organizations: OrganizationsRecord
  relations: RelationsRecord
  person_org_links: PersonOrgLinksRecord
  events: EventsRecord
  tools_settings: ToolsSettingsRecord
  users: UsersRecord
}

export type CollectionResponses = {
  persons: PersonsResponse
  organizations: OrganizationsResponse
  relations: RelationsResponse
  person_org_links: PersonOrgLinksResponse
  events: EventsResponse
  tools_settings: ToolsSettingsResponse
  users: UsersResponse
}

export type TypedPocketBase = PocketBase & {
  collection(idOrName: 'persons'): RecordService<PersonsResponse>
  collection(idOrName: 'organizations'): RecordService<OrganizationsResponse>
  collection(idOrName: 'relations'): RecordService<RelationsResponse>
  collection(idOrName: 'person_org_links'): RecordService<PersonOrgLinksResponse>
  collection(idOrName: 'events'): RecordService<EventsResponse>
  collection(idOrName: 'tools_settings'): RecordService<ToolsSettingsResponse>
  collection(idOrName: 'users'): RecordService<UsersResponse>
}
