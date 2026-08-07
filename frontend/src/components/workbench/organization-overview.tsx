import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Organization } from '@/schemas/organization-schema'
import { type ReactNode } from 'react'
import { TrustStars } from './trust-stars'

function FieldRow({
  label,
  value,
  node
}: {
  label: string
  value?: string
  node?: ReactNode
}) {
  if (!value && !node) return null
  return (
    <div className='flex gap-2 py-1 text-sm'>
      <span className='text-muted-foreground w-20 shrink-0'>{label}</span>
      <span className='flex-1'>{value ?? node}</span>
    </div>
  )
}

// 组织概况:名称、类型、资源评级星级、电话、邮箱、地图链接(可点开)、地址、备注
export default function OrganizationOverview({
  organization
}: {
  organization: Organization
}) {
  const hasDetail =
    organization.type ||
    organization.phone ||
    organization.email ||
    organization.map ||
    organization.address ||
    organization.notes

  return (
    <div className='space-y-4'>
      <Card>
        <CardHeader className='pb-2'>
          <CardTitle className='flex items-center gap-2 text-lg'>
            <span>{organization.name}</span>
            <TrustStars value={organization.importance_level} />
          </CardTitle>
        </CardHeader>
        <CardContent className='space-y-1'>
          {organization.type && (
            <span className='bg-muted mr-1 inline-block rounded px-1.5 py-0.5 text-xs'>
              {organization.type}
            </span>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className='pb-2'>
          <CardTitle className='text-base'>基本信息</CardTitle>
        </CardHeader>
        <CardContent className='flex flex-col'>
          <FieldRow label='类型' value={organization.type} />
          <FieldRow label='电话' value={organization.phone} />
          <FieldRow label='邮箱' value={organization.email} />
          <FieldRow
            label='地图'
            node={
              organization.map ? (
                <a
                  href={organization.map}
                  target='_blank'
                  rel='noreferrer'
                  className='text-primary underline'>
                  {organization.map}
                </a>
              ) : undefined
            }
          />
          <FieldRow label='地址' value={organization.address} />
          <FieldRow
            label='备注'
            node={
              organization.notes ? (
                <span className='whitespace-pre-line'>{organization.notes}</span>
              ) : undefined
            }
          />
          {!hasDetail && <p className='text-muted-foreground text-sm'>暂无内容</p>}
        </CardContent>
      </Card>
    </div>
  )
}
