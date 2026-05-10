import React from 'react'
import { useTheme } from '../../context/ThemeContext'
import './ThemeToggle.css'

const ThemeToggle = () => {
  const { resolvedTheme, toggleTheme } = useTheme()
  const next = resolvedTheme === 'dark' ? 'light' : 'dark'
  const iconClass = resolvedTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon'

  return (
    <button
      type='button'
      className='theme-toggle'
      aria-label={`Switch to ${next} theme`}
      onClick={toggleTheme}
    >
      <i className={iconClass} aria-hidden='true' />
    </button>
  )
}

export default ThemeToggle
