import path from 'path'
import express from 'express'
import multer from 'multer'
import { protect, admin } from '../middleware/authMiddleware.js'
const router = express.Router()

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, 'uploads/')
  },
  filename(req, file, cb) {
    cb(
      null,
      `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`
    )
  },
})

function checkFileType(file, cb) {
  // Anchored so a bogus extension/mimetype (e.g. ".jpgx", "image/png-evil")
  // can no longer slip through the old unanchored /jpg|jpeg|png/ substring test.
  const extOk = /\.(jpe?g|png)$/i.test(path.extname(file.originalname))
  const mimeOk = /^image\/(jpe?g|png)$/i.test(file.mimetype)

  if (extOk && mimeOk) {
    return cb(null, true)
  } else {
    cb('Images only!')
  }
}

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: function (req, file, cb) {
    checkFileType(file, cb)
  },
})

router.post('/', protect, admin, upload.single('image'), (req, res) => {
  res.send(`/${req.file.path}`)
})

// Exposed for characterization tests (test seam — no behavior change).
export { checkFileType }
export default router
