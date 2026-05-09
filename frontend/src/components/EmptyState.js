import React from 'react'
import './EmptyState.css'

const EmptyState = ({ icon, heading, subtitle }) => {
  return (
    <div className='empty-state'>
      {icon ? <div className='empty-state-icon'>{icon}</div> : null}
      <h3>{heading}</h3>
      <p>{subtitle}</p>
    </div>
  )
}

export default EmptyState
