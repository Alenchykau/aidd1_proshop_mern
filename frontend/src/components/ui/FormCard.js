import React from 'react'
import Card from './Card'
import './FormCard.css'

const FormCard = ({ title, width = 'sm', children, className = '', ...rest }) => {
  const widthClass = width === 'md' ? 'ui-form-card--md' : ''
  const cls = `ui-form-card ${widthClass} ${className}`.trim().replace(/\s+/g, ' ')
  return (
    <div className={cls} {...rest}>
      <Card>
        {title && <h1 className='ui-form-card__title'>{title}</h1>}
        {children}
      </Card>
    </div>
  )
}

export default FormCard
