import React from 'react'
import './Card.css'

const Card = ({ as: Tag = 'div', clickable = false, className = '', children, ...rest }) => {
  const cls = `ui-card ${clickable ? 'is-clickable' : ''} ${className}`.trim()
  return (
    <Tag className={cls} {...rest}>
      {children}
    </Tag>
  )
}

export default Card
