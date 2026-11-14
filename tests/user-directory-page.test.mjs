import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readUserDirectoryPage, USER_DIRECTORY_ROLES } from '../src/utils/userDirectoryPage.ts'

const source = [
  { id: 'a', name: 'Same', role: 'owner' },
  { id: 'b', name: 'Same', role: 'owner' },
  { id: 'c', name: 'Charlie', role: 'manager' },
  { id: 'd', name: 'Delta', role: 'user' },
  { id: 'e', name: 'Echo', role: 'user' },
  { id: 'f', name: 'Foxtrot', role: 'user' },
]

function reader(sort, direction, rows = source) {
  const calls = []
  const readBatch = async (role, after, count) => {
    calls.push({ role, after, count })
    let ordered = rows.filter(row => role === null || row.role === role)
    ordered.sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name) : 0) || a.id.localeCompare(b.id))
    if (direction === 'desc') ordered.reverse()
    const start = after ? ordered.findIndex(row => row.id === after.id) + 1 : 0
    return ordered.slice(start, start + count)
  }
  return { readBatch, calls }
}

for (const sort of ['name', 'role', 'joined', 'visited', 'updated']) {
  for (const direction of ['asc', 'desc']) {
    test(`${sort}/${direction}: cursor pages keep all users exactly once, including tied names and empty role groups`, async () => {
      const { readBatch, calls } = reader(sort, direction)
      const actual = []
      let cursor = null
      let hasNext = true
      while (hasNext) {
        const page = await readUserDirectoryPage({ sort, direction, pageSize: 2, cursor, readBatch })
        assert.ok(page.documents.length <= 2)
        actual.push(...page.documents.map(doc => doc.id))
        cursor = page.cursor
        hasNext = page.hasNext
      }
      // Date sorts read one flat batch like the name sort; here the mock orders them by id (ties are the point).
      const expected = [...source].sort((a, b) => sort === 'role'
        ? USER_DIRECTORY_ROLES.indexOf(a.role) - USER_DIRECTORY_ROLES.indexOf(b.role) || a.id.localeCompare(b.id)
        : (sort === 'name' ? a.name.localeCompare(b.name) : 0) || a.id.localeCompare(b.id))
      if (direction === 'desc') expected.reverse()
      assert.deepEqual(actual, expected.map(doc => doc.id))
      assert.ok(calls.every(call => call.count >= 1 && call.count <= 3))
    })
  }
}

test('an exactly full final page has no next page, even with empty trailing role groups', async () => {
  const { readBatch } = reader('role', 'asc', source.slice(0, 2))
  const page = await readUserDirectoryPage({ sort: 'role', direction: 'asc', pageSize: 2, cursor: null, readBatch })
  assert.equal(page.hasNext, false)
  assert.deepEqual(page.documents.map(doc => doc.id), ['a', 'b'])
})

test('the lookahead user across a role boundary remains on the next page', async () => {
  const { readBatch } = reader('role', 'asc')
  const options = { sort: 'role', direction: 'asc', pageSize: 2, readBatch }
  const first = await readUserDirectoryPage({ ...options, cursor: null })
  assert.equal(first.hasNext, true)
  const second = await readUserDirectoryPage({ ...options, cursor: first.cursor })
  assert.deepEqual(second.documents.map(doc => doc.id), ['c', 'd'])
  const repeated = await readUserDirectoryPage({ ...options, cursor: null })
  assert.deepEqual(repeated, first)
})

test('empty collections terminate without a next page', async () => {
  for (const sort of ['name', 'role']) {
    const { readBatch } = reader(sort, 'asc', [])
    const page = await readUserDirectoryPage({ sort, direction: 'asc', pageSize: 25, cursor: null, readBatch })
    assert.deepEqual(page.documents, [])
    assert.equal(page.hasNext, false)
    assert.equal(page.cursor, null)
  }
})

test('query failures propagate so a failed page cannot look like an empty success', async () => {
  await assert.rejects(readUserDirectoryPage({
    sort: 'name', direction: 'asc', pageSize: 25, cursor: null,
    readBatch: async () => { throw new Error('permission-denied') },
  }), /permission-denied/)
})
