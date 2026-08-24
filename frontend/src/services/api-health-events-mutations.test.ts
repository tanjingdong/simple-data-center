import type { HealthEvent } from '@/schemas/health-event-schema'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// mock pocketbase 单例,捕获 create/update 入参
const create = vi.fn(async (body: unknown) => ({
  id: 'abc123def456ghi',
  person: '',
  happen_at: '2026-01-01',
  event_type: '门诊',
  item: '',
  department: '',
  institution: '',
  doctor: '',
  conclusion: '',
  detail: '',
  receipt: (body as { receipt?: string[] })?.receipt ?? [],
  referenced_by: []
}))
const update = vi.fn(async (_id: string, body: unknown) => ({
  id: 'bbb222ccc333ddd',
  person: '',
  happen_at: '2026-01-01',
  event_type: '门诊',
  item: '',
  department: '',
  institution: '',
  doctor: '',
  conclusion: '',
  detail: '',
  receipt: (body as { receipt?: string[] })?.receipt ?? [],
  referenced_by: []
}))

vi.mock('@/services/pocketbase', () => ({
  pb: {
    collection: () => ({ create, update })
  }
}))

const baseFields = {
  person: '李',
  happen_at: '2026-01-01',
  event_type: '门诊',
  item: '',
  department: '',
  institution: '',
  doctor: '',
  conclusion: '',
  detail: ''
}

describe('createHealthEvent / updateHealthEvent', () => {
  beforeEach(() => {
    create.mockClear()
    update.mockClear()
  })

  it('createHealthEvent 以 JSON body 传 receipt(file ID 数组),不带 File', async () => {
    const { createHealthEvent } = await import('./api-health-events')
    const rec: HealthEvent = await createHealthEvent(baseFields, ['f1', 'f2'])
    expect(create).toHaveBeenCalledTimes(1)
    const arg = create.mock.calls[0][0] as Record<string, unknown>
    expect(arg).toMatchObject(baseFields)
    expect(arg.receipt).toEqual(['f1', 'f2'])
    // 不应是 FormData
    expect(arg).not.toBeInstanceOf(FormData)
    expect(rec.receipt).toEqual(['f1', 'f2'])
  })

  it('updateHealthEvent 以 JSON body 传 receipt(ID 数组)', async () => {
    const { updateHealthEvent } = await import('./api-health-events')
    const rec: HealthEvent = await updateHealthEvent(
      'bbb222ccc333ddd',
      baseFields,
      ['f3']
    )
    expect(update).toHaveBeenCalledTimes(1)
    const arg = update.mock.calls[0][1] as Record<string, unknown>
    expect(arg.receipt).toEqual(['f3'])
    expect(rec.receipt).toEqual(['f3'])
  })
})
