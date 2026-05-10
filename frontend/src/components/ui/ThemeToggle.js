import React from 'react'
import { FaMoon, FaSun } from 'react-icons/fa'
import { useTheme } from '../../context/ThemeContext'
import './ThemeToggle.css'

const ThemeToggle = () => {
  const { resolvedTheme, toggleTheme } = useTheme()
  const next = resolvedTheme === 'dark' ? 'light' : 'dark'
  const Icon = resolvedTheme === 'dark' ? FaSun : FaMoon

  return (
    <button
      type='button'
      className='theme-toggle'
      aria-label={`Switch to ${next} theme`}
      onClick={toggleTheme}
    >
      <Icon aria-hidden='true' />
    </button>
  )
}

export default ThemeToggle
