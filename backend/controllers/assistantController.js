import asyncHandler from 'express-async-handler'
import ChatLog from '../models/chatLogModel.js'

// @desc    Get recent AI assistant chat logs (router decisions)
// @route   GET /api/assistant/logs
// @access  Private/Admin
const getChatLogs = asyncHandler(async (req, res) => {
  const limit = Number(req.query.limit) || 100
  const logs = await ChatLog.find({})
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean()
  res.json(logs)
})

export { getChatLogs }
