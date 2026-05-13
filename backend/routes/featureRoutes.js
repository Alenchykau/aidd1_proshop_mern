import express from 'express'
const router = express.Router()
import { getFeatures, updateFeature } from '../controllers/featureController.js'
import { protect, admin } from '../middleware/authMiddleware.js'

router.route('/').get(protect, admin, getFeatures)
router.route('/:key').put(protect, admin, updateFeature)

export default router
