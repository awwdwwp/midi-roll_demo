import { useMemo, useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import { GM_INSTRUMENTS } from '../constants/instruments'
import { useEffect } from 'react'

export function InstrumentSelector({
  value = 0,
  onChange,
}) {
  const { theme } = useTheme()

  const currentInstrument =
    GM_INSTRUMENTS.find(i => i.program === value)
    ?? GM_INSTRUMENTS[0]


  const categories = useMemo(
    () => [...new Set(GM_INSTRUMENTS.map(i => i.category))],
    []
  )


  const [category, setCategory] = useState(
    currentInstrument.category
  )

  useEffect(() => {
  setCategory(currentInstrument.category)
}, [value])


  const instrumentsInCategory = useMemo(
    () =>
      GM_INSTRUMENTS.filter(
        i => i.category === category
      ),
    [category]
  )


  function handleCategoryChange(e) {
    const newCategory = e.target.value

    setCategory(newCategory)

    const first =
      GM_INSTRUMENTS.find(
        i => i.category === newCategory
      )

    if (first) {
      onChange(first.program)
    }
  }


  return (
    <div
      style={{
        display: 'flex',
        gap: 4,
        flex: 1,
      }}
    >

      <select
        value={category}
        onChange={handleCategoryChange}
        style={{
          flex: 0.9,
          background: theme.inputBg,
          border: `1px solid ${theme.inputBorder}`,
          color: theme.inputText,
          borderRadius: 6,
          padding: '3px 5px',
          fontSize: 11,
          cursor: 'pointer',
        }}
      >
        {categories.map(c => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>


      <select
        value={value}
        onChange={e =>
          onChange(Number(e.target.value))
        }
        style={{
          flex: 1.4,
          background: theme.inputBg,
          border: `1px solid ${theme.inputBorder}`,
          color: theme.inputText,
          borderRadius: 6,
          padding: '3px 5px',
          fontSize: 11,
          cursor: 'pointer',
        }}
      >
        {instrumentsInCategory.map(i => (
          <option
            key={i.program}
            value={i.program}
          >
            {i.name}
          </option>
        ))}
      </select>

    </div>
  )
}