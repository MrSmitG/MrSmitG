import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildCodeGraph, queryGraph } from './graph.ts'

describe('graph llm', () => {
  it('builds nodes for files and symbols', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lf-graph-'))
    mkdirSync(join(dir, 'src'), { recursive: true })
    writeFileSync(
      join(dir, 'src', 'main.ts'),
      `import { sum } from './utils'\nexport function greet(name: string) { return name }\nexport function run() { return sum([1,2]) }\n`,
    )
    writeFileSync(
      join(dir, 'src', 'utils.ts'),
      `export function sum(values: number[]) { return values.reduce((a,b)=>a+b,0) }\n`,
    )
    const graph = buildCodeGraph(dir)
    assert.ok(graph.stats.files >= 2)
    assert.ok(graph.stats.symbols >= 2)
    assert.ok(graph.stats.edges >= 1)
    const names = graph.nodes.map((n) => n.label)
    assert.ok(names.includes('greet'))
    assert.ok(names.includes('sum'))
  })

  it('queries related symbols', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lf-graph-q-'))
    mkdirSync(join(dir, 'src'), { recursive: true })
    writeFileSync(join(dir, 'src', 'a.ts'), `export function alpha() { return 1 }\n`)
    writeFileSync(join(dir, 'src', 'b.ts'), `import { alpha } from './a'\nexport function beta() { return alpha() }\n`)
    const graph = buildCodeGraph(dir)
    const { hits, context } = queryGraph(graph, 'alpha', 8)
    assert.ok(hits.length > 0)
    assert.match(context, /alpha|Graph LLM/i)
  })
})
