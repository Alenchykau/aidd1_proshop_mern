import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'proshop-theme'

function readStoredTheme() {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'light' || v === 'dark') return v
  } catch (e) {
    /* localStorage blocked */
  }
  return 'system'
}

function readOsTheme() {
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(theme, resolvedTheme) {
  const html = document.documentElement
  if (theme === 'system') {
    html.removeAttribute('data-theme')
  } else {
    html.setAttribute('data-theme', theme)
  }
  html.classList.toggle('dark', resolvedTheme === 'dark')
}

const ThemeContext = createContext({
  theme: 'system',
  resolvedTheme: 'dark',
  setTheme: () => {},
  toggleTheme: () => {},
})

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readStoredTheme)
  const [osTheme, setOsTheme] = useState(readOsTheme)

  const resolvedTheme = theme === 'system' ? osTheme : theme

  // Sync DOM whenever theme or resolvedTheme changes.
  useEffect(() => {
    applyTheme(theme, resolvedTheme)
  }, [theme, resolvedTheme])

  // Subscribe to OS preference only while the user has no explicit choice.
  useEffect(() => {
    if (theme !== 'system') return undefined
    if (typeof window === 'undefined' || !window.matchMedia) return undefined
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e) => setOsTheme(e.matches ? 'dark' : 'light')
    if (mql.addEventListener) mql.addEventListener('change', handler)
    else mql.addListener(handler) // Safari < 14
    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', handler)
      else mql.removeListener(handler)
    }
  }, [theme])

  const setTheme = useCallback((next) => {
    setThemeState(next)
    try {
      if (next === 'system') localStorage.removeItem(STORAGE_KEY)
      else localStorage.setItem(STORAGE_KEY, next)
    } catch (e) {
      /* localStorage blocked → still flip in-memory */
    }
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  }, [resolvedTheme, setTheme])

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme, toggleTheme }),
    [theme, resolvedTheme, setTheme, toggleTheme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext)
}
