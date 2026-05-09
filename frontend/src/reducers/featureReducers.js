import {
  FEATURE_LIST_REQUEST,
  FEATURE_LIST_SUCCESS,
  FEATURE_LIST_FAIL,
  FEATURE_TOGGLE,
  FEATURE_TRAFFIC_UPDATE,
} from '../constants/featureConstants'

const today = () => new Date().toISOString().slice(0, 10)

export const featureListReducer = (state = { features: [] }, action) => {
  switch (action.type) {
    case FEATURE_LIST_REQUEST:
      return { loading: true, features: [] }
    case FEATURE_LIST_SUCCESS:
      return { loading: false, features: action.payload }
    case FEATURE_LIST_FAIL:
      return { loading: false, features: [], error: action.payload }
    case FEATURE_TOGGLE:
      return {
        ...state,
        features: state.features.map((f) =>
          f.key === action.payload.key
            ? {
                ...f,
                status: f.status === 'Disabled' ? 'Enabled' : 'Disabled',
                last_modified: today(),
              }
            : f
        ),
      }
    case FEATURE_TRAFFIC_UPDATE:
      return {
        ...state,
        features: state.features.map((f) =>
          f.key === action.payload.key
            ? {
                ...f,
                traffic_percentage: action.payload.traffic_percentage,
                last_modified: today(),
              }
            : f
        ),
      }
    default:
      return state
  }
}
