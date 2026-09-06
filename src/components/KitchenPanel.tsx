import { useMemo, useRef, useState } from 'react'
import { resolve, splitEntry, suggest, type Suggestion } from '../lib/normalize'
import { DIET_LABELS } from '../lib/diet'
import { nameOf } from '../lib/db'
import type { Preferences } from '../lib/types'

export interface KitchenItem {
  id: string
  label: string
  kind: 'ingredient' | 'equipment' | 'unknown'
}

const QUICK_ADD = [
  'eggs',
  'onion',
  'tomato',
  'oats',
  'chicken_breast',
  'paneer',
  'yogurt',
  'rice',
  'air_fryer',
  'blender',
  'pressure_cooker',
  'oven',
]

interface Props {
  items: KitchenItem[]
  onAdd: (items: KitchenItem[]) => void
  onRemove: (id: string) => void
  onClear: () => void
  includeStaples: boolean
  setIncludeStaples: (v: boolean) => void
  prefs: Preferences
  setPrefs: (p: Preferences) => void
}

export function KitchenPanel({
  items,
  onAdd,
  onRemove,
  onClear,
  includeStaples,
  setIncludeStaples,
  prefs,
  setPrefs,
}: Props) {
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const have = useMemo(() => new Set(items.map((i) => i.id)), [items])
  const suggestions = useMemo(
    () => (query.trim() ? suggest(query, have) : []),
    [query, have],
  )

  const ingredients = items.filter((i) => i.kind !== 'equipment')
  const devices = items.filter((i) => i.kind === 'equipment')

  function commit(text: string) {
    const added: KitchenItem[] = []
    for (const part of splitEntry(text)) {
      const r = resolve(part)
      if (!r.id) continue
      added.push({ id: r.id, label: r.kind === 'unknown' ? r.label : r.label, kind: r.kind })
    }
    if (added.length) onAdd(added)
    setQuery('')
    setCursor(0)
  }

  function pick(s: Suggestion) {
    onAdd([{ id: s.id, label: s.label, kind: s.kind }])
    setQuery('')
    setCursor(0)
    inputRef.current?.focus()
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' && suggestions.length) {
      e.preventDefault()
      setCursor((c) => (c + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp' && suggestions.length) {
      e.preventDefault()
      setCursor((c) => (c - 1 + suggestions.length) % suggestions.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (suggestions.length && !query.includes(',')) pick(suggestions[cursor])
      else commit(query)
    } else if (e.key === 'Escape') {
      setQuery('')
    }
  }

  function toggleDiet(key: string) {
    setPrefs({ ...prefs, diet: { ...prefs.diet, [key]: !prefs.diet[key] } })
  }

  function togglePreferNot(id: string) {
    const on = prefs.preferNot.includes(id)
    setPrefs({
      ...prefs,
      preferNot: on ? prefs.preferNot.filter((x) => x !== id) : [...prefs.preferNot, id],
    })
  }

  return (
    <aside className="panel">
      <div className="panel-section">
        <h2 className="panel-title">
          In my kitchen
          {items.length > 0 && <span className="n">{items.length}</span>}
          {items.length > 0 && <button onClick={onClear}>clear</button>}
        </h2>

        <div className="entry">
          <input
            ref={inputRef}
            value={query}
            placeholder="chicken, spinach, air fryer…"
            onChange={(e) => {
              setQuery(e.target.value)
              setCursor(0)
            }}
            onKeyDown={onKeyDown}
            aria-label="Add ingredients or devices"
          />
          {suggestions.length > 0 && (
            <div className="suggestions">
              <ul role="listbox">
                {suggestions.map((s, i) => (
                  <li
                    key={s.id}
                    role="option"
                    aria-selected={i === cursor}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      pick(s)
                    }}
                  >
                    {s.label}
                    <span className="detail">{s.detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <p className="hint">
          Type and hit enter. Paste a whole list separated by commas and it will sort the
          devices from the food.
        </p>

        {ingredients.length > 0 && (
          <div className="chips">
            {ingredients.map((item) => (
              <span key={item.id} className={`chip ${item.kind === 'unknown' ? 'unknown' : ''}`}>
                {item.label}
                <button onClick={() => onRemove(item.id)} aria-label={`Remove ${item.label}`}>
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        {devices.length > 0 && (
          <div className="chips">
            {devices.map((item) => (
              <span key={item.id} className="chip device">
                {item.label}
                <button onClick={() => onRemove(item.id)} aria-label={`Remove ${item.label}`}>
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        {items.length === 0 && (
          <>
            <div className="chips">
              {QUICK_ADD.map((id) => (
                <button
                  key={id}
                  className="toggle"
                  onClick={() =>
                    onAdd([
                      {
                        id,
                        label: nameOf(id),
                        kind: resolve(nameOf(id)).kind === 'equipment' ? 'equipment' : 'ingredient',
                      },
                    ])
                  }
                >
                  + {nameOf(id)}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="panel-section">
        <h2 className="panel-title">Assumptions</h2>
        <label className="switch">
          <input
            type="checkbox"
            checked={includeStaples}
            onChange={(e) => setIncludeStaples(e.target.checked)}
          />
          I have the basics — salt, pepper, water, cooking oil, a stove, a pan and a fridge
        </label>
      </div>

      <div className="panel-section">
        <h2 className="panel-title">Eating</h2>
        <div className="toggle-row">
          {Object.entries(DIET_LABELS).map(([key, label]) => (
            <button
              key={key}
              className="toggle"
              aria-pressed={!!prefs.diet[key]}
              onClick={() => toggleDiet(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="panel-section">
        <h2 className="panel-title">Swap out when possible</h2>
        <div className="toggle-row">
          {['sugar', 'honey', 'jaggery', 'maple_syrup', 'brown_sugar', 'ghee', 'butter', 'mayo'].map(
            (id) => (
              <button
                key={id}
                className="toggle"
                aria-pressed={prefs.preferNot.includes(id)}
                onClick={() => togglePreferNot(id)}
              >
                {nameOf(id)}
              </button>
            ),
          )}
        </div>
        <p className="hint">
          Anything switched on here gets replaced with something you like better whenever
          the swap table has an option — it never stops a recipe from showing up.
        </p>
      </div>
    </aside>
  )
}
