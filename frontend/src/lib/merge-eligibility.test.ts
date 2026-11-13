import { describe, expect, it } from 'vitest'
import { isSameOrganizationName, isSamePersonName } from './merge-eligibility'

describe('isSamePersonName', () => {
  it('姓与名顺序一致时同名', () => {
    expect(
      isSamePersonName(
        { last_name: '李', first_name: '明' },
        { last_name: '李', first_name: '明' }
      )
    ).toBe(true)
  })

  it('录入边界不同但拼接相同视为同名', () => {
    expect(
      isSamePersonName(
        { last_name: '欧阳', first_name: '锋' },
        { last_name: '欧', first_name: '阳锋' }
      )
    ).toBe(true)
  })

  it('西式形态(名 空格 姓)相同视为同名', () => {
    expect(
      isSamePersonName(
        { last_name: 'Ann', first_name: 'Mary Jane' },
        { last_name: 'Jane Ann', first_name: 'Mary' }
      )
    ).toBe(true)
  })

  it('姓或名为空时不视为同名(后端合并校验拒绝空白身份列)', () => {
    expect(
      isSamePersonName(
        { last_name: '', first_name: '张三' },
        { last_name: '张', first_name: '三' }
      )
    ).toBe(false)
    expect(
      isSamePersonName(
        { last_name: '张', first_name: '' },
        { last_name: '张', first_name: '' }
      )
    ).toBe(false)
    expect(
      isSamePersonName(
        { last_name: '张', first_name: '三' },
        { last_name: '', first_name: '张三' }
      )
    ).toBe(false)
  })

  it('拼接后不等的不同名', () => {
    expect(
      isSamePersonName(
        { last_name: '李', first_name: '明' },
        { last_name: '李', first_name: '明明' }
      )
    ).toBe(false)
  })
})

describe('isSameOrganizationName', () => {
  it('仅首尾空白不同的名称视为同名', () => {
    expect(isSameOrganizationName(' 示例公司 ', '示例公司')).toBe(true)
  })

  it('名称不等或为空时不视为同名', () => {
    expect(isSameOrganizationName('示例公司', '另一家公司')).toBe(false)
    expect(isSameOrganizationName('   ', '')).toBe(false)
  })
})
