import React from 'react'
import Card from './Card'
import './FormCard.css'

const FormCard = ({ title, children, className = '', ...rest }) => {
  return (
    <div className={`ui-form-card ${className}`.trim()} {...rest}>
      <Card>
        {title && <h1 className='ui-form-card__title'>{title}</h1>}
        {children}
      </Card>
    </div>
  )
}

export default FormCard
