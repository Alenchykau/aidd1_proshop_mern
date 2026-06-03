// Characterization + happy/edge/error tests for orderController.js
// (M6 Stage 4 — service 2). Covers addOrderItems, updateOrderToPaid,
// updateOrderToDelivered, getMyOrders, getOrders. getOrderById is already
// pinned by homework/M6/stage2-fix-top3/tests/fix-1-order-idor.test.mjs.
//
// Runner (from repo root):
//   node --test --experimental-test-module-mocks "backend/__tests__/orderController.test.mjs"
//
// The Mongoose Order model is mock.module'd by absolute file URL so the
// controller's `import Order from '../models/orderModel.js'` resolves to the
// mock — no live MongoDB required. Module-mock + dynamic import must happen
// BEFORE we pull the controller in.

import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const orderModelUrl = pathToFileURL(resolve('backend/models/orderModel.js')).href

// Mutable boxes the per-test fixtures swap in. We keep them at module scope
// so the mock can read the latest value on every call.
let findByIdResult = null          // what Order.findById(id) returns (mutated)
let lastConstructorArgs = null     // captured args passed to `new Order(...)`
let lastSavedDoc = null            // the doc returned by .save() in addOrderItems
let findFilter = null              // captured filter for Order.find(...)
let findPopulateArgs = null        // captured args for .populate(...)
let findResult = []                // what Order.find(...) (and its .populate) resolves to

// Build the mocked default export. `Order` must be callable with `new`
// (addOrderItems does `new Order({...}).save()`), expose `findById` and
// `find` as static methods, and let us capture every interaction.
function OrderMock(doc) {
  lastConstructorArgs = doc
  Object.assign(this, doc)
  this.save = async function save() {
    // Echo the doc back with a stamped _id, like Mongoose does. The handler
    // forwards the result straight into res.json(), so the test asserts on
    // exactly this shape.
    lastSavedDoc = { _id: 'order_generated_1', ...this }
    delete lastSavedDoc.save
    return lastSavedDoc
  }
}

OrderMock.findById = async (_id) => findByIdResult
OrderMock.find = (filter) => {
  findFilter = filter
  return {
    // getMyOrders awaits Order.find(...) directly — the thenable below makes
    // `await Order.find({...})` resolve to findResult without going through
    // .populate(). getOrders chains .populate() so we also expose that.
    then(resolve, reject) {
      try { resolve(findResult) } catch (e) { reject(e) }
    },
    populate(...args) {
      findPopulateArgs = args
      return Promise.resolve(findResult)
    },
  }
}

mock.module(orderModelUrl, { defaultExport: OrderMock })

