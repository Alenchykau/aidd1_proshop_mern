import axios from 'axios'
import {
  FEATURE_LIST_REQUEST,
  FEATURE_LIST_SUCCESS,
  FEATURE_LIST_FAIL,
  FEATURE_UPDATE_REQUEST,
  FEATURE_UPDATE_SUCCESS,
  FEATURE_UPDATE_FAIL,
} from '../constants/featureConstants'

export const listFeatures = () => async (dispatch, getState) => {
  try {
    dispatch({ type: FEATURE_LIST_REQUEST })
    const {
      userLogin: { userInfo },
    } = getState()
    const config = { headers: { Authorization: `Bearer ${userInfo.token}` } }
    const { data } = await axios.get('/api/feature-flags', config)
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

export const updateFeature = (key, patch) => async (dispatch, getState) => {
  const {
    featureList: { features },
    userLogin: { userInfo },
  } = getState()

  const prev = (features || []).find((f) => f.key === key)
  if (!prev) return

  dispatch({ type: FEATURE_UPDATE_REQUEST, payload: { key, patch, prev } })

  try {
    const config = {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userInfo.token}`,
      },
    }
    const { data } = await axios.put(`/api/feature-flags/${key}`, patch, config)
    dispatch({ type: FEATURE_UPDATE_SUCCESS, payload: data })
  } catch (error) {
    dispatch({
      type: FEATURE_UPDATE_FAIL,
      payload: {
        key,
        prev,
        error:
          error.response && error.response.data.message
            ? error.response.data.message
            : error.message,
      },
    })
  }
}
