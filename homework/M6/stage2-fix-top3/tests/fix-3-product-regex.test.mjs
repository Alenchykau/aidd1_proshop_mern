// Characterization tests for SEC-004 / PERF-001 — user-controlled $regex in
// getProducts (Stage 2, finding #3). Written BEFORE the fix; they pin the
// CURRENT behavior of backend/controllers/productController.js:getProducts.
//
// Runner: node --test --experimental-test-module-mocks
// The Product model is mock.module'd to capture the exact filter object the
// controller hands to Mongoose (countDocuments / find) — no live MongoDB.

import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const productModelUrl = pathToFileURL(resolve('backend/models/productModel.js')).href

let capturedFind = null
let capturedCount = null

mock.module(productModelUrl, {
  defaultExport: {
    countDocuments: async (f) => { capturedCount = f; return 25 },
    find: (f) => {
      capturedFind = f
      return { limit() { return { skip: async () => [] } } }
    },
  },
})

const { getProducts } = await import(
  pathToFileURL(resolve('backend/controllers/productController.js')).href
)

function mockRes() {
  return { body: undefined, status() { return this }, json(b) { this.body = b; return this } }
}

async function run(query) {
  capturedFind = null
  capturedCount = null
  const req = { query }
  const res = mockRes()
  await getProducts(req, res, (e) => { throw e })
  return { res }
}

// happy / non-target — empty keyword yields an empty filter + pagination math.
// Stays green after the fix.
test('no keyword -> empty filter {} and pagination (page 1, pages=ceil(25/10)=3)', async () => {
  const { res } = await run({})
  assert.deepEqual(capturedFind, {})
  assert.deepEqual(capturedCount, {})
  assert.equal(res.body.page, 1)
  assert.equal(res.body.pages, 3)
  assert.deepEqual(res.body.products, [])
})

// non-target — a plain word stays a case-insensitive name regex. Escaping a
// word with no metacharacters leaves it unchanged, so this stays green.
test('plain keyword "phone" -> case-insensitive $regex on name', async () => {
  await run({ keyword: 'phone' })
  assert.equal(capturedFind.name.$regex, 'phone')
  assert.equal(capturedFind.name.$options, 'i')
})

// TARGET test (pins the injection bug). Pre-fix: regex metacharacters reach
// Mongo verbatim. After the fix they must be escaped — see fix-3-product-regex.md.
test('[PINS SEC-004] regex metacharacters passed RAW into $regex (pre-fix)', async () => {
  await run({ keyword: '.*' })
  assert.equal(capturedFind.name.$regex, '.*') // unescaped today -> matches everything
})

// TARGET test (pins the missing length cap / ReDoS surface). Pre-fix: the full
// 200-char keyword reaches Mongo. After the fix it must be capped at 64.
test('[PINS PERF-001] long keyword passed UNCAPPED into $regex (pre-fix)', async () => {
  const long = 'a'.repeat(200)
  await run({ keyword: long })
  assert.equal(capturedFind.name.$regex.length, 200)
})

// non-target — pagination parses pageNumber. Stays green after the fix.
test('pageNumber=2 -> page 2 echoed in body', async () => {
  const { res } = await run({ pageNumber: '2' })
  assert.equal(res.body.page, 2)
})
