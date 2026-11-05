import {
  gtdConditionLabels,
  gtdItemFormSchema,
  gtdItemResponseSchema,
  gtdTypeLabels,
  gtdTypes,
  type GtdItem
} from '@/schemas/gtd-item-schema'
import { describe, expect, it } from 'vitest'
import {
  assigneeNames,
  formatHardTime,
  groupTodayActions,
  gtdDefaultSortKey,
  gtdSortKeys,
  itemLabel,
  joinAssigneeInput,
  normalizeCondition,
  partitionItems,
  sortForList,
  sortItems,
  splitAssigneeInput,
  toPbDate,
  toPbDateTime,
  todayStr,
  trimGroups,
  trimItems,
  weekRange
} from './api-gtd-items'

describe('gtdItemFormSchema', () => {
  const valid = {
    thing: '写周报',
    note: '',
    type: 'todo' as const,
    schedule_on: '2026-09-11',
    hard_time: '',
    condition: '电脑',
    assignee: ['张三'],
    status: 'active' as const
  }

  it('接受完整合法输入', () => {
    expect(gtdItemFormSchema.safeParse(valid).success).toBe(true)
  })

  it('事项名称为空时拒绝', () => {
    const r = gtdItemFormSchema.safeParse({ ...valid, thing: '   ' })
    expect(r.success).toBe(false)
  })

  it('事项名称超过 255 字时拒绝', () => {
    const r = gtdItemFormSchema.safeParse({ ...valid, thing: 'a'.repeat(256) })
    expect(r.success).toBe(false)
  })

  it('生效日期格式非法时拒绝', () => {
    const r = gtdItemFormSchema.safeParse({
      ...valid,
      schedule_on: '2026/09/11'
    })
    expect(r.success).toBe(false)
  })

  it('未知类型时拒绝', () => {
    const r = gtdItemFormSchema.safeParse({ ...valid, type: 'unknown' })
    expect(r.success).toBe(false)
  })

  it('condition 允许空串(表示无/其他)', () => {
    const r = gtdItemFormSchema.safeParse({ ...valid, condition: '' })
    expect(r.success).toBe(true)
  })

  it('condition 允许 5 个枚举值', () => {
    for (const c of ['电脑', '沟通', '外出', '家', '思考']) {
      expect(
        gtdItemFormSchema.safeParse({ ...valid, condition: c }).success
      ).toBe(true)
    }
  })

  it('condition 为枚举外的值时拒绝', () => {
    const r = gtdItemFormSchema.safeParse({ ...valid, condition: '摸鱼' })
    expect(r.success).toBe(false)
  })

  it('硬时间格式非法时拒绝', () => {
    const r = gtdItemFormSchema.safeParse({ ...valid, hard_time: '2026-09-11' })
    expect(r.success).toBe(false)
  })

  it('硬时间合法格式通过', () => {
    const r = gtdItemFormSchema.safeParse({
      ...valid,
      hard_time: '2026-09-11 08:30'
    })
    expect(r.success).toBe(true)
  })
})

describe('gtdItemResponseSchema', () => {
  it('把 PocketBase 返回的日期串截断为日期与分钟精度', () => {
    const parsed = gtdItemResponseSchema.parse({
      id: 'abc123def456ghi',
      owner: 'usr123456789ab',
      thing: '写周报',
      note: null,
      type: 'todo',
      schedule_on: '2026-09-11 00:00:00.000Z',
      hard_time: '2026-09-11 08:30:00.000Z',
      condition: '电脑',
      assignee: ['张三'],
      status: 'active',
      sort_order: 0,
      created: '2026-09-11 00:00:00.000Z',
      updated: '2026-09-11 00:00:00.000Z'
    })
    expect(parsed.schedule_on).toBe('2026-09-11')
    expect(parsed.hard_time).toBe('2026-09-11 08:30')
    expect(parsed.note).toBe('')
  })

  it('对缺失/非法字段做兜底而不是抛错', () => {
    const parsed = gtdItemResponseSchema.parse({ id: 'abc123def456ghi' })
    expect(parsed.thing).toBe('')
    expect(parsed.type).toBe('todo')
    expect(parsed.status).toBe('active')
    expect(parsed.assignee).toEqual([])
    expect(parsed.hard_time).toBe('')
    expect(parsed.sort_order).toBe(0)
  })

  it('assignee 为 null 时兜底为空数组', () => {
    const parsed = gtdItemResponseSchema.parse({
      id: 'abc123def456ghi',
      assignee: null
    })
    expect(parsed.assignee).toEqual([])
  })
})

