import {
  ASSISTANT_CHAT_REQUEST,
  ASSISTANT_CHAT_SUCCESS,
  ASSISTANT_CHAT_FAIL,
  CHATLOG_LIST_REQUEST,
  CHATLOG_LIST_SUCCESS,
  CHATLOG_LIST_FAIL,
} from '../constants/assistantConstants'

export const assistantChatReducer = (state = { reply: null }, action) => {
  switch (action.type) {
    case ASSISTANT_CHAT_REQUEST:
      return { loading: true, reply: null }
    case ASSISTANT_CHAT_SUCCESS:
      return { loading: false, reply: action.payload }
    case ASSISTANT_CHAT_FAIL:
      return { loading: false, error: action.payload }
    default:
      return state
  }
}

export const chatLogListReducer = (state = { logs: [] }, action) => {
  switch (action.type) {
    case CHATLOG_LIST_REQUEST:
      return { ...state, loading: true }
    case CHATLOG_LIST_SUCCESS:
      return { loading: false, logs: action.payload }
    case CHATLOG_LIST_FAIL:
      return { loading: false, error: action.payload, logs: [] }
    default:
      return state
  }
}
