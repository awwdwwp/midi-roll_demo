import { createContext, useContext, useState } from 'react'
import { THEMES } from '../constants'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [themeKey, setThemeKey] = useState(
    () => localStorage.getItem('midi-roll-theme') || 'default'
  )
  const theme = THEMES[themeKey] || THEMES.default
  const setTheme = (key) => {
    setThemeKey(key)
    localStorage.setItem('midi-roll-theme', key)
  }
  return (
    <ThemeContext.Provider value={{ theme, themeKey, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)