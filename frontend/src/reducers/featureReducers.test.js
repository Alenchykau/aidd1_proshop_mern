import { featureListReducer } from './featureReducers'
import {
  FEATURE_LIST_REQUEST,
  FEATURE_LIST_SUCCESS,
  FEATURE_LIST_FAIL,
  FEATURE_UPDATE_REQUEST,
  FEATURE_UPDATE_SUCCESS,
  FEATURE_UPDATE_FAIL,
} from '../constants/featureConstants'

const sampleFeatures = [
  {
    key: 'search_v2',
    name: 'New Search Algorithm',
    status: 'Testing',
    traffic_percentage: 25,
    last_modified: '2026-05-03',
  },
  {
    key: 'cart_redesign',
    name: 'Redesigned Cart UI',
    status: 'Disabled',
    traffic_percentage: 0,
    last_modified: '2026-04-01',
  },
  {
    key: 'paypal_express_buttons',
    name: 'PayPal Express Checkout Buttons',
    status: 'Enabled',
    traffic_percentage: 100,
    last_modified: '2026-01-08',
  },
]

const initialState = {
  loading: false,
  features: [],
  error: null,
  updatingKey: null,
  updateError: null,
}

describe('featureListReducer', () => {
  it('returns initial state for unknown action', () => {
    const state = featureListReducer(undefined, { type: 'OTHER' })
    expect(state).toEqual(initialState)
  })

  it('handles FEATURE_LIST_REQUEST', () => {
    const state = featureListReducer(undefined, { type: FEATURE_LIST_REQUEST })
    expect(state.loading).toBe(true)
    expect(state.features).toEqual([])
    expect(state.error).toBeNull()
  })

  it('handles FEATURE_LIST_SUCCESS', () => {
    const state = featureListReducer(
      { ...initialState, loading: true },
      { type: FEATURE_LIST_SUCCESS, payload: sampleFeatures }
    )
    expect(state.loading).toBe(false)
    expect(state.features).toEqual(sampleFeatures)
    expect(state.error).toBeNull()
  })

  it('handles FEATURE_LIST_FAIL', () => {
    const state = featureListReducer(
      { ...initialState, loading: true },
      { type: FEATURE_LIST_FAIL, payload: 'boom' }
    )
    expect(state.loading).toBe(false)
    expect(state.error).toBe('boom')
  })

  describe('FEATURE_UPDATE_REQUEST', () => {
    it('optimistically applies status patch and sets updatingKey', () => {
      const state = featureListReducer(
        { ...initialState, features: sampleFeatures },
        {
          type: FEATURE_UPDATE_REQUEST,
          payload: {
            key: 'cart_redesign',
            patch: { status: 'Enabled' },
            prev: sampleFeatures[1],
          },
        }
      )
      const target = state.features.find((f) => f.key === 'cart_redesign')
      expect(target.status).toBe('Enabled')
      expect(state.updatingKey).toBe('cart_redesign')
      expect(state.updateError).toBeNull()
    })

    it('optimistically applies traffic patch', () => {
      const state = featureListReducer(
        { ...initialState, features: sampleFeatures },
        {
          type: FEATURE_UPDATE_REQUEST,
          payload: {
            key: 'search_v2',
            patch: { traffic_percentage: 75 },
            prev: sampleFeatures[0],
          },
        }
      )
      const target = state.features.find((f) => f.key === 'search_v2')
      expect(target.traffic_percentage).toBe(75)
      expect(state.updatingKey).toBe('search_v2')
    })

    it('does not touch other features', () => {
      const state = featureListReducer(
        { ...initialState, features: sampleFeatures },
        {
          type: FEATURE_UPDATE_REQUEST,
          payload: {
            key: 'search_v2',
            patch: { traffic_percentage: 75 },
            prev: sampleFeatures[0],
          },
        }
      )
      const other = state.features.find((f) => f.key === 'cart_redesign')
      expect(other).toEqual(sampleFeatures[1])
    })

    it('clears prior updateError on a new request', () => {
      const state = featureListReducer(
        { ...initialState, features: sampleFeatures, updateError: 'stale' },
        {
          type: FEATURE_UPDATE_REQUEST,
          payload: {
            key: 'search_v2',
            patch: { traffic_percentage: 50 },
            prev: sampleFeatures[0],
          },
        }
      )
      expect(state.updateError).toBeNull()
    })
  })

  describe('FEATURE_UPDATE_SUCCESS', () => {
    it('replaces the feature with the server payload and clears updatingKey', () => {
      const serverResponse = {
        key: 'search_v2',
        name: 'New Search Algorithm',
        status: 'Testing',
        traffic_percentage: 75,
        last_modified: '2026-05-13',
      }
      const state = featureListReducer(
        {
          ...initialState,
          features: sampleFeatures,
          updatingKey: 'search_v2',
        },
        { type: FEATURE_UPDATE_SUCCESS, payload: serverResponse }
      )
      const target = state.features.find((f) => f.key === 'search_v2')
      expect(target).toEqual(serverResponse)
      expect(state.updatingKey).toBeNull()
      expect(state.updateError).toBeNull()
    })
  })

  describe('FEATURE_UPDATE_FAIL', () => {
    it('restores prev state, clears updatingKey, sets updateError', () => {
      const optimisticFeatures = sampleFeatures.map((f) =>
        f.key === 'cart_redesign' ? { ...f, status: 'Enabled' } : f
      )
      const state = featureListReducer(
        {
          ...initialState,
          features: optimisticFeatures,
          updatingKey: 'cart_redesign',
        },
        {
          type: FEATURE_UPDATE_FAIL,
          payload: {
            key: 'cart_redesign',
            prev: sampleFeatures[1],
            error: 'boom',
          },
        }
      )
      const target = state.features.find((f) => f.key === 'cart_redesign')
      expect(target).toEqual(sampleFeatures[1])
      expect(target.status).toBe('Disabled')
      expect(state.updatingKey).toBeNull()
      expect(state.updateError).toBe('boom')
    })
  })
})
