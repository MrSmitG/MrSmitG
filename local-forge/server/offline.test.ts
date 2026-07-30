import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  assertCanUseInternet,
  assertLocalProvider,
  isLocalBaseUrl,
} from './offline.ts'

describe('offline guards', () => {
  it('accepts localhost and local:// URLs', () => {
    assert.equal(isLocalBaseUrl('http://127.0.0.1:11434'), true)
    assert.equal(isLocalBaseUrl('http://localhost:1234/v1'), true)
    assert.equal(isLocalBaseUrl('local://demo'), true)
    assert.equal(isLocalBaseUrl('https://api.openai.com/v1'), false)
  })

  it('blocks remote providers when offline', () => {
    assert.throws(
      () => assertLocalProvider('https://api.openai.com/v1', true),
      /localhost/,
    )
    assert.doesNotThrow(() => assertLocalProvider('http://127.0.0.1:11434', true))
    assert.doesNotThrow(() => assertLocalProvider('https://api.openai.com/v1', false))
  })

  it('blocks downloads when offline', () => {
    assert.throws(() => assertCanUseInternet(true, 'downloading models'), /Offline mode/)
    assert.doesNotThrow(() => assertCanUseInternet(false, 'downloading models'))
  })
})