const {
  addOrderItems,
  updateOrderToPaid,
  updateOrderToDelivered,
  getMyOrders,
  getOrders,
} = await import(
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

function resetCaptures() {
  findByIdResult = null
  lastConstructorArgs = null
  lastSavedDoc = null
  findFilter = null
  findPopulateArgs = null
  findResult = []
}

// ---------- realistic fixtures ----------

const OWNER_ID = '64f1a2b3c4d5e6f701020304'
const STRANGER_ID = '64f1a2b3c4d5e6f7aabbccdd'
const ORDER_ID = '650a1b2c3d4e5f6071829304'

const validShipping = {
  address: '742 Evergreen Terrace',
  city: 'Springfield',
  postalCode: '49007',
  country: 'United States',
}

const validOrderItems = [
  {
    name: 'Airpods Wireless Bluetooth Headphones',
    qty: 2,
    image: '/images/airpods.jpg',
    price: 89.99,
    product: '650a1b2c3d4e5f6071829aaa',
  },
  {
    name: 'iPhone 13 Pro 256GB Memory',
    qty: 1,
    image: '/images/phone.jpg',
    price: 599.99,
    product: '650a1b2c3d4e5f6071829bbb',
  },
]

// =============================================================
//                       addOrderItems
// =============================================================

test('addOrderItems: valid cart -> 201 with persisted order body', async () => {
  resetCaptures()
  const req = {
    user: { _id: OWNER_ID },
    body: {
      orderItems: validOrderItems,
      shippingAddress: validShipping,
      paymentMethod: 'PayPal',
      itemsPrice: 779.97,
      taxPrice: 117.00,
      shippingPrice: 0,
      totalPrice: 896.97,
    },
  }
  const res = mockRes()
  let err = null
  await addOrderItems(req, res, (e) => { err = e })

  assert.equal(err, null)
  assert.equal(res.statusCode, 201)
  // controller hands the Mongoose doc to res.json — verify VALUES, not aliveness
  assert.equal(res.body._id, 'order_generated_1')
  assert.equal(res.body.user, OWNER_ID)
  assert.equal(res.body.paymentMethod, 'PayPal')
  assert.equal(res.body.totalPrice, 896.97)
  assert.equal(res.body.orderItems.length, 2)
  assert.equal(res.body.orderItems[0].product, '650a1b2c3d4e5f6071829aaa')
  // and the constructor got the same payload (no silent drops)
  assert.equal(lastConstructorArgs.user, OWNER_ID)
  assert.deepEqual(lastConstructorArgs.shippingAddress, validShipping)
})

test('addOrderItems: orderItems:[] -> 400 "No order items", no save', async () => {
  resetCaptures()
  const req = {
    user: { _id: OWNER_ID },
    body: {
      orderItems: [],
      shippingAddress: validShipping,
      paymentMethod: 'PayPal',
      itemsPrice: 0, taxPrice: 0, shippingPrice: 0, totalPrice: 0,
    },
  }
  const res = mockRes()
  let err = null
  await addOrderItems(req, res, (e) => { err = e })

  assert.equal(res.statusCode, 400)
  assert.ok(err instanceof Error)
  assert.equal(err.message, 'No order items')
  assert.equal(lastSavedDoc, null)        // no order persisted
  assert.equal(lastConstructorArgs, null) // and no constructor invocation
})

test('addOrderItems: client-supplied totalPrice 0.01 is persisted verbatim', async () => {
  // pins current behavior (FINDINGS#2 — price tampering) — not yet fixed.
  // When server-side price recomputation lands, this test should flip to
  // expect a recomputed totalPrice (>= sum of qty*price).
  resetCaptures()
  const req = {
    user: { _id: OWNER_ID },
    body: {
      orderItems: validOrderItems,
      shippingAddress: validShipping,
      paymentMethod: 'PayPal',
      itemsPrice: 0.01,
      taxPrice: 0,
      shippingPrice: 0,
      totalPrice: 0.01,
    },
  }
  const res = mockRes()
  let err = null
  await addOrderItems(req, res, (e) => { err = e })

  assert.equal(err, null)
  assert.equal(res.statusCode, 201)
  assert.equal(res.body.totalPrice, 0.01)
  assert.equal(res.body.itemsPrice, 0.01)
  assert.equal(lastConstructorArgs.totalPrice, 0.01)
})

test('addOrderItems: orderItems:undefined slips past guard and reaches save()', async () => {
  // pins current behavior (FINDINGS#4) — not yet fixed.
  // The guard `if (orderItems && orderItems.length === 0)` is falsy for
  // undefined, so the else-branch runs and `new Order({orderItems: undefined})`
  // gets saved. After the fix this should become 400 "No order items" with
  // no constructor call.
  resetCaptures()
  const req = {
    user: { _id: OWNER_ID },
    body: {
      shippingAddress: validShipping,
      paymentMethod: 'PayPal',
      itemsPrice: 0, taxPrice: 0, shippingPrice: 0, totalPrice: 0,
    },
  }
  const res = mockRes()
  let err = null
  await addOrderItems(req, res, (e) => { err = e })

  assert.equal(err, null)
  assert.equal(res.statusCode, 201)
  assert.equal(lastConstructorArgs.orderItems, undefined)
  assert.equal(res.body._id, 'order_generated_1')
})

// =============================================================
//                     updateOrderToPaid
// =============================================================

function makeStoredOrder(ownerId, overrides = {}) {
  const order = {
    _id: ORDER_ID,
    user: ownerId,
    isPaid: false,
    paidAt: undefined,
    paymentResult: undefined,
    totalPrice: 896.97,
    ...overrides,
  }
  order.save = async function save() {
    // Echo ALL current fields (incl. mutations like isDelivered/deliveredAt),
    // mirroring how Mongoose returns the saved doc. A hand-picked field list
    // silently dropped isDelivered and broke the deliver handler's response.
    const snap = { ...this }
    delete snap.save
    return snap
  }
  return order
}

const validPayer = {
  email_address: 'buyer@example.com',
  payer_id: 'PAYERID12345',
}

test('updateOrderToPaid: owner + valid PayPal body -> 200 with isPaid=true', async () => {
  resetCaptures()
  findByIdResult = makeStoredOrder(OWNER_ID)
  const req = {
    user: { _id: OWNER_ID, isAdmin: false },
    params: { id: ORDER_ID },
    body: {
      id: 'PAYID-MOCK-9X8Y7Z',
      status: 'COMPLETED',
      update_time: '2026-06-01T12:34:56Z',
      payer: validPayer,
    },
  }
  const res = mockRes()
  let err = null
  await updateOrderToPaid(req, res, (e) => { err = e })

  assert.equal(err, null)
  assert.equal(res.statusCode, 200)
  assert.equal(res.body.isPaid, true)
  assert.equal(typeof res.body.paidAt, 'number') // Date.now() -> ms epoch
  assert.equal(res.body.paymentResult.id, 'PAYID-MOCK-9X8Y7Z')
  assert.equal(res.body.paymentResult.status, 'COMPLETED')
  assert.equal(res.body.paymentResult.email_address, 'buyer@example.com')
})

test('updateOrderToPaid: stranger marks another user order paid -> 200 (no ownership check)', async () => {
  // pins current behavior (SEC-002) — not yet fixed.
  // Any logged-in user can mark any order paid because the handler doesn't
  // compare order.user to req.user._id. After the fix this should become 403.
  resetCaptures()
  findByIdResult = makeStoredOrder(OWNER_ID)
  const req = {
    user: { _id: STRANGER_ID, isAdmin: false },
    params: { id: ORDER_ID },
    body: {
      id: 'PAYID-ATTACKER',
      status: 'COMPLETED',
      update_time: '2026-06-01T12:34:56Z',
      payer: { email_address: 'attacker@evil.test' },
    },
  }
  const res = mockRes()
  let err = null
  await updateOrderToPaid(req, res, (e) => { err = e })

  assert.equal(err, null)
  assert.equal(res.statusCode, 200)
  assert.equal(res.body.isPaid, true)
  assert.equal(res.body.paymentResult.email_address, 'attacker@evil.test')
})

test('updateOrderToPaid: missing order -> 404 "Order not found"', async () => {
  resetCaptures()
  findByIdResult = null
  const req = {
    user: { _id: OWNER_ID, isAdmin: false },
    params: { id: 'nonexistent' },
    body: {
      id: 'PAYID', status: 'COMPLETED', update_time: 'now',
      payer: validPayer,
    },
  }
  const res = mockRes()
  let err = null
  await updateOrderToPaid(req, res, (e) => { err = e })

  assert.equal(res.statusCode, 404)
  assert.ok(err instanceof Error)
  assert.equal(err.message, 'Order not found')
  assert.equal(res.body, undefined)
})

test('updateOrderToPaid: body without `payer` -> handler throws (current 500 behavior)', async () => {
  // pins current behavior (FINDINGS / spec edge case #4) — not yet fixed.
  // `req.body.payer.email_address` throws TypeError when payer is undefined,
  // which express-async-handler forwards to next(err) -> errorHandler -> 500.
  // After the fix this should become a 400 with a validation message and
  // the order should NOT be saved.
  resetCaptures()
  findByIdResult = makeStoredOrder(OWNER_ID)
  const req = {
    user: { _id: OWNER_ID, isAdmin: false },
    params: { id: ORDER_ID },
    body: {
      id: 'PAYID', status: 'COMPLETED', update_time: '2026-06-01T00:00:00Z',
      // payer intentionally missing
    },
  }
  const res = mockRes()
  let err = null
  await updateOrderToPaid(req, res, (e) => { err = e })

  assert.ok(err instanceof TypeError, 'expected TypeError to bubble to next()')
  assert.match(err.message, /email_address/)
  // res.json never reached
  assert.equal(res.body, undefined)
})

// =============================================================
//                   updateOrderToDelivered
// =============================================================

test('updateOrderToDelivered: order found -> 200 with isDelivered=true and deliveredAt set', async () => {
  resetCaptures()
  findByIdResult = makeStoredOrder(OWNER_ID, { isPaid: true, paidAt: Date.now() })
  const req = {
    user: { _id: 'admin1', isAdmin: true },
    params: { id: ORDER_ID },
    body: {},
  }
  const res = mockRes()
  let err = null
  await updateOrderToDelivered(req, res, (e) => { err = e })

  assert.equal(err, null)
  assert.equal(res.statusCode, 200)
  assert.equal(res.body.isDelivered, true)
  assert.equal(typeof res.body.deliveredAt, 'number')
  assert.ok(res.body.deliveredAt > 0)
})

test('updateOrderToDelivered: missing order -> 404 "Order not found"', async () => {
  resetCaptures()
  findByIdResult = null
  const req = {
    user: { _id: 'admin1', isAdmin: true },
    params: { id: 'nonexistent' },
    body: {},
  }
  const res = mockRes()
  let err = null
  await updateOrderToDelivered(req, res, (e) => { err = e })

  assert.equal(res.statusCode, 404)
  assert.ok(err instanceof Error)
  assert.equal(err.message, 'Order not found')
  assert.equal(res.body, undefined)
})

// =============================================================
//                        getMyOrders
// =============================================================

test('getMyOrders: filters Order.find by req.user._id and returns the rows', async () => {
  resetCaptures()
  const myOrders = [
    { _id: 'o1', user: OWNER_ID, totalPrice: 49.99, isPaid: true },
    { _id: 'o2', user: OWNER_ID, totalPrice: 129.50, isPaid: false },
  ]
  findResult = myOrders
  const req = { user: { _id: OWNER_ID } }
  const res = mockRes()
  let err = null
  await getMyOrders(req, res, (e) => { err = e })

  assert.equal(err, null)
  // CRITICAL: the filter must scope by user — otherwise it's an IDOR.
  assert.deepEqual(findFilter, { user: OWNER_ID })
  assert.equal(res.statusCode, 200)
  assert.equal(res.body.length, 2)
  assert.equal(res.body[0]._id, 'o1')
  assert.equal(res.body[1].totalPrice, 129.50)
})

test('getMyOrders: empty result set -> 200 with []', async () => {
  resetCaptures()
  findResult = []
  const req = { user: { _id: STRANGER_ID } }
  const res = mockRes()
  let err = null
  await getMyOrders(req, res, (e) => { err = e })

  assert.equal(err, null)
  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.body, [])
  assert.deepEqual(findFilter, { user: STRANGER_ID })
})

