import { chatLogListReducer } from './assistantReducers'
import {
  CHATLOG_LIST_REQUEST,
  CHATLOG_LIST_SUCCESS,
  CHATLOG_LIST_FAIL,
} from '../constants/assistantConstants'

describe('chatLogListReducer', () => {
  it('returns loading on REQUEST', () => {
    const state = chatLogListReducer({ logs: [] }, { type: CHATLOG_LIST_REQUEST })
    expect(state.loading).toBe(true)
    expect(state.logs).toEqual([])
  })
  it('stores logs on SUCCESS', () => {
    const payload = [{ route: 'local', costUsd: 0 }]
    const state = chatLogListReducer({}, { type: CHATLOG_LIST_SUCCESS, payload })
    expect(state.loading).toBe(false)
    expect(state.logs).toEqual(payload)
  })
  it('stores error on FAIL', () => {
    const state = chatLogListReducer({}, { type: CHATLOG_LIST_FAIL, payload: 'nope' })
    expect(state.error).toBe('nope')
  })
})
