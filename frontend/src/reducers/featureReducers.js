import {
  FEATURE_LIST_REQUEST,
  FEATURE_LIST_SUCCESS,
  FEATURE_LIST_FAIL,
  FEATURE_UPDATE_REQUEST,
  FEATURE_UPDATE_SUCCESS,
  FEATURE_UPDATE_FAIL,
} from '../constants/featureConstants'

const initial = {
  loading: false,
  features: [],
  error: null,
  updatingKey: null,
  updateError: null,
}

const replaceByKey = (features, key, next) =>
  features.map((f) => (f.key === key ? next : f))

export const featureListReducer = (state = initial, action) => {
  switch (action.type) {
    case FEATURE_LIST_REQUEST:
      return { ...state, loading: true, features: [], error: null }
    case FEATURE_LIST_SUCCESS:
      return { ...state, loading: false, features: action.payload, error: null }
    case FEATURE_LIST_FAIL:
      return { ...state, loading: false, error: action.payload }

    case FEATURE_UPDATE_REQUEST: {
      const { key, patch } = action.payload
      const optimistic = state.features.map((f) =>
        f.key === key ? { ...f, ...patch } : f
      )
      return { ...state, features: optimistic, updatingKey: key, updateError: null }
    }
    case FEATURE_UPDATE_SUCCESS:
      return {
        ...state,
        features: replaceByKey(state.features, action.payload.key, action.payload),
        updatingKey: null,
        updateError: null,
      }
    case FEATURE_UPDATE_FAIL:
      return {
        ...state,
        features: replaceByKey(state.features, action.payload.key, action.payload.prev),
        updatingKey: null,
        updateError: action.payload.error,
      }

    default:
      return state
  }
}