// =============================================================
//                          getOrders
// =============================================================

test('getOrders: returns all orders with user populated (id, name)', async () => {
  resetCaptures()
  findResult = [
    { _id: 'o1', user: { _id: OWNER_ID, name: 'Alice Buyer' }, totalPrice: 49.99 },
    { _id: 'o2', user: { _id: STRANGER_ID, name: 'Bob Buyer' }, totalPrice: 129.50 },
  ]
  const req = { user: { _id: 'admin1', isAdmin: true }, query: {} }
  const res = mockRes()
  let err = null
  await getOrders(req, res, (e) => { err = e })

  assert.equal(err, null)
  assert.equal(res.statusCode, 200)
  assert.deepEqual(findFilter, {}) // unfiltered
  assert.deepEqual(findPopulateArgs, ['user', 'id name'])
  assert.equal(res.body.length, 2)
  assert.equal(res.body[0].user.name, 'Alice Buyer')
  assert.equal(res.body[1].user._id, STRANGER_ID)
})

test('getOrders: ignores pagination params (pins PERF-002 — unbounded scan)', async () => {
  // pins current behavior (PERF-002) — not yet fixed.
  // The handler does not honor pageNumber/pageSize from the query; it always
  // returns the full collection. After the fix this should switch to
  // paginated find(...).limit().skip() and a {page, pages, orders} body.
  resetCaptures()
  // simulate a "huge" page request — the controller should still emit all rows
  findResult = Array.from({ length: 1234 }, (_, i) => ({
    _id: `o${i}`,
    user: { _id: OWNER_ID, name: 'Alice Buyer' },
    totalPrice: 10 + i,
  }))
  const req = {
    user: { _id: 'admin1', isAdmin: true },
    query: { pageNumber: '5', pageSize: '10' },
  }
  const res = mockRes()
  let err = null
  await getOrders(req, res, (e) => { err = e })

  assert.equal(err, null)
  assert.equal(res.statusCode, 200)
  // unbounded: every row returned, no envelope, no slicing
  assert.equal(Array.isArray(res.body), true)
  assert.equal(res.body.length, 1234)
  assert.equal(res.body.page, undefined)
  assert.equal(res.body.pages, undefined)
})
