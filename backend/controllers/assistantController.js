import asyncHandler from 'express-async-handler'
import mongoose from 'mongoose'
import ChatLog from '../models/chatLogModel.js'

// @desc    Get recent AI assistant chat logs (router decisions)
// @route   GET /api/assistant/logs
// @access  Private/Admin
const getChatLogs = asyncHandler(async (req, res) => {
  const raw = parseInt(req.query.limit, 10)
  const limit = raw > 0 && raw <= 500 ? raw : 100
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
  if (!req.body.message || typeof req.body.message !== 'string') {
    res.status(400)
    throw new Error('message is required')
  }
  // SECURITY: n8n is a trusted-internal service only. The forwarded JWT lets the
  // agent's scoped tools call back into Express (GET /api/orders/myorders etc.) as
  // this user; n8n must never log or persist it. userId/userName come from req.user
  // (verified JWT), never from the client-supplied body.
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  const r = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
  let data
  try {
    data = await r.json()
  } catch (e) {
    res.status(502)
    throw new Error('Unexpected response from assistant router')
  }
  if (!data || typeof data.reply !== 'string') {
    res.status(502)
    throw new Error('Unexpected response from assistant router')
  }
  res.json({ reply: data.reply })
})

// @desc    DELIBERATELY UNSAFE wide DB access for the DZ2 demo (excessive agency).
//          Принимает collection+filter АРГУМЕНТОМ от LLM — это и есть дыра (LLM06).
//          Включается ТОЛЬКО при ASSISTANT_VULNERABLE_MODE=true; иначе 403.
// @route   POST /api/assistant/raw-query
// @access  Private (НО без скоупа — намеренно небезопасно, за флагом)
const rawQuery = asyncHandler(async (req, res) => {
  if (process.env.ASSISTANT_VULNERABLE_MODE !== 'true') {
    res.status(403)
    throw new Error('Vulnerable mode is disabled')
  }
  const { collection, filter } = req.body
  const docs = await mongoose.connection
    .collection(collection)
    .find(filter || {})
    .toArray()
  res.json(docs)
})

export { getChatLogs, postChat, rawQuery }