describe('常量表', () => {
  it('6 种类型都有中文标签', () => {
    for (const t of gtdTypes) {
      expect(gtdTypeLabels[t]).toBeTruthy()
    }
  })

  it('5 种条件都有中文标签', () => {
    for (const c of ['电脑', '沟通', '外出', '家', '思考']) {
      expect(
        gtdConditionLabels[c as keyof typeof gtdConditionLabels]
      ).toBeTruthy()
    }
  })
})

// ============================================================
// 以下为纯函数层测试(Task 3)
// ============================================================

const item = (over: Partial<GtdItem> = {}): GtdItem => ({
  id: 'abc123def456ghi',
  owner: 'usr123456789ab',
  thing: '写周报',
  note: '',
  type: 'todo',
  schedule_on: '2026-09-01',
  hard_time: '',
  condition: '',
  assignee: [],
  status: 'active',
  sort_order: 0,
  created: '2026-09-01 00:00:00.000Z',
  updated: '2026-09-01 00:00:00.000Z',
  ...over
})

describe('todayStr', () => {
  it('按本地时区格式化为 yyyy-MM-dd', () => {
    expect(todayStr(new Date(2026, 8, 11, 23, 30))).toBe('2026-09-11')
  })

  it('跨时区不漂移(用本地年月日而非 UTC)', () => {
    // 本地时间 2026-01-01 00:30,UTC 可能还是前一天
    expect(todayStr(new Date(2026, 0, 1, 0, 30))).toBe('2026-01-01')
  })
})

describe('weekRange', () => {
  it('周三返回本周一~周日', () => {
    // 2026-09-09 是周三
    expect(weekRange('2026-09-09')).toEqual({
      start: '2026-09-07',
      end: '2026-09-13'
    })
  })

  it('周一返回自身为起点', () => {
    expect(weekRange('2026-09-07')).toEqual({
      start: '2026-09-07',
      end: '2026-09-13'
    })
  })

  it('周日归入以周一为起点的本周,而不是下一周', () => {
    expect(weekRange('2026-09-13')).toEqual({
      start: '2026-09-07',
      end: '2026-09-13'
    })
  })

  it('跨月边界正确', () => {
    expect(weekRange('2026-09-02')).toEqual({
      start: '2026-08-31',
      end: '2026-09-06'
    })
  })

  it('跨年边界正确', () => {
    // 2026-01-01 是周四,本周一为 2025-12-29
    expect(weekRange('2026-01-01')).toEqual({
      start: '2025-12-29',
      end: '2026-01-04'
    })
  })
})

describe('sortItems', () => {
  it('先按 sort_order 升序,再按 created 升序', () => {
    const a = item({
      id: 'aaaaaaaaaaaaaaa',
      sort_order: 2,
      created: '2026-09-01 00:00:00.000Z'
    })
    const b = item({
      id: 'bbbbbbbbbbbbbbb',
      sort_order: 0,
      created: '2026-09-05 00:00:00.000Z'
    })
    const c = item({
      id: 'ccccccccccccccc',
      sort_order: 0,
      created: '2026-09-02 00:00:00.000Z'
    })
    expect(sortItems([a, b, c]).map((i) => i.id)).toEqual([
      'ccccccccccccccc',
      'bbbbbbbbbbbbbbb',
      'aaaaaaaaaaaaaaa'
    ])
  })

  it('不修改入参数组', () => {
    const input = [
      item({ id: 'aaaaaaaaaaaaaaa', sort_order: 2 }),
      item({ id: 'bbbbbbbbbbbbbbb' })
    ]
    const snapshot = input.map((i) => i.id)
    sortItems(input)
    expect(input.map((i) => i.id)).toEqual(snapshot)
  })
})

