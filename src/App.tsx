import { useEffect, useMemo, useState } from 'react'
import { IconSparkle } from './components/Icons'
import { KitchenPanel, type KitchenItem } from './components/KitchenPanel'
import { RecipeCard } from './components/RecipeCard'
import { RecipeDetail } from './components/RecipeDetail'
import { Spotlight } from './components/Spotlight'
import {
  defaultPreferences,
  recipes,
  stapleEquipment,
  stapleIngredients,
} from './lib/db'
import { matchAll, type Kitchen } from './lib/match'
import { pickNext, suggestionPool } from './lib/suggest'
import type { RecipeMatch, Verdict } from './lib/types'

const STORAGE_KEY = 'cookable.v1'

interface Saved {
  items: KitchenItem[]
  includeStaples: boolean
}

/**
 * Only the kitchen is remembered in the browser. Preferences - the avoid list,
 * the swap-out list, the diet filters - are not editable in the app, so
 * data/preferences.json stays the single source of truth for them. Anything a
 * previous version of the app saved under `prefs` is deliberately ignored,
 * rather than sticking around with no way to switch it off.
 */
function load(): Saved {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Saved>
      return {
        items: parsed.items ?? [],
        includeStaples: parsed.includeStaples ?? true,
      }
    }
  } catch {
    // Corrupt or unavailable storage - start fresh rather than blowing up.
  }
  return { items: [], includeStaples: true }
}

const SECTIONS: Array<{ verdict: Verdict; title: string; blurb: string }> = [
  {
    verdict: 'ready',
    title: 'Make it now',
    blurb: 'Everything you need, or a swap you already have.',
  },
  { verdict: 'almost', title: 'One or two things short', blurb: '' },
  { verdict: 'stretch', title: 'A few things short', blurb: '' },
  { verdict: 'blocked', title: 'Not without a shop', blurb: '' },
]

type SortMode = 'best' | 'protein' | 'quick'

