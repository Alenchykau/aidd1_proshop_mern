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

// TARGET test — intentional behavior change (see fix-2-upload-auth.md).
// Pre-fix the unanchored /jpg|jpeg|png/ accepted ".jpgx" (substring match).
// Post-fix the anchored /\.(jpe?g|png)$/i rejects it.
test('[SEC-008/PERF-015 fixed] anchored regex rejects bogus ".jpgx" extension', () => {
  const r = classify('payload.jpgx', 'image/jpeg')
  assert.equal(r.err, 'Images only!')
  assert.equal(r.accepted, undefined)
})

// error / non-target — a non-image is rejected. Stays green after the fix.
test('non-image (.pdf) is rejected with "Images only!"', () => {
  const r = classify('invoice.pdf', 'application/pdf')
  assert.equal(r.err, 'Images only!')
  assert.equal(r.accepted, undefined)
})

// TARGET test — intentional behavior change (see fix-2-upload-auth.md).
// Pre-fix POST /api/upload had 2 handlers (multer + inline) and no auth.
// Post-fix it is guarded by protect + admin first (4 handlers total).
// Note: `protect` is wrapped by express-async-handler, so its handler .name is
// "asyncUtilWrap", not "protect"; `admin` is a plain named function.
test('[SEC-008 fixed] POST /api/upload is guarded by protect + admin', () => {
  const names = postRouteHandlerNames()
  assert.equal(names.length, 4)
  assert.equal(names[0], 'asyncUtilWrap') // protect (asyncHandler-wrapped)
  assert.equal(names[1], 'admin')
})
