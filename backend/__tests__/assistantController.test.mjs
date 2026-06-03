import { test, mock, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import { getChatLogs, postChat, rawQuery } from '../controllers/assistantController.js'
import ChatLog from '../models/chatLogModel.js'

const mockRes = () => {
  const res = {}
  res.statusCode = 200
  res.status = (c) => { res.statusCode = c; return res }
  res.json = (b) => { res.body = b; return res }
  return res
}

afterEach(() => {
  mock.restoreAll()
  delete global.fetch
  delete process.env.N8N_ASSISTANT_WEBHOOK_URL
  delete process.env.ASSISTANT_VULNERABLE_MODE
})

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
})

test('getChatLogs honors a valid ?limit', async () => {
  let capturedLimit
  mock.method(ChatLog, 'find', () => ({
    sort: () => ({ limit: (n) => { capturedLimit = n; return { lean: async () => [] } } }),
  }))
  await getChatLogs({ query: { limit: '50' } }, mockRes())
  assert.equal(capturedLimit, 50)
})

test('getChatLogs clamps invalid ?limit to 100', async () => {
  let capturedLimit
  mock.method(ChatLog, 'find', () => ({
    sort: () => ({ limit: (n) => { capturedLimit = n; return { lean: async () => [] } } }),
  }))
  await getChatLogs({ query: { limit: '-5' } }, mockRes())
  assert.equal(capturedLimit, 100)
})

test('postChat forwards trusted userId + JWT to n8n and returns reply', async () => {
  process.env.N8N_ASSISTANT_WEBHOOK_URL = 'http://n8n.test/webhook/chat'
  let captured
  global.fetch = async (url, opts) => {
    captured = { url, opts }
    return { ok: true, json: async () => ({ reply: 'Привет, Иван!' }) }
  }
  const req = {
    body: { message: 'где мой заказ?' },
    user: { _id: 'u1', name: 'Иван' },
    headers: { authorization: 'Bearer JWT123' },
  }
  const res = mockRes()
  await postChat(req, res)
  const sent = JSON.parse(captured.opts.body)
  assert.equal(captured.url, 'http://n8n.test/webhook/chat')
  assert.equal(sent.userId, 'u1')
  assert.equal(sent.userName, 'Иван')
  assert.equal(sent.message, 'где мой заказ?')
  assert.equal(sent.token, 'JWT123')
  assert.deepEqual(res.body, { reply: 'Привет, Иван!' })
})

test('postChat returns 500 when webhook URL is not configured', async () => {
  delete process.env.N8N_ASSISTANT_WEBHOOK_URL
  const req = { body: { message: 'hi' }, user: { _id: 'u1', name: 'A' }, headers: {} }
  const res = mockRes()
  await assert.rejects(() => postChat(req, res))
  assert.equal(res.statusCode, 500)
})

test('postChat returns 400 when message is missing', async () => {
  process.env.N8N_ASSISTANT_WEBHOOK_URL = 'http://n8n.test/webhook/chat'
  const req = { body: {}, user: { _id: 'u1', name: 'A' }, headers: {} }
  const res = mockRes()
  await assert.rejects(() => postChat(req, res))
  assert.equal(res.statusCode, 400)
})

test('postChat returns 502 when router responds not ok', async () => {
  process.env.N8N_ASSISTANT_WEBHOOK_URL = 'http://n8n.test/webhook/chat'
  global.fetch = async () => ({ ok: false, json: async () => ({}) })
  const req = { body: { message: 'hi' }, user: { _id: 'u1', name: 'A' }, headers: {} }
  const res = mockRes()
  await assert.rejects(() => postChat(req, res))
  assert.equal(res.statusCode, 502)
})

test('rawQuery is blocked when ASSISTANT_VULNERABLE_MODE is off', async () => {
  process.env.ASSISTANT_VULNERABLE_MODE = 'false'
  const req = { body: { collection: 'users', filter: {} }, user: { _id: 'u1' } }
  const res = mockRes()
  await assert.rejects(() => rawQuery(req, res))
  assert.equal(res.statusCode, 403)
})

test('rawQuery dumps all docs when vulnerable mode is on (the hole)', async () => {
  process.env.ASSISTANT_VULNERABLE_MODE = 'true'
  const all = [{ email: 'a@b.ru' }, { email: 'c@d.ru' }]
  mock.method(mongoose.connection, 'collection', () => ({
    find: () => ({ toArray: async () => all }),
  }))
  const req = { body: { collection: 'users', filter: {} }, user: { _id: 'u1' } }
  const res = mockRes()
  await rawQuery(req, res)
  assert.deepEqual(res.body, all) // утекли ВСЕ — демонстрация уязвимости
})
