import { featureListReducer } from './featureReducers'
import {
  FEATURE_LIST_REQUEST,
  FEATURE_LIST_SUCCESS,
  FEATURE_LIST_FAIL,
  FEATURE_TOGGLE,
  FEATURE_TRAFFIC_UPDATE,
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

describe('featureListReducer', () => {
  it('returns initial state for unknown action', () => {
    const state = featureListReducer(undefined, { type: 'OTHER' })
    expect(state).toEqual({ features: [] })
  })

  it('handles FEATURE_LIST_REQUEST', () => {
    const state = featureListReducer(undefined, { type: FEATURE_LIST_REQUEST })
    expect(state).toEqual({ loading: true, features: [] })
  })

  it('handles FEATURE_LIST_SUCCESS', () => {
    const state = featureListReducer(
      { loading: true, features: [] },
      { type: FEATURE_LIST_SUCCESS, payload: sampleFeatures }
    )
    expect(state).toEqual({ loading: false, features: sampleFeatures })
  })

  it('handles FEATURE_LIST_FAIL', () => {
    const state = featureListReducer(
      { loading: true, features: [] },
      { type: FEATURE_LIST_FAIL, payload: 'boom' }
    )
    expect(state).toEqual({ loading: false, features: [], error: 'boom' })
  })

  describe('FEATURE_TOGGLE', () => {
    const today = new Date().toISOString().slice(0, 10)

    it('flips Disabled to Enabled', () => {
      const state = featureListReducer(
        { loading: false, features: sampleFeatures },
        { type: FEATURE_TOGGLE, payload: { key: 'cart_redesign' } }
      )
      const target = state.features.find((f) => f.key === 'cart_redesign')
      expect(target.status).toBe('Enabled')
      expect(target.last_modified).toBe(today)
    })

    it('flips Enabled to Disabled', () => {
      const state = featureListReducer(
        { loading: false, features: sampleFeatures },
        { type: FEATURE_TOGGLE, payload: { key: 'paypal_express_buttons' } }
      )
      const target = state.features.find(
        (f) => f.key === 'paypal_express_buttons'
      )
      expect(target.status).toBe('Disabled')
      expect(target.last_modified).toBe(today)
    })

    it('flips Testing to Disabled', () => {
      const state = featureListReducer(
        { loading: false, features: sampleFeatures },
        { type: FEATURE_TOGGLE, payload: { key: 'search_v2' } }
      )
      const target = state.features.find((f) => f.key === 'search_v2')
      expect(target.status).toBe('Disabled')
      expect(target.last_modified).toBe(today)
    })

    it('does not touch other features', () => {
      const state = featureListReducer(
        { loading: false, features: sampleFeatures },
        { type: FEATURE_TOGGLE, payload: { key: 'search_v2' } }
      )
      const other = state.features.find((f) => f.key === 'cart_redesign')
      expect(other).toEqual(sampleFeatures[1])
    })
  })

  describe('FEATURE_TRAFFIC_UPDATE', () => {
    const today = new Date().toISOString().slice(0, 10)

    it('updates traffic_percentage and last_modified for the targeted feature', () => {
      const state = featureListReducer(
        { loading: false, features: sampleFeatures },
        {
          type: FEATURE_TRAFFIC_UPDATE,
          payload: { key: 'search_v2', traffic_percentage: 75 },
        }
      )
      const target = state.features.find((f) => f.key === 'search_v2')
      expect(target.traffic_percentage).toBe(75)
      expect(target.last_modified).toBe(today)
    })

    it('does not touch other features', () => {
      const state = featureListReducer(
        { loading: false, features: sampleFeatures },
        {
          type: FEATURE_TRAFFIC_UPDATE,
          payload: { key: 'search_v2', traffic_percentage: 75 },
        }
      )
      const other = state.features.find((f) => f.key === 'cart_redesign')
      expect(other).toEqual(sampleFeatures[1])
    })
  })
})