describe('partitionItems', () => {
  const today = '2026-09-11' // 周五,本周一 09-07 ~ 周日 09-13

  it('todo 且无硬时间进今日行动主战场', () => {
    const p = partitionItems([item({ thing: 'A' })], today)
    expect(p.todayActions.map((i) => i.thing)).toEqual(['A'])
    expect(p.hardTime).toEqual([])
  })

  it('设了硬时间的 todo 只进硬时间区,不进今日行动主战场', () => {
    const p = partitionItems(
      [item({ thing: 'A', hard_time: '2026-09-11 08:30' })],
      today
    )
    expect(p.todayActions).toEqual([])
    expect(p.hardTime.map((i) => i.thing)).toEqual(['A'])
  })

  it('非 todo 设了硬时间也进硬时间区(不限 type)', () => {
    const p = partitionItems(
      [item({ thing: 'A', type: 'project', hard_time: '2026-09-11 09:00' })],
      today
    )
    expect(p.hardTime.map((i) => i.thing)).toEqual(['A'])
    expect(p.projects.map((i) => i.thing)).toEqual(['A'])
  })

  it('schedule_on 未来的事项不进任何分区(里程碑除外)', () => {
    const p = partitionItems(
      [item({ thing: 'A', schedule_on: '2026-09-20' })],
      today
    )
    expect(p.todayActions).toEqual([])
    const m = partitionItems(
      [item({ thing: 'M', type: 'milestone', schedule_on: '2026-09-20' })],
      today
    )
    expect(m.milestones).toEqual([])
  })

  it('schedule_on 等于今天的事项进分区(边界:<= 而非 <)', () => {
    const p = partitionItems([item({ thing: 'A', schedule_on: today })], today)
    expect(p.todayActions.map((i) => i.thing)).toEqual(['A'])
  })

  it('里程碑只在落在本周时显示,超期不显示', () => {
    const inWeek = item({
      thing: 'M1',
      type: 'milestone',
      schedule_on: '2026-09-13'
    })
    const expired = item({
      thing: 'M2',
      type: 'milestone',
      schedule_on: '2026-09-06'
    })
    const future = item({
      thing: 'M3',
      type: 'milestone',
      schedule_on: '2026-09-14'
    })
    const p = partitionItems([inWeek, expired, future], today)
    expect(p.milestones.map((i) => i.thing)).toEqual(['M1'])
  })

  it('里程碑不做 schedule_on <= today 的过滤,本周内未来日期也显示', () => {
    const future = item({
      thing: 'M',
      type: 'milestone',
      schedule_on: '2026-09-12'
    })
    expect(
      partitionItems([future], today).milestones.map((i) => i.thing)
    ).toEqual(['M'])
  })

  it('已完成/已取消的事项不进任何分区', () => {
    const done = item({ thing: 'A', status: 'completed' })
    const cancelled = item({ thing: 'B', status: 'cancelled' })
    const p = partitionItems([done, cancelled], today)
    expect([
      ...p.todayActions,
      ...p.hardTime,
      ...p.projects,
      ...p.milestones,
      ...p.tracking,
      ...p.handover,
      ...p.accumulating
    ]).toEqual([])
  })

  it('project / tracking / handover / accumulating 各自归位', () => {
    const p = partitionItems(
      [
        item({ thing: 'P', type: 'project' }),
        item({ thing: 'T', type: 'tracking' }),
        item({ thing: 'H', type: 'handover' }),
        item({ thing: 'L', type: 'accumulating' })
      ],
      today
    )
    expect(p.projects.map((i) => i.thing)).toEqual(['P'])
    expect(p.tracking.map((i) => i.thing)).toEqual(['T'])
    expect(p.handover.map((i) => i.thing)).toEqual(['H'])
    expect(p.accumulating.map((i) => i.thing)).toEqual(['L'])
  })

  it('里程碑进了里程碑区,不出现在今日行动主战场', () => {
    const m = item({ thing: 'M', type: 'milestone', schedule_on: today })
    const p = partitionItems([m], today)
    expect(p.milestones.map((i) => i.thing)).toEqual(['M'])
    expect(p.todayActions).toEqual([])
  })

  it('各区内部按 sort_order/created 排序', () => {
    const late = item({ thing: 'late', sort_order: 1 })
    const early = item({ thing: 'early', sort_order: 0 })
    expect(
      partitionItems([late, early], today).todayActions.map((i) => i.thing)
    ).toEqual(['early', 'late'])
  })
})

