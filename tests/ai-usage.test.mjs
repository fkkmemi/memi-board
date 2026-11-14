import assert from 'node:assert/strict'
import { test } from 'node:test'
import { aiUsageOf, aiUsageSummary, AI_USAGE_WINDOW_MS } from '../src/utils/aiUsage.ts'

const at = ms => ({ toMillis: () => ms })
const NOW = 1_000_000_000_000

test('writing and image usage read different fields', () => {
  const data = { aiWritingCount: 7, aiWritingPending: 1, aiWritingWindowAt: at(NOW - 1000), aiImageCount: 2, aiImagePending: 0, aiImageWindowAt: at(NOW - 1000) }
  assert.deepEqual(aiUsageSummary(data, 'writing', 20, NOW).used, 8)
  assert.equal(aiUsageSummary(data, 'image', 5, NOW).used, 2)
  assert.equal(aiUsageSummary(data, 'image', 5, NOW).remaining, 3)
})

test('an expired window counts as unused and shows no reset time', () => {
  const data = { aiImageCount: 5, aiImagePending: 1, aiImageWindowAt: at(NOW - AI_USAGE_WINDOW_MS - 1) }
  assert.equal(aiUsageOf(data, 'image', NOW).active, false)
  assert.deepEqual(aiUsageSummary(data, 'image', 5, NOW), { used: 0, limit: 5, remaining: 5, hours: 0 })
})

test('used never exceeds the limit and missing data is zero', () => {
  assert.equal(aiUsageSummary({ aiImageCount: 9, aiImageWindowAt: at(NOW) }, 'image', 5, NOW).used, 5)
  assert.deepEqual(aiUsageSummary(null, 'writing', 20, NOW), { used: 0, limit: 20, remaining: 20, hours: 0 })
})

test('hours until reset rounds up and is at least one', () => {
  assert.equal(aiUsageSummary({ aiImageWindowAt: at(NOW - AI_USAGE_WINDOW_MS + 60_000) }, 'image', 5, NOW).hours, 1)
  assert.equal(aiUsageSummary({ aiImageWindowAt: at(NOW) }, 'image', 5, NOW).hours, 24)
})
