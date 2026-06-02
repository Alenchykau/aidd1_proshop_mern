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

// @desc    Proxy a chat message to the n8n privacy router
// @route   POST /api/assistant/chat
// @access  Private
const postChat = asyncHandler(async (req, res) => {
  const webhook = process.env.N8N_ASSISTANT_WEBHOOK_URL
  if (!webhook) {
    res.status(500)
    throw new Error('N8N_ASSISTANT_WEBHOOK_URL is not configured')
  }
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  const r = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // userId/userName — ДОВЕРЕННЫЕ из req.user (не из тела браузера).
    // token прокидываем, чтобы scoped-тулы агента били в Express с этим JWT.
    body: JSON.stringify({
      message: req.body.message,
      userId: String(req.user._id),
      userName: req.user.name,
      token,
    }),
  })
  if (!r.ok) {
    res.status(502)
    throw new Error('Assistant router is unavailable')
  }
  const data = await r.json()
  res.json({ reply: data.reply })
})

export { getChatLogs, postChat }
