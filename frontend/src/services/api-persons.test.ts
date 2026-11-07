import { describe, expect, it } from 'vitest'
import {
  buildDuplicatePersonFilter,
  buildPersonFilter,
  buildPersonListFilter,
  emptyPersonFilters,
  escapeFilterValue,
  hasDuplicateCriteria,
  matchesDuplicatePerson,
  oneMonthAgoIso
} from './api-persons'

describe('buildPersonFilter', () => {
  it('空过滤返回空字符串', () => {
    expect(buildPersonFilter(emptyPersonFilters)).toBe('')
  })

  it('查询词对聚合列与手机号原词匹配', () => {
    const filter = buildPersonFilter({ ...emptyPersonFilters, query: '张' })
    expect(filter).toBe("(search_text~'张' || mobile~'张')")
  })

  it('跨姓名检索命中聚合列', () => {
    const filter = buildPersonFilter({ ...emptyPersonFilters, query: '康勇' })
    expect(filter).toBe("(search_text~'康勇' || mobile~'康勇')")
  })

  it('带空格的西式顺序输入原样进入比较', () => {
    const filter = buildPersonFilter({ ...emptyPersonFilters, query: '勇 康' })
    expect(filter).toBe("(search_text~'勇 康' || mobile~'勇 康')")
  })

  it('多条件以 && 连接并各自加括号', () => {
    const filter = buildPersonFilter({
      ...emptyPersonFilters,
      query: '张',
      nativePlace: '湖南',
      trustLevel: '4'
    })
    expect(filter).toContain("native_place~'湖南'")
    expect(filter).toContain('trust_level=4')
    expect(filter).toContain(' && ')
  })
})

describe('oneMonthAgoIso', () => {
  it('返回 30 天前(非闰年 3 月 15 日 → 2 月 13 日)', () => {
    const now = new Date('2026-03-15T12:00:00.000Z')
    expect(oneMonthAgoIso(now)).toBe('2026-02-13T12:00:00.000Z')
  })
})

