import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { Suspense } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import PersonRelationsSummary from './person-relations-summary'

type Relation = {
  id: string
  person_a: string
  person_b: string
  relation_description: string
  expand?: {
    person_a?: { id: string; last_name: string; first_name: string }
    person_b?: { id: string; last_name: string; first_name: string }
  }
}

function makeRelations(n: number): Relation[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `r${i}`,
    person_a: 'p1',
    person_b: `p${i}`,
    relation_description: `关系描述 ${i}`,
    expand: {
      person_a: { id: 'p1', last_name: '张', first_name: '三' },
      person_b: { id: `p${i}`, last_name: '李', first_name: `${i}` }
    }
  }))
}

function renderSummary(relations: Relation[]): string {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } }
  })
  queryClient.setQueryData(['persons', 'p1', 'relations'], relations)
  return renderToStaticMarkup(
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(
        Suspense,
        { fallback: React.createElement('span', null, 'loading') },
        React.createElement(PersonRelationsSummary, {
          personId: 'p1',
          onSelectTarget: () => {},
          onViewAll: () => {}
        })
      )
    )
  )
}

describe('PersonRelationsSummary', () => {
  it('7 条时只显示前 6 条，并出现「查看全部（7）」', () => {
    const html = renderSummary(makeRelations(7))
    expect((html.match(/<li>/g) ?? []).length).toBe(6)
    expect(html).toContain('查看全部（7）')
    expect(html).toContain('关系描述 5')
    expect(html).not.toContain('关系描述 6')
  })

  it('恰好 6 条时不出现「查看全部」', () => {
    const html = renderSummary(makeRelations(6))
    expect((html.match(/<li>/g) ?? []).length).toBe(6)
    expect(html).not.toContain('查看全部')
  })

  it('无关系时显示「暂无关系记录」，不出现「查看全部」', () => {
    const html = renderSummary([])
    expect(html).toContain('暂无关系记录')
    expect(html).not.toContain('查看全部')
    expect(html).not.toContain('<li>')
  })

  it('expand 缺失时显示「未知」，且不渲染可点击按钮', () => {
    const html = renderSummary([
      {
        id: 'r0',
        person_a: 'p1',
        person_b: 'p2',
        relation_description: '旧关系'
      }
    ])
    expect(html).toContain('未知')
    expect(html).toContain('旧关系')
    expect(html).toContain('title="旧关系"')
    expect(html).not.toContain('<button')
  })
})
