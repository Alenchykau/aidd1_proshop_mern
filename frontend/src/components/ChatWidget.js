import React, { useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Button, Form } from 'react-bootstrap'
import { sendChatMessage } from '../actions/assistantActions'
import './ChatWidget.css'

const ChatWidget = () => {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [messages, setMessages] = useState([])
  const [typing, setTyping] = useState(false)

  const dispatch = useDispatch()
  const { userInfo } = useSelector((state) => state.userLogin)

  if (!userInfo) return null // виджет только для залогиненных

  const send = async (e) => {
    e.preventDefault()
    const msg = text.trim()
    if (!msg) return
    setMessages((m) => [...m, { role: 'user', text: msg }])
    setText('')
    setTyping(true)
    // Thunk читает userInfo.token из getState и POST'ит на /api/assistant/chat.
    // Возвращает текст ответа (или undefined при ошибке сети).
    const reply = await dispatch(sendChatMessage(msg))
    setMessages((m) => [
      ...m,
      { role: 'assistant', text: reply || 'Ошибка сети, попробуйте ещё раз.' },
    ])
    setTyping(false)
  }

  return (
    <>
      {open && (
        <div className='chat-panel'>
          <div className='chat-log'>
            {messages.map((m, i) => (
              <div key={i} className={`chat-msg ${m.role}`}>
                {m.text}
              </div>
            ))}
            {typing && <div className='chat-msg assistant'>печатает…</div>}
          </div>
          <Form className='chat-input' onSubmit={send}>
            <Form.Control
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder='Спросите ассистента…'
            />
            <Button type='submit' variant='primary'>
              ▶
            </Button>
          </Form>
        </div>
      )}
      <Button
        className='chat-fab'
        variant='dark'
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Закрыть чат-ассистента' : 'Открыть чат-ассистента'}
      >
        💬
      </Button>
    </>
  )
}

export default ChatWidget
