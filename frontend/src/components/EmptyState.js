import React from 'react'
import './EmptyState.css'

const EmptyState = ({ icon, heading, subtitle, cta }) => {
  return (
    <div className='empty-state'>
      {icon ? <div className='empty-state-icon'>{icon}</div> : null}
      <h3>{heading}</h3>
      {subtitle ? <p>{subtitle}</p> : null}
      {cta ? <div className='empty-state-cta'>{cta}</div> : null}
    </div>
  )
}

export default EmptyState