describe('groupTodayActions', () => {
  it('按 5 个条件 + @其他 固定顺序分组,空组也保留', () => {
    const groups = groupTodayActions([
      item({ thing: 'A', condition: '电脑' }),
      item({ thing: 'B', condition: '' })
    ])
    expect(groups.map((g) => g.label)).toEqual([
      '@电脑',
      '@沟通 / 电话',
      '@外出 / 户外 / 市场',
      '@家',
      '@阅读 / 思考',
      '@其他'
    ])
    expect(groups[0].items.map((i) => i.thing)).toEqual(['A'])
    expect(groups[5].items.map((i) => i.thing)).toEqual(['B'])
    expect(groups[1].items).toEqual([])
  })

  it('condition 为 null 视为其他', () => {
    const groups = groupTodayActions([
      item({ thing: 'B', condition: null as unknown as string })
    ])
    expect(groups[5].items.map((i) => i.thing)).toEqual(['B'])
  })

  it('condition 为枚举外的历史脏值也归入其他', () => {
    const groups = groupTodayActions([item({ thing: 'C', condition: '摸鱼' })])
    expect(groups[5].items.map((i) => i.thing)).toEqual(['C'])
  })
})

describe('assigneeNames', () => {
  it('数组直接返回', () => {
    expect(assigneeNames(['张三', '李四'])).toEqual(['张三', '李四'])
  })

  it('JSON 字符串解析为数组(兼容旧数据形态)', () => {
    expect(assigneeNames('["张三","李四"]')).toEqual(['张三', '李四'])
  })

  it('普通字符串按逗号拆分', () => {
    expect(assigneeNames('张三,李四')).toEqual(['张三', '李四'])
  })

  it('null / undefined / 空数组返回空数组', () => {
    expect(assigneeNames(null)).toEqual([])
    expect(assigneeNames(undefined)).toEqual([])
    expect(assigneeNames([])).toEqual([])
  })

  it('过滤空串并去空白', () => {
    expect(assigneeNames([' 张三 ', '', '李四'])).toEqual(['张三', '李四'])
  })

  it('过滤非字符串元素', () => {
    expect(assigneeNames(['张三', 42, null])).toEqual(['张三'])
  })

  it('格式非法的 JSON 字符串按普通字符串处理', () => {
    expect(assigneeNames('["未闭合')).toEqual(['["未闭合'])
  })
})

describe('trimGroups', () => {
  const groups = [
    { label: '@电脑', items: ['a', 'b'] },
    { label: '@沟通', items: ['c'] },
    { label: '@其他', items: ['d', 'e', 'f'] }
  ]

  it('容量足够时各组原样保留', () => {
    expect(trimGroups(groups, 10)).toEqual(groups)
    expect(trimGroups(groups, 6)).toEqual(groups)
  })

  it('按分组顺序从头占满,余数才给后面的组', () => {
    const r = trimGroups(groups, 4)
    expect(r.map((g) => g.items)).toEqual([['a', 'b'], ['c'], ['d']])
  })

  it('容量刚好卡在分组边界上', () => {
    const r = trimGroups(groups, 2)
    expect(r.map((g) => g.items)).toEqual([['a', 'b'], [], []])
  })

  it('容量为 0 时各组都空,但组本身保留(版面占位不消失)', () => {
    const r = trimGroups(groups, 0)
    expect(r.map((g) => g.items)).toEqual([[], [], []])
    expect(r.map((g) => g.label)).toEqual(['@电脑', '@沟通', '@其他'])
  })

  it('保留分组自身的其他字段', () => {
    const withExtra = [{ label: '@电脑', condition: '电脑', items: ['a'] }]
    expect(trimGroups(withExtra, 0)[0].condition).toBe('电脑')
  })

  it('不修改入参数组', () => {
    const snapshot = JSON.stringify(groups)
    trimGroups(groups, 1)
    expect(JSON.stringify(groups)).toBe(snapshot)
  })
})