describe('buildPersonListFilter', () => {
  it('viewMode=all 且无基础过滤时返回 undefined(不传 sort,数据库默认序)', () => {
    expect(buildPersonListFilter(emptyPersonFilters, 'all')).toBeUndefined()
  })

  it('viewMode=all 时仅返回基础过滤', () => {
    const filter = buildPersonListFilter(
      { ...emptyPersonFilters, query: '张' },
      'all'
    )
    expect(filter).toBe("(search_text~'张' || mobile~'张')")
  })

  it('viewMode=recent 追加 30 天时间条件', () => {
    const filter = buildPersonListFilter(emptyPersonFilters, 'recent')
    expect(filter).toMatch(/^updated >= '2\d{3}-\d{2}-\d{2}T/)
  })

  it('viewMode=recent 与基础过滤叠加', () => {
    const filter = buildPersonListFilter(
      { ...emptyPersonFilters, query: '张' },
      'recent'
    )
    expect(filter).toMatch(/ && updated >= '/)
  })
})

describe('buildDuplicatePersonFilter', () => {
  const none = { lastName: '', firstName: '', mobile: '' }

  it('姓与名都非空时同时召回「姓+名」与「名 空格 姓」两种形态', () => {
    expect(
      buildDuplicatePersonFilter({ ...none, lastName: '康', firstName: '勇' })
    ).toBe("((search_text~'康勇') || (search_text~'勇 康'))")
  })

  it('只填一侧姓名也发起召回(如姓「李文」对「李」「文」)', () => {
    expect(
      buildDuplicatePersonFilter({ ...none, lastName: '李文', firstName: '' })
    ).toBe("(search_text~'李文')")
    expect(
      buildDuplicatePersonFilter({ ...none, lastName: '', firstName: '勇' })
    ).toBe("(search_text~'勇')")
  })

  it('仅手机号生成同手机条件', () => {
    expect(buildDuplicatePersonFilter({ ...none, mobile: '13508749999' })).toBe(
      "(mobile='13508749999')"
    )
  })

  it('两种姓名形态与同手机以 || 连接并整体加括号', () => {
    expect(
      buildDuplicatePersonFilter({
        lastName: '康',
        firstName: '勇',
        mobile: '13508749999'
      })
    ).toBe(
      "((search_text~'康勇') || (search_text~'勇 康') || (mobile='13508749999'))"
    )
  })

  it('编辑模式排除自身', () => {
    expect(
      buildDuplicatePersonFilter({
        ...none,
        mobile: '135',
        excludeId: 'abc123'
      })
    ).toBe("((mobile='135')) && id != 'abc123'")
  })

  it('值 trim 后参与匹配,空值不下发查询', () => {
    expect(
      buildDuplicatePersonFilter({
        lastName: ' 康 ',
        firstName: ' 勇 ',
        mobile: ' '
      })
    ).toBe("((search_text~'康勇') || (search_text~'勇 康'))")
  })

  it('单引号与反斜杠转义,避免拼坏过滤器', () => {
    expect(escapeFilterValue("a'b\\c")).toBe("a\\'b\\\\c")
    expect(buildDuplicatePersonFilter({ ...none, mobile: "135'00" })).toBe(
      "(mobile='135\\'00')"
    )
    expect(
      buildDuplicatePersonFilter({ ...none, lastName: "a'b", firstName: 'c' })
    ).toBe("((search_text~'a\\'bc') || (search_text~'c a\\'b'))")
  })
})

describe('hasDuplicateCriteria', () => {
  it('姓、名、手机号全为空(含纯空白)时视为无检查条件', () => {
    expect(
      hasDuplicateCriteria({ lastName: '', firstName: '', mobile: '' })
    ).toBe(false)
    expect(
      hasDuplicateCriteria({ lastName: ' ', firstName: '', mobile: ' ' })
    ).toBe(false)
  })

  it('任一侧姓名或手机号非空即视为有检查条件', () => {
    expect(
      hasDuplicateCriteria({ lastName: '李', firstName: '', mobile: '' })
    ).toBe(true)
    expect(
      hasDuplicateCriteria({ lastName: '', firstName: '文', mobile: '' })
    ).toBe(true)
    expect(
      hasDuplicateCriteria({ lastName: '', firstName: '', mobile: '135' })
    ).toBe(true)
  })
})

describe('matchesDuplicatePerson', () => {
  it('录入边界不同但拼接相同视为重复', () => {
    expect(
      matchesDuplicatePerson(
        { last_name: '欧', first_name: '阳锋', mobile: '' },
        { fullName: '欧阳锋', mobile: '' }
      )
    ).toBe(true)
  })

  it('单填姓「李文」可命中库中「李」「文」', () => {
    expect(
      matchesDuplicatePerson(
        { last_name: '李', first_name: '文', mobile: '' },
        { fullName: '李文', mobile: '' }
      )
    ).toBe(true)
  })

  it('「名 空格 姓」形态相同也视为重复', () => {
    expect(
      matchesDuplicatePerson(
        { last_name: '文', first_name: '李', mobile: '' },
        { fullName: 'ZZZ', reversedName: '李 文', mobile: '' }
      )
    ).toBe(true)
  })

  it('拼接后不等的不算重复', () => {
    expect(
      matchesDuplicatePerson(
        { last_name: '李', first_name: '明明', mobile: '' },
        { fullName: '李明', mobile: '' }
      )
    ).toBe(false)
  })

  it('手机号完全相等即命中', () => {
    expect(
      matchesDuplicatePerson(
        { last_name: '康', first_name: '勇', mobile: '13500000000' },
        { fullName: '张三', mobile: '13500000000' }
      )
    ).toBe(true)
  })

  it('无姓名且无手机号时不命中', () => {
    expect(
      matchesDuplicatePerson(
        { last_name: '', first_name: '', mobile: '' },
        { fullName: '', mobile: '' }
      )
    ).toBe(false)
  })
})
