import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { getChatLogs } from '../controllers/assistantController.js'
import ChatLog from '../models/chatLogModel.js'

const mockRes = () => {
  const res = {}
  res.statusCode = 200
  res.status = (c) => { res.statusCode = c; return res }
  res.json = (b) => { res.body = b; return res }
  return res
}

test('getChatLogs returns last logs sorted desc', async () => {
  const fake = [{ message: 'hi', route: 'cloud' }]
  mock.method(ChatLog, 'find', () => ({
    sort: () => ({ limit: () => ({ lean: async () => fake }) }),
  }))
  const req = { query: {} }
  const res = mockRes()
  await getChatLogs(req, res)
  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.body, fake)
  mock.restoreAll()
})