export default function App() {
  const initial = useMemo(load, [])
  const [items, setItems] = useState<KitchenItem[]>(initial.items)
  const [includeStaples, setIncludeStaples] = useState(initial.includeStaples)
  const prefs = defaultPreferences
  const [openId, setOpenId] = useState<string | null>(null)
  const [sort, setSort] = useState<SortMode>('best')
  const [showBlocked, setShowBlocked] = useState(false)

  /**
   * The suggestion is deliberately not persisted. It is a roll of the dice, not
   * a setting - coming back tomorrow to yesterday's pick would be odd, and the
   * kitchen it was drawn from may well have changed underneath it.
   */
  const [suggestedId, setSuggestedId] = useState<string | null>(null)
  const [drawn, setDrawn] = useState<string[]>([])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ items, includeStaples }))
  }, [items, includeStaples])

  const kitchen: Kitchen = useMemo(() => {
    const ing = new Set(items.filter((i) => i.kind !== 'equipment').map((i) => i.id))
    const eq = new Set(items.filter((i) => i.kind === 'equipment').map((i) => i.id))
    if (includeStaples) {
      for (const id of stapleIngredients) ing.add(id)
      for (const id of stapleEquipment) eq.add(id)
    }
    return { ingredients: ing, equipment: eq }
  }, [items, includeStaples])

  const matches = useMemo(() => matchAll(recipes, kitchen, prefs), [kitchen, prefs])

  const sorted = useMemo(() => {
    const copy = [...matches]
    if (sort === 'protein') {
      copy.sort((a, b) => {
        const rank =
          { ready: 0, almost: 1, stretch: 2, blocked: 3 }[a.verdict] -
          { ready: 0, almost: 1, stretch: 2, blocked: 3 }[b.verdict]
        if (rank !== 0) return rank
        return (
          (b.recipe.nutrition_per_serving?.protein_g ?? 0) -
          (a.recipe.nutrition_per_serving?.protein_g ?? 0)
        )
      })
    } else if (sort === 'quick') {
      copy.sort((a, b) => {
        const rank =
          { ready: 0, almost: 1, stretch: 2, blocked: 3 }[a.verdict] -
          { ready: 0, almost: 1, stretch: 2, blocked: 3 }[b.verdict]
        if (rank !== 0) return rank
        return a.recipe.time.total - b.recipe.time.total
      })
    }
    return copy
  }, [matches, sort])

  const byVerdict = useMemo(() => {
    const map: Record<Verdict, RecipeMatch[]> = {
      ready: [],
      almost: [],
      stretch: [],
      blocked: [],
    }
    for (const m of sorted) map[m.verdict].push(m)
    return map
  }, [sorted])

  const open = openId ? matches.find((m) => m.recipe.id === openId) : null
  const hasKitchen = items.length > 0

  const pool = useMemo(() => suggestionPool(matches), [matches])
  /**
   * Resolved against the live matches rather than stored whole, so a suggestion
   * left on screen while you edit the kitchen updates its verdict instead of
   * quietly going stale.
   */
  const suggested = suggestedId
    ? matches.find((m) => m.recipe.id === suggestedId) ?? null
    : null

  function suggest() {
    const next = pickNext(pool, drawn, suggestedId)
    setSuggestedId(next.id)
    setDrawn(next.seen)
  }

  function addItems(added: KitchenItem[]) {
    setItems((prev) => {
      const seen = new Set(prev.map((i) => i.id))
      return [...prev, ...added.filter((a) => a.id && !seen.has(a.id))]
    })
  }

  return (
    <div className="app">
      <header className="masthead">
        <h1>Cookable</h1>
        <span className="tagline">What can I actually make right now?</span>
        <span className="count">
          {recipes.length} recipes · {byVerdict.ready.length} ready to go
        </span>
      </header>

      <div className="layout">
        <KitchenPanel
          items={items}
          onAdd={addItems}
          onRemove={(id) => setItems((prev) => prev.filter((i) => i.id !== id))}
          onClear={() => setItems([])}
          includeStaples={includeStaples}
          setIncludeStaples={setIncludeStaples}
        />

        <main>
          {!hasKitchen ? (
            <div className="blank">
              <h2>Tell me what you have</h2>
              <p>
                Add a few ingredients and any devices — an air fryer, a pressure cooker, a
                blender. Everything you can cook right now floats to the top, with the
                substitutions worked out for whatever you are missing.
              </p>
            </div>
          ) : (
            <>
              <div className="results-head">
                <button
                  className="suggest"
                  onClick={suggest}
                  disabled={!pool.length}
                  title={
                    pool.length
                      ? undefined
                      : 'Nothing you could cook yet - add a couple more things'
                  }
                >
                  <IconSparkle size={15} />
                  Suggest a recipe
                </button>

                <div className="seg">
                  <button aria-pressed={sort === 'best'} onClick={() => setSort('best')}>
                    Best match
                  </button>
                  <button aria-pressed={sort === 'protein'} onClick={() => setSort('protein')}>
                    Most protein
                  </button>
                  <button aria-pressed={sort === 'quick'} onClick={() => setSort('quick')}>
                    Quickest
                  </button>
                </div>
                <label className="switch" style={{ marginLeft: 'auto' }}>
                  <input
                    type="checkbox"
                    checked={showBlocked}
                    onChange={(e) => setShowBlocked(e.target.checked)}
                  />
                  Show what I cannot make
                </label>
              </div>

              {suggested && (
                <Spotlight
                  match={suggested}
                  poolSize={pool.length}
                  onAnother={suggest}
                  onDismiss={() => setSuggestedId(null)}
                  onOpen={() => setOpenId(suggested.recipe.id)}
                />
              )}

              {SECTIONS.map(({ verdict, title, blurb }) => {
                const group = byVerdict[verdict]
                if (!group.length) return null
                if (verdict === 'blocked' && !showBlocked) return null
                return (
                  <section key={verdict}>
                    <div className="section-head">
                      <h2>{title}</h2>
                      <span className="blurb">
                        {group.length}
                        {blurb ? ` · ${blurb}` : ''}
                      </span>
                    </div>
                    <div className="grid">
                      {group.map((match, i) => (
                        <RecipeCard
                          key={match.recipe.id}
                          match={match}
                          index={i}
                          onOpen={() => setOpenId(match.recipe.id)}
                        />
                      ))}
                    </div>
                  </section>
                )
              })}

              {byVerdict.ready.length === 0 &&
                byVerdict.almost.length === 0 &&
                byVerdict.stretch.length === 0 && (
                  <div className="blank">
                    <h2>Nothing quite lines up yet</h2>
                    <p>
                      Add a couple more things — a protein and a base usually unlocks the
                      most. Or tick “Show what I cannot make” to see what you are missing
                      for each.
                    </p>
                  </div>
                )}
            </>
          )}
        </main>
      </div>

      {open && <RecipeDetail match={open} onClose={() => setOpenId(null)} />}
    </div>
  )
}
