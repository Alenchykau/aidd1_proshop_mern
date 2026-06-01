// Characterization tests for SEC-008 / PERF-015 — unauthenticated upload route
// with an unanchored file-type regex (Stage 2, finding #2). Written BEFORE the
// fix; they pin the CURRENT behavior of backend/routes/uploadRoutes.js.
//
// Runner: node --test --experimental-test-module-mocks
// No mocking needed: checkFileType is a pure function (exposed via a test seam)
// and the router's middleware wiring is inspected via router.stack.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const mod = await import(
  pathToFileURL(resolve('backend/routes/uploadRoutes.js')).href
)
const router = mod.default
const { checkFileType } = mod

function classify(originalname, mimetype) {
  const out = { err: undefined, accepted: undefined }
  checkFileType({ originalname, mimetype }, (err, accepted) => {
    out.err = err
    out.accepted = accepted
  })
  return out
}

function postRouteHandlerNames() {
  const layer = router.stack.find(
    (l) => l.route && l.route.path === '/' && l.route.methods.post
  )
  assert.ok(layer, 'expected a POST / route on the upload router')
  return layer.route.stack.map((s) => s.handle.name)
}

// happy path — a real jpg is accepted
test('valid jpg (.jpg + image/jpeg) is accepted', () => {
  const r = classify('photo.jpg', 'image/jpeg')
  assert.equal(r.err, null)
  assert.equal(r.accepted, true)
})

// TARGET test (pins the unanchored-regex bug). Pre-fix: ".jpgx" contains the
// substring "jpg", so the unanchored /jpg|jpeg|png/ accepts it. After the fix
// the regex is anchored and this MUST be rejected — see fix-2-upload-auth.md.
test('[PINS SEC-008/PERF-015] unanchored regex currently accepts ".jpgx" (pre-fix)', () => {
  const r = classify('payload.jpgx', 'image/jpeg')
  assert.equal(r.err, null)
  assert.equal(r.accepted, true) // accepted today despite the bogus extension
})

// error / non-target — a non-image is rejected. Stays green after the fix.
test('non-image (.pdf) is rejected with "Images only!"', () => {
  const r = classify('invoice.pdf', 'application/pdf')
  assert.equal(r.err, 'Images only!')
  assert.equal(r.accepted, undefined)
})

// TARGET test (pins the missing authorization). Pre-fix: POST /api/upload has
// exactly two handlers (multer + inline handler) and neither protect nor admin.
// After the fix it MUST be guarded by protect + admin — see fix-2-upload-auth.md.
test('[PINS SEC-008] POST /api/upload currently has NO protect/admin (pre-fix)', () => {
  const names = postRouteHandlerNames()
  assert.equal(names.includes('protect'), false)
  assert.equal(names.includes('admin'), false)
  assert.equal(names.length, 2)
})
