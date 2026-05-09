import axios from 'axios'
import {
  FEATURE_LIST_REQUEST,
  FEATURE_LIST_SUCCESS,
  FEATURE_LIST_FAIL,
  FEATURE_TOGGLE,
  FEATURE_TRAFFIC_UPDATE,
} from '../constants/featureConstants'

export const listFeatures = () => async (dispatch, getState) => {
  try {
    dispatch({ type: FEATURE_LIST_REQUEST })

    const {
      userLogin: { userInfo },
    } = getState()

    const config = {
      headers: {
        Authorization: `Bearer ${userInfo.token}`,
      },
    }

    const { data } = await axios.get('/api/features', config)

    dispatch({ type: FEATURE_LIST_SUCCESS, payload: data })
  } catch (error) {
    dispatch({
      type: FEATURE_LIST_FAIL,
      payload:
        error.response && error.response.data.message
          ? error.response.data.message
          : error.message,
    })
  }
}

export const toggleFeature = (key) => ({
  type: FEATURE_TOGGLE,
  payload: { key },
})

export const updateFeatureTraffic = (key, traffic_percentage) => ({
  type: FEATURE_TRAFFIC_UPDATE,
  payload: { key, traffic_percentage },
})
