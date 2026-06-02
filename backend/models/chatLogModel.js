import mongoose from 'mongoose'

// Коллекция chatlogs. Пишет её РОУТЕР (n8n Mongo-нода); Express только читает (дашборд).
const chatLogSchema = mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userName: { type: String },
    message: { type: String, required: true },
    piiEntities: [{ type: String }],
    route: { type: String, enum: ['local', 'cloud'], required: true },
    reason: { type: String },
    model: { type: String },
    reply: { type: String },
    latencyMs: { type: Number, default: 0 },
    costUsd: { type: Number, default: 0 },
    toolsUsed: [{ type: String }],
    injectionFlag: { type: Boolean, default: false },
  },
  { timestamps: true } // createdAt / updatedAt
)

const ChatLog = mongoose.model('ChatLog', chatLogSchema) // → коллекция "chatlogs"

export default ChatLog
