import path from 'path'
import { promises as fs } from 'fs'

const FILE_PATH = path.resolve(process.cwd(), 'backend', 'features.json')
const TMP_PATH = `${FILE_PATH}.tmp`

let writeQueue = Promise.resolve()

const VALID_STATUS = ['Enabled', 'Testing', 'Disabled']

const todayISO = () => new Date().toISOString().slice(0, 10)

const readFeaturesObject = async () => {
  const raw = await fs.readFile(FILE_PATH, 'utf-8')
  return JSON.parse(raw)
}

export const readFeatures = async () => {
  const obj = await readFeaturesObject()
  return Object.entries(obj).map(([key, value]) => ({ key, ...value }))
}

export const validateEnable = (features, key) => {
  const target = features[key]
  if (!target) return { ok: false, error: 'FEATURE_NOT_FOUND' }
  const deps = target.dependencies || []
  const blocking = deps.filter((d) => !features[d] || features[d].status !== 'Enabled')
  if (blocking.length > 0) {
    return { ok: false, error: 'DEPENDENCY_NOT_ENABLED', blocking }
  }
  return { ok: true }
}

const atomicWrite = async (obj) => {
  await fs.writeFile(TMP_PATH, JSON.stringify(obj, null, 2), 'utf-8')
  await fs.rename(TMP_PATH, FILE_PATH)
}

// Serialize all writes through a single chain so two concurrent admin clicks
// can't interleave a read-modify-write.
export const writeFeature = (key, patch) => {
  const job = writeQueue.then(async () => {
    const obj = await readFeaturesObject()
    const current = obj[key]
    if (!current) {
      const err = new Error('FEATURE_NOT_FOUND')
      err.status = 404
      err.code = 'FEATURE_NOT_FOUND'
      throw err
    }

    const next = { ...current }

    if (patch.status !== undefined) {
      if (!VALID_STATUS.includes(patch.status)) {
        const err = new Error('INVALID_STATUS')
        err.status = 400
        err.code = 'INVALID_STATUS'
        throw err
      }
      if (patch.status === 'Enabled') {
        const check = validateEnable(obj, key)
        if (!check.ok) {
          const err = new Error('DEPENDENCY_NOT_ENABLED')
          err.status = 400
          err.code = 'DEPENDENCY_NOT_ENABLED'
          err.blocking = check.blocking
          throw err
        }
      }
      next.status = patch.status
    }

    if (patch.traffic_percentage !== undefined) {
      const v = patch.traffic_percentage
      if (!Number.isInteger(v) || v < 0 || v > 100) {
        const err = new Error('INVALID_TRAFFIC')
        err.status = 400
        err.code = 'INVALID_TRAFFIC'
        throw err
      }
      const effectiveStatus = next.status
      if (effectiveStatus === 'Disabled' && v > 0) {
        const err = new Error('DISABLED_TRAFFIC_LOCKED')
        err.status = 400
        err.code = 'DISABLED_TRAFFIC_LOCKED'
        throw err
      }
      next.traffic_percentage = v
    }

    next.last_modified = todayISO()
    obj[key] = next
    await atomicWrite(obj)
    return { key, ...next }
  })

  // Keep the chain alive even if a job rejects.
  writeQueue = job.catch(() => undefined)
  return job
}
