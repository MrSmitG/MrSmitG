import assert from 'node:assert/strict'
import test from 'node:test'
import { payloadForEmbedding } from '../src/lib/payload.ts'

test('preserves significant whitespace in hidden messages', () => {
  assert.equal(payloadForEmbedding('  recovery phrase  '), '  recovery phrase  ')
  assert.equal(payloadForEmbedding('\u2003recovery phrase\u2003'), '\u2003recovery phrase\u2003')
  assert.equal(payloadForEmbedding('   '), '   ')
})

test('retains the existing placeholder for an empty message', () => {
  assert.equal(payloadForEmbedding(''), ' ')
})
