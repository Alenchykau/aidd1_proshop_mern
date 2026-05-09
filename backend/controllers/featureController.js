import path from 'path'
import { promises as fs } from 'fs'
import asyncHandler from 'express-async-handler'

// @desc    Fetch all feature flags
// @route   GET /api/features
// @access  Private/Admin
const getFeatures = asyncHandler(async (req, res) => {
  const filePath = path.resolve(
    process.cwd(),
    'docs',
    'project-data',
    'features.json'
  )
  const raw = await fs.readFile(filePath, 'utf-8')
  const obj = JSON.parse(raw)
  const features = Object.entries(obj).map(([key, value]) => ({
    key,
    ...value,
  }))
  res.json(features)
})

export { getFeatures }
