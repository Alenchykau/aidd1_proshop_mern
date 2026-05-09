import React from 'react'
import './EmptyState.css'

const EmptyState = ({ icon, heading, subtitle }) => {
  return (
    <div className='empty'>
      {icon ? <div className='empty-icon'>{icon}</div> : null}
      <h3>{heading}</h3>
      <p>{subtitle}</p>
    </div>
  )
}

export default EmptyState