describe('normalizeCondition', () => {
  it('5 个枚举值原样返回', () => {
    for (const c of ['电脑', '沟通', '外出', '家', '思考']) {
      expect(normalizeCondition(c)).toBe(c)
    }
  })

  it('空串返回空串', () => {
    expect(normalizeCondition('')).toBe('')
  })

  it('下拉框的 none 哨兵值归一为空串', () => {
    expect(normalizeCondition('__none__')).toBe('')
  })

  it('枚举外的历史脏值归一为空串', () => {
    expect(normalizeCondition('摸鱼')).toBe('')
    expect(normalizeCondition('电脑 ')).toBe('')
  })
})

describe('itemLabel', () => {
  it('有受让人时用 【事项 | 受让人】 格式', () => {
    expect(
      itemLabel(item({ thing: '交材料', assignee: ['张三', '李四'] }))
    ).toBe('交材料  |  张三,李四')
  })

  it('无受让人时只显示事项', () => {
    expect(itemLabel(item({ thing: '交材料' }))).toBe('交材料')
  })
})

describe('formatHardTime', () => {
  const today = '2026-09-11'

  it('日期是今天时只显示时分', () => {
    expect(formatHardTime('2026-09-11 08:30', today)).toBe('08:30')
  })

  it('日期不是今天时显示月日与时分', () => {
    expect(formatHardTime('2026-09-12 08:30', today)).toBe('09-12 08:30')
  })

  it('空值返回空串', () => {
    expect(formatHardTime('', today)).toBe('')
  })
})

describe('trimItems', () => {
  it('容量足够时不裁剪', () => {
    expect(trimItems([1, 2, 3], 5)).toEqual({ visible: [1, 2, 3], hidden: 0 })
    expect(trimItems([1, 2, 3], 3)).toEqual({ visible: [1, 2, 3], hidden: 0 })
  })

  it('容量不足时保留前 N 条并报告隐藏条数', () => {
    expect(trimItems([1, 2, 3, 4], 2)).toEqual({ visible: [1, 2], hidden: 2 })
  })

  it('容量为 0 时全部隐藏', () => {
    expect(trimItems([1, 2], 0)).toEqual({ visible: [], hidden: 2 })
  })

  it('容量为负数时按 0 处理', () => {
    expect(trimItems([1, 2], -1)).toEqual({ visible: [], hidden: 2 })
  })

  it('不修改入参数组', () => {
    const input = [1, 2, 3]
    trimItems(input, 1)
    expect(input).toEqual([1, 2, 3])
  })
})

// ============================================================
// 日期编码铁律(Task 4)
// PocketBase 的 date 字段按 app timezone 解析裸字符串;带 Z 后缀把墙上时钟
// 按 UTC 编码,读取时 slice 取前缀,即可与 app timezone 配置完全解耦。
// ============================================================

describe('toPbDate / toPbDateTime', () => {
  it('日期编码为 UTC 零点,不受 app timezone 影响', () => {
    expect(toPbDate('2026-09-11')).toBe('2026-09-11 00:00:00.000Z')
  })

  it('日期时间编码为 UTC 墙上时钟', () => {
    expect(toPbDateTime('2026-09-11 08:30')).toBe('2026-09-11 08:30:00.000Z')
  })

  it('与 response schema 的 slice 解码构成往返不变式', () => {
    const d = '2026-12-31'
    const t = '2026-12-31 23:59'
    expect(toPbDate(d).slice(0, 10)).toBe(d)
    expect(toPbDateTime(t).slice(0, 16)).toBe(t)
  })

  it('空值返回空串,便于直接作为可选字段提交', () => {
    expect(toPbDate('')).toBe('')
    expect(toPbDateTime('')).toBe('')
  })

  it('午夜与月末边界不丢位', () => {
    expect(toPbDate('2026-01-01').slice(0, 10)).toBe('2026-01-01')
    expect(toPbDateTime('2026-02-28 00:00').slice(0, 16)).toBe(
      '2026-02-28 00:00'
    )
  })
})

