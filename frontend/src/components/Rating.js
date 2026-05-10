import React from 'react'
import './Rating.css'

const Rating = ({ value, text }) => {
  const star = (threshold) => {
    if (value >= threshold) return 'fas fa-star'
    if (value >= threshold - 0.5) return 'fas fa-star-half-alt'
    return 'far fa-star'
  }

  return (
    <div className='rating'>
      {[1, 2, 3, 4, 5].map((threshold) => (
        <span key={threshold}>
          <i className={star(threshold)} aria-hidden='true' />
        </span>
      ))}
      {text && <span className='rating__text'>{text}</span>}
    </div>
  )
}

export default Rating
