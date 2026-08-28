import test from 'node:test'
import assert from 'node:assert/strict'
import { createLatestRequest } from '../src/lib/latest-request.js'

test('an older success cannot replace the latest successful upload', () => {
  const requests = createLatestRequest()
  const older = requests.begin()
  const newer = requests.begin()
  let visibleResult = null

  if (requests.isCurrent(newer)) visibleResult = 'newer'
  if (requests.isCurrent(older)) visibleResult = 'older'

  assert.equal(visibleResult, 'newer')
})

test('an older error cannot replace the latest successful upload', () => {
  const requests = createLatestRequest()
  const older = requests.begin()
  const newer = requests.begin()
  let visibleStatus = 'idle'

  if (requests.isCurrent(newer)) visibleStatus = 'ok'
  if (requests.isCurrent(older)) visibleStatus = 'fail'

  assert.equal(visibleStatus, 'ok')
})
