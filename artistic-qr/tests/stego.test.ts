import assert from 'node:assert/strict'
import test from 'node:test'
import { embedPayload } from '../src/lib/stego.ts'

test('rejects impossible payloads before allocating a UTF-8 buffer', () => {
  const originalTextEncoder = globalThis.TextEncoder
  let encoderConstructions = 0

  class UnexpectedTextEncoder {
    constructor() {
      encoderConstructions++
    }

    encode() {
      throw new Error('TextEncoder should not be reached')
    }
  }

  Object.defineProperty(globalThis, 'TextEncoder', {
    configurable: true,
    value: UnexpectedTextEncoder,
  })

  try {
    assert.throws(
      () => embedPayload({} as ImageData, 'x'.repeat(10_000_000)),
      /Message too long \(max 2048 bytes\)/,
    )
    assert.equal(encoderConstructions, 0)
  } finally {
    Object.defineProperty(globalThis, 'TextEncoder', {
      configurable: true,
      value: originalTextEncoder,
    })
  }
})
