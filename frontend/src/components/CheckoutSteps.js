import React from 'react'
import { Link } from 'react-router-dom'
import './CheckoutSteps.css'

const STEPS = [
  { num: 1, label: 'Sign In',     href: '/login' },
  { num: 2, label: 'Shipping',    href: '/shipping' },
  { num: 3, label: 'Payment',     href: '/payment' },
  { num: 4, label: 'Place Order', href: '/placeorder' },
]

const CheckoutSteps = ({ step1, step2, step3, step4 }) => {
  const enabled = [step1, step2, step3, step4]
  const activeIdx = enabled.lastIndexOf(true)

  return (
    <ol className='checkout-steps' aria-label='Checkout progress'>
      {STEPS.map((s, i) => {
        const isCompleted = enabled[i] && i < activeIdx
        const isActive    = i === activeIdx
        const state = isCompleted ? 'is-completed' : isActive ? 'is-active' : 'is-pending'

        const numContent = isCompleted ? '✓' : s.num
        const stepInner = (
          <>
            <span className={`checkout-steps__num ${state}`} aria-hidden='true'>
              {numContent}
            </span>
            <span className={`checkout-steps__label ${state}`}>{s.label}</span>
          </>
        )

        return (
          <React.Fragment key={s.num}>
            <li className='checkout-steps__step'>
              {enabled[i] ? (
                <Link
                  to={s.href}
                  className='checkout-steps__link'
                  aria-current={isActive ? 'step' : undefined}
                >
                  {stepInner}
                </Link>
              ) : (
                <span className='checkout-steps__link is-pending' aria-disabled='true'>
                  {stepInner}
                </span>
              )}
            </li>
            {i < STEPS.length - 1 && (
              <li
                className={`checkout-steps__connector ${enabled[i + 1] ? 'is-completed' : ''}`}
                aria-hidden='true'
              />
            )}
          </React.Fragment>
        )
      })}
    </ol>
  )
}

export default CheckoutSteps
