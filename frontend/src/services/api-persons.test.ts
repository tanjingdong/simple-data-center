import { describe, expect, it } from 'vitest'
import {
  buildDuplicatePersonFilter,
  buildPersonFilter,
  buildPersonListFilter,
  emptyPersonFilters,
  escapeFilterValue,
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

  it('姓与名都有值才生成同名条件', () => {
    expect(
      buildDuplicatePersonFilter({ ...none, lastName: '康', firstName: '勇' })
    ).toBe("(last_name='康' && first_name='勇')")
    expect(
      buildDuplicatePersonFilter({ ...none, lastName: '康', firstName: '' })
    ).toBe('')
  })

  it('仅手机号生成同手机条件', () => {
    expect(buildDuplicatePersonFilter({ ...none, mobile: '13508749999' })).toBe(
      "(mobile='13508749999')"
    )
  })

  it('同名与同手机以 || 连接并各自加括号', () => {
    expect(
      buildDuplicatePersonFilter({
        lastName: '康',
        firstName: '勇',
        mobile: '13508749999'
      })
    ).toBe("((last_name='康' && first_name='勇') || (mobile='13508749999'))")
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
    ).toBe("(last_name='康' && first_name='勇')")
  })

  it('单引号与反斜杠转义,避免拼坏过滤器', () => {
    expect(escapeFilterValue("a'b\\c")).toBe("a\\'b\\\\c")
    expect(buildDuplicatePersonFilter({ ...none, mobile: "135'00" })).toBe(
      "(mobile='135\\'00')"
    )
  })
})
