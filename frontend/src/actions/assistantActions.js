import axios from 'axios'
import {
  ASSISTANT_CHAT_REQUEST,
  ASSISTANT_CHAT_SUCCESS,
  ASSISTANT_CHAT_FAIL,
  CHATLOG_LIST_REQUEST,
  CHATLOG_LIST_SUCCESS,
  CHATLOG_LIST_FAIL,
} from '../constants/assistantConstants'

export const sendChatMessage = (message) => async (dispatch, getState) => {
  try {
    dispatch({ type: ASSISTANT_CHAT_REQUEST })
    const {
      userLogin: { userInfo },
    } = getState()
    const config = { headers: { Authorization: `Bearer ${userInfo.token}` } }
    const { data } = await axios.post('/api/assistant/chat', { message }, config)
    dispatch({ type: ASSISTANT_CHAT_SUCCESS, payload: data.reply })
    return data.reply
  } catch (error) {
    dispatch({
      type: ASSISTANT_CHAT_FAIL,
      payload:
        error.response && error.response.data.message
          ? error.response.data.message
          : error.message,
    })
  }
}

export const listChatLogs = () => async (dispatch, getState) => {
  try {
    dispatch({ type: CHATLOG_LIST_REQUEST })
    const {
      userLogin: { userInfo },
    } = getState()
    const config = { headers: { Authorization: `Bearer ${userInfo.token}` } }
    const { data } = await axios.get('/api/assistant/logs', config)
    dispatch({ type: CHATLOG_LIST_SUCCESS, payload: data })
  } catch (error) {
    dispatch({
      type: CHATLOG_LIST_FAIL,
      payload:
        error.response && error.response.data.message
          ? error.response.data.message
          : error.message,
    })
  }
}
