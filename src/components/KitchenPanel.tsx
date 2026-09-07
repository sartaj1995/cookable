import { useMemo, useRef, useState } from 'react'
import { resolve, splitEntry, suggest, type Suggestion } from '../lib/normalize'
import { pickerSections, sectionTotals } from '../lib/catalogue'
import { IconChevron, IconClose } from './Icons'

export interface KitchenItem {
  id: string
  label: string
  kind: 'ingredient' | 'equipment' | 'unknown'
}

interface Props {
  items: KitchenItem[]
  onAdd: (items: KitchenItem[]) => void
  onRemove: (id: string) => void
  onClear: () => void
  includeStaples: boolean
  setIncludeStaples: (v: boolean) => void
}

export function KitchenPanel({
  items,
  onAdd,
  onRemove,
  onClear,
  includeStaples,
  setIncludeStaples,
}: Props) {
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const [openSection, setOpenSection] = useState<string | null>('equipment')
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
      added.push({ id: r.id, label: r.label, kind: r.kind })
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

  function toggle(id: string, label: string, kind: 'ingredient' | 'equipment') {
    if (have.has(id)) onRemove(id)
    else onAdd([{ id, label, kind }])
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
          Type and hit enter, or pick from the lists below. Pasting a comma-separated
          list works too — it sorts the devices from the food.
        </p>

        {ingredients.length > 0 && (
          <div className="chips">
            {ingredients.map((item) => (
              <span key={item.id} className={`chip ${item.kind === 'unknown' ? 'unknown' : ''}`}>
                {item.label}
                <button onClick={() => onRemove(item.id)} aria-label={`Remove ${item.label}`}>
                  <IconClose size={13} />
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
                  <IconClose size={13} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {pickerSections.map((section) => {
        const chosen = section.groups.reduce(
          (n, g) => n + g.options.filter((o) => have.has(o.id)).length,
          0,
        )
        const open = openSection === section.id
        return (
          <div className="panel-section cat" key={section.id}>
            <button
              className="cat-head"
              aria-expanded={open}
              onClick={() => setOpenSection(open ? null : section.id)}
            >
              <span className="cat-name">{section.label}</span>
              <span className="cat-count">
                {chosen > 0 ? `${chosen} of ${sectionTotals[section.id]}` : sectionTotals[section.id]}
              </span>
              <span className="cat-caret">
                <IconChevron />
              </span>
            </button>

            {open && (
              <div className="cat-body">
                {section.groups.map((group, gi) => (
                  <div className="cat-group" key={group.label ?? gi}>
                    {group.label && <h3 className="cat-group-label">{group.label}</h3>}
                    <div className="opts">
                      {group.options.map((option) => (
                        <button
                          key={option.id}
                          className={`opt ${section.kind === 'equipment' ? 'device' : ''}`}
                          aria-pressed={have.has(option.id)}
                          onClick={() => toggle(option.id, option.label, section.kind)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}

      <div className="panel-section">
        <label className="switch">
          <input
            type="checkbox"
            checked={includeStaples}
            onChange={(e) => setIncludeStaples(e.target.checked)}
          />
          I have the basics — salt, pepper, water, cooking oil, a stove, a pan and a fridge
        </label>
      </div>
    </aside>
  )
}