// ============================================================
// 受让人输入往返(修复:输入逗号会被当场吃掉)
// ============================================================

describe('splitAssigneeInput / joinAssigneeInput', () => {
  const roundTrip = (text: string) =>
    joinAssigneeInput(splitAssigneeInput(text))

  it('输入原文本原样回显——这是「能打出第二个名字」的前提', () => {
    for (const t of [
      '张三,',
      '张三,李四',
      '张三, 李四',
      '张三,,李四',
      ',',
      ''
    ]) {
      expect(roundTrip(t)).toBe(t)
    }
  })

  it('逐字符敲入「张三,李四」的每一步都能回显', () => {
    let text = ''
    for (const ch of '张三,李四') {
      text = roundTrip(text + ch)
    }
    expect(text).toBe('张三,李四')
  })

  it('刻意保留空串与首尾空格(清洗交给 assigneeNames)', () => {
    expect(splitAssigneeInput('张三,')).toEqual(['张三', ''])
    expect(splitAssigneeInput(' 张三 , 李四 ')).toEqual([' 张三 ', ' 李四 '])
  })

  it('与 assigneeNames 衔接后得到干净的姓名数组', () => {
    expect(assigneeNames(splitAssigneeInput('张三,, 李四 ,'))).toEqual([
      '张三',
      '李四'
    ])
  })
})

// ============================================================
// 列表页排序
// ============================================================

describe('sortForList', () => {
  const mk = (created: string, over: Partial<GtdItem> = {}) =>
    item({
      id: created.replace(/\D/g, '').padEnd(15, 'x').slice(0, 15),
      created,
      ...over
    })

  const older = mk('2026-09-01 00:00:00.000Z', { thing: '旧' })
  const newer = mk('2026-09-10 00:00:00.000Z', { thing: '新' })

  it('默认排序:录入时间新→旧(刚录入的排最上面)', () => {
    expect(
      sortForList([older, newer], gtdDefaultSortKey).map((i) => i.thing)
    ).toEqual(['新', '旧'])
  })

  it('录入时间旧→新', () => {
    expect(
      sortForList([newer, older], 'created_asc').map((i) => i.thing)
    ).toEqual(['旧', '新'])
  })

  it('生效日期近→远', () => {
    const a = item({ thing: 'A', schedule_on: '2026-09-01' })
    const b = item({ thing: 'B', schedule_on: '2026-09-20' })
    expect(sortForList([b, a], 'schedule_on_asc').map((i) => i.thing)).toEqual([
      'A',
      'B'
    ])
  })

  it('生效日期远→近', () => {
    const a = item({ thing: 'A', schedule_on: '2026-09-01' })
    const b = item({ thing: 'B', schedule_on: '2026-09-20' })
    expect(sortForList([a, b], 'schedule_on_desc').map((i) => i.thing)).toEqual(
      ['B', 'A']
    )
  })

  it('硬时间早→晚,且未设硬时间的排在最后', () => {
    const early = item({ thing: '早', hard_time: '2026-09-16 08:00' })
    const late = item({ thing: '晚', hard_time: '2026-09-16 20:00' })
    const none = item({ thing: '无', hard_time: '' })
    expect(
      sortForList([none, late, early], 'hard_time_asc').map((i) => i.thing)
    ).toEqual(['早', '晚', '无'])
  })

  it('不修改入参数组', () => {
    const input = [older, newer]
    const snapshot = input.map((i) => i.thing)
    sortForList(input, 'created_asc')
    expect(input.map((i) => i.thing)).toEqual(snapshot)
  })

  it('每种排序键都能处理空数组', () => {
    for (const k of gtdSortKeys) {
      expect(sortForList([], k)).toEqual([])
    }
  })
})
