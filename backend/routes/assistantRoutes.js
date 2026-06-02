import express from 'express'
const router = express.Router()
import { getChatLogs, postChat } from '../controllers/assistantController.js'
import { protect, admin } from '../middleware/authMiddleware.js'

router.route('/chat').post(protect, postChat)
router.route('/logs').get(protect, admin, getChatLogs)

export default router
