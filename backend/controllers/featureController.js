import asyncHandler from 'express-async-handler'
import { readFeatures, writeFeature } from '../utils/featureFile.js'

// @desc    Fetch all feature flags
// @route   GET /api/feature-flags
// @access  Private/Admin
const getFeatures = asyncHandler(async (req, res) => {
  const features = await readFeatures()
  res.json(features)
})

// @desc    Update a feature flag's status and/or traffic_percentage
// @route   PUT /api/feature-flags/:key
// @access  Private/Admin
const updateFeature = asyncHandler(async (req, res) => {
  const { status, traffic_percentage } = req.body
  const patch = {}
  if (status !== undefined) patch.status = status
  if (traffic_percentage !== undefined) patch.traffic_percentage = traffic_percentage

  try {
    const updated = await writeFeature(req.params.key, patch)
    res.json(updated)
  } catch (err) {
    res.status(err.status || 500)
    if (err.code === 'DEPENDENCY_NOT_ENABLED') {
      throw new Error(
        `Cannot enable: dependency not satisfied (${err.blocking.join(', ')})`
      )
    }
    if (err.code === 'DISABLED_TRAFFIC_LOCKED') {
      throw new Error(
        'Cannot set traffic > 0 while status is Disabled. Set status to Testing first.'
      )
    }
    if (err.code === 'INVALID_STATUS') {
      throw new Error('Status must be one of Enabled, Testing, Disabled.')
    }
    if (err.code === 'INVALID_TRAFFIC') {
      throw new Error('traffic_percentage must be an integer in [0, 100].')
    }
    if (err.code === 'FEATURE_NOT_FOUND') {
      throw new Error(`Feature "${req.params.key}" not found.`)
    }
    throw err
  }
})

export { getFeatures, updateFeature }
