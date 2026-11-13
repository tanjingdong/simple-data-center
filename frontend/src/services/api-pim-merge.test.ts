import { beforeEach, describe, expect, it, vi } from 'vitest'

const { send } = vi.hoisted(() => ({ send: vi.fn() }))

vi.mock('./pocketbase', () => ({ pb: { send } }))

import {
  commitMerge,
  fetchMergePreview,
  type MergeInput
} from './api-pim-merge'

const input: MergeInput = {
  kind: 'persons',
  editingId: 'editing00000001',
  otherId: 'other0000000001',
  fields: { last_name: '李', first_name: '明' }
}

describe('fetchMergePreview', () => {
  beforeEach(() => {
    send.mockReset()
  })

  it('以 POST 调用预览接口,透传请求体与响应', async () => {
    const preview = {
      kind: 'persons' as const,
      survivorId: 'editing00000001',
      survivorIsEditing: true,
      deletedId: 'other0000000001',
      survivorCreated: '2026-11-01T08:00:00Z',
      deletedCreated: '2026-11-02T08:00:00Z',
      fields: [
        {
          key: 'last_name',
          a: '李',
          b: '李',
          result: '李',
          rule: 'same' as const
        }
      ]
    }
    send.mockResolvedValue(preview)

    await expect(fetchMergePreview(input)).resolves.toEqual(preview)
    expect(send).toHaveBeenCalledWith('/api/pim/merge/preview', {
      method: 'POST',
      body: input
    })
  })
})

describe('commitMerge', () => {
  beforeEach(() => {
    send.mockReset()
  })

  it('以 POST 调用合并接口,透传保留者 id 响应', async () => {
    send.mockResolvedValue({ survivorId: 'editing00000001' })

    await expect(commitMerge(input)).resolves.toEqual({
      survivorId: 'editing00000001'
    })
    expect(send).toHaveBeenCalledWith('/api/pim/merge', {
      method: 'POST',
      body: input
    })
  })
})
