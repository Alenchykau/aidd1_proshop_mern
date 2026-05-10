import React from 'react'
import { Alert } from 'react-bootstrap'
import './Message.css'

const Message = ({ variant, children }) => (
  <Alert variant={variant} className='app-message'>{children}</Alert>
)

Message.defaultProps = {
  variant: 'info',
}

export default Message
