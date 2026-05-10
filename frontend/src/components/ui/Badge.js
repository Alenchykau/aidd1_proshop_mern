import React from 'react'
import './Badge.css'

const Badge = ({ variant = 'default', className = '', children, ...rest }) => {
  const cls = `ui-badge ui-badge--${variant} ${className}`.trim()
  return (
    <span className={cls} {...rest}>
      {children}
    </span>
  )
}

export default Badge
