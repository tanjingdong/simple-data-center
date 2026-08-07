import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { eventsOfPersonQueryOptions } from '@/services/api-events'
import { personDetailQueryOptions } from '@/services/api-persons'
import { useSuspenseQuery } from '@tanstack/react-query'
import { EventTypeBadge } from './event-type-badge'

// 经历信息:学历类字段 + 最近 10 个事件时间线(右栏)
export default function ExperiencePanel({ personId }: { personId: string }) {
  const { data: person } = useSuspenseQuery(personDetailQueryOptions(personId))
  const { data: events } = useSuspenseQuery(
    eventsOfPersonQueryOptions(personId)
  )
  const recentEvents = events.slice(0, 10)

  return (
    <div className='space-y-4'>
      <Card>
        <CardHeader className='pb-2'>
          <CardTitle className='text-base'>经历信息</CardTitle>
        </CardHeader>
        <CardContent className='flex flex-col gap-1 text-sm'>
          {[
            ['毕业学校', person.graduate_school],
            ['学历', person.degree],
            ['专业', person.major],
            ['继续教育', person.continuing_edu]
          ]
            .filter(([, v]) => v)
            .map(([label, value]) => (
              <div key={label as string} className='flex gap-2 py-1'>
                <span className='text-muted-foreground w-20 shrink-0'>
                  {label}
                </span>
                <span className='flex-1'>{value}</span>
              </div>
            ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className='pb-2'>
          <CardTitle className='text-base'>最近事件</CardTitle>
        </CardHeader>
        <CardContent>
          {recentEvents.length === 0 ? (
            <p className='text-muted-foreground text-sm'>暂无事件记录</p>
          ) : (
            <ul className='space-y-3'>
              {recentEvents.map((event) => (
                <li key={event.id} className='text-sm'>
                  <div className='text-muted-foreground flex items-center gap-2 text-xs tabular-nums'>
                    {event.happen_at}
                    <EventTypeBadge type={event.type ?? ''} />
                    {event.expand?.org_id?.name && (
                      <span>{event.expand.org_id.name}</span>
                    )}
                  </div>
                  <p className='mt-0.5'>{event.summary}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
