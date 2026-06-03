// Characterization tests for SEC-001 — IDOR on getOrderById
// (Stage 2, finding #1). Written BEFORE the fix; they pin the CURRENT
// behavior of backend/controllers/orderController.js:getOrderById.
//
// Runner: node --test --experimental-test-module-mocks  (Node >=22)
// The Mongoose Order model is mock.module'd by absolute file URL so the
// controller's `import Order from '../models/orderModel.js'` resolves to the
// mock — no live MongoDB required.

import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const orderModelUrl = pathToFileURL(resolve('backend/models/orderModel.js')).href

// `stored` is what Order.findById(...).populate(...) resolves to.
// null => order not found.
let stored = null

function makeOrder(ownerId) {
  return {
    _id: 'order1',
    user: { _id: ownerId, name: 'Owner', email: 'owner@example.com' },
    orderItems: [{ name: 'Item', qty: 1 }],
    shippingAddress: { address: '1 Secret St' },
  }
}

mock.module(orderModelUrl, {
  defaultExport: {
    findById: () => ({ populate: async () => stored }),
  },
})

const { getOrderById } = await import(
  pathToFileURL(resolve('backend/controllers/orderController.js')).href
)

function mockRes() {
  return {
    statusCode: 200,
    body: undefined,
    status(c) { this.statusCode = c; return this },
    json(b) { this.body = b; return this },
  }
}

async function run(reqUser, orderOwnerId) {
  stored = orderOwnerId === null ? null : makeOrder(orderOwnerId)
  const req = { params: { id: 'order1' }, user: reqUser }
  const res = mockRes()
  let err = null
  await getOrderById(req, res, (e) => { err = e })
  return { res, err }
}

// happy path — owner reads their own order
test('owner reading own order -> 200 with the order body', async () => {
  const { res, err } = await run({ _id: 'u1', isAdmin: false }, 'u1')
  assert.equal(err, null)
  assert.equal(res.statusCode, 200)
  assert.equal(res.body._id, 'order1')
  assert.equal(res.body.user._id, 'u1')
})

// TARGET test — intentional behavior change (see fix-1-order-idor.md).
// Pre-fix this pinned the IDOR bug (non-owner got 200 + the order body).
// Post-fix a non-owner, non-admin user is rejected with 403 and no order body.
test('[SEC-001 fixed] non-owner reading another user order -> 403, no body', async () => {
  const { res, err } = await run({ _id: 'u2', isAdmin: false }, 'u1')
  assert.equal(res.statusCode, 403)
  assert.ok(err instanceof Error)
  assert.equal(err.message, 'Not authorized to view this order')
  assert.equal(res.body, undefined) // order (incl. PII) never serialized
})

// non-target — admin is allowed to read any order (stays green after fix)
test('admin reading any order -> 200', async () => {
  const { res, err } = await run({ _id: 'admin', isAdmin: true }, 'u1')
  assert.equal(err, null)
  assert.equal(res.statusCode, 200)
  assert.equal(res.body._id, 'order1')
})

// error path — order not found (stays green after fix)
test('missing order -> 404 and Error("Order not found")', async () => {
  const { res, err } = await run({ _id: 'u1', isAdmin: false }, null)
  assert.equal(res.statusCode, 404)
  assert.ok(err instanceof Error)
  assert.equal(err.message, 'Order not found')
})
