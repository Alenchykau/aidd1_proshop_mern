import express from 'express'
const router = express.Router()
import { getFeatures } from '../controllers/featureController.js'
import { protect, admin } from '../middleware/authMiddleware.js'

router.route('/').get(protect, admin, getFeatures)

export default router
