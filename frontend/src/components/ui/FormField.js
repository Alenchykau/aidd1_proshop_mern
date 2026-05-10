import React from 'react'
import './FormField.css'

const FormField = ({
  id,
  label,
  type = 'text',
  required = false,
  error,
  helperText,
  inputProps = {},
  className = '',
  ...rest
}) => {
  const helperId = helperText ? `${id}-helper` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [helperId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className={`ui-field ${className}`.trim()}>
      {label && (
        <label htmlFor={id} className='ui-field__label'>
          {label}
          {required && <span className='ui-field__required' aria-hidden='true'>*</span>}
        </label>
      )}
      <input
        id={id}
        type={type}
        required={required || undefined}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`ui-field__input ${error ? 'is-invalid' : ''}`.trim()}
        {...inputProps}
        {...rest}
      />
      {helperText && !error && (
        <span id={helperId} className='ui-field__helper'>{helperText}</span>
      )}
      {error && (
        <span id={errorId} role='alert' className='ui-field__error'>{error}</span>
      )}
    </div>
  )
}

export default FormField
