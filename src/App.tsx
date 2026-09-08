import { useEffect, useMemo, useState } from 'react'
import { IconChevron, IconSparkle } from './components/Icons'
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
import { byShelf, matchAll, type Kitchen } from './lib/match'
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
type ViewMode = 'matches' | 'all'

/**
 * The same button in two places: the results toolbar once there is a kitchen,
 * and the empty state before there is one. It is deliberately never gated on
 * having picked anything - pressing it cold is a perfectly good way to start.
 */
function SuggestButton({
  onClick,
  disabled,
  variant,
}: {
  onClick: () => void
  disabled: boolean
  variant?: 'blank'
}) {
  return (
    <button
      className={variant === 'blank' ? 'suggest blank-cta' : 'suggest'}
      onClick={onClick}
      disabled={disabled}
      title={disabled ? 'Everything is ruled out by your avoid list' : undefined}
    >
      <IconSparkle size={15} />
      Suggest a recipe
    </button>
  )
}

export default function App() {
  const initial = useMemo(load, [])
  const [items, setItems] = useState<KitchenItem[]>(initial.items)
  const [includeStaples, setIncludeStaples] = useState(initial.includeStaples)
  const prefs = defaultPreferences
  const [openId, setOpenId] = useState<string | null>(null)
  const [sort, setSort] = useState<SortMode>('best')
  const [showBlocked, setShowBlocked] = useState(false)
  /**
   * Browsing answers the collection's other question: not "what can I cook"
   * but "what is in here at all". Kept as view state rather than a filter, so
   * the matched list holds its sort and its blocked toggle while you are away.
   */
  const [view, setView] = useState<ViewMode>('matches')

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
    // Every mode sorts on verdict and standing first (see `byShelf`), so the
    // headline sort only ever reorders within a section - "Most protein" means
    // the most protein among the things you would actually cook, with the rare
    // ones following behind rather than topping the list.
    if (sort === 'protein') {
      copy.sort(
        (a, b) =>
          byShelf(a, b) ||
          (b.recipe.nutrition_per_serving?.protein_g ?? 0) -
            (a.recipe.nutrition_per_serving?.protein_g ?? 0),
      )
    } else if (sort === 'quick') {
      copy.sort((a, b) => byShelf(a, b) || a.recipe.time.total - b.recipe.time.total)
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

  /** Every recipe, A to Z. Browsing is a cookbook, not a ranking - the rare
   * ones sit in the list like anything else, just wearing their label. */
  const allRecipes = useMemo(
    () => [...matches].sort((a, b) => a.recipe.title.localeCompare(b.recipe.title)),
    [matches],
  )

  const open = openId ? matches.find((m) => m.recipe.id === openId) : null
  const hasKitchen = items.length > 0

  /**
   * What you actually chose, which is not what the kitchen holds - the staples
   * are folded into `kitchen` for matching, and letting them count here would
   * make every recipe relevant on the strength of the salt.
   */
  const picked = useMemo(
    () => new Set(items.filter((i) => i.kind !== 'equipment').map((i) => i.id)),
    [items],
  )
  const pool = useMemo(() => suggestionPool(matches, picked), [matches, picked])
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
        <button
          className={`count ${view === 'all' ? 'open' : ''}`}
          onClick={() => setView((v) => (v === 'all' ? 'matches' : 'all'))}
          aria-label={
            view === 'all'
              ? `Back to your matches. ${recipes.length} recipes, ${byVerdict.ready.length} ready to go`
              : `Browse all ${recipes.length} recipes`
          }
        >
          {recipes.length} recipes · {byVerdict.ready.length} ready to go
          <IconChevron size={14} />
        </button>
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
          {view === 'all' ? (
            <div className="results-head">
              <SuggestButton onClick={suggest} disabled={!pool.length} />
              <button className="back" onClick={() => setView('matches')}>
                <IconChevron size={14} className="back-arrow" />
                Back to matches
              </button>
            </div>
          ) : (
            hasKitchen && (
              <div className="results-head">
                <SuggestButton onClick={suggest} disabled={!pool.length} />

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
            )
          )}

          {suggested && (
            <Spotlight
              match={suggested}
              poolSize={pool.length}
              narrowed={picked.size > 0}
              onAnother={suggest}
              onDismiss={() => setSuggestedId(null)}
              onOpen={() => setOpenId(suggested.recipe.id)}
            />
          )}

          {view === 'all' ? (
            <section>
              <div className="section-head">
                <h2>All recipes</h2>
                <span className="blurb">
                  {recipes.length} · everything in the book, A to Z. The badges still
                  read against your kitchen.
                </span>
              </div>
              <div className="grid">
                {allRecipes.map((match, i) => (
                  <RecipeCard
                    key={match.recipe.id}
                    match={match}
                    index={i}
                    onOpen={() => setOpenId(match.recipe.id)}
                  />
                ))}
              </div>
            </section>
          ) : !hasKitchen ? (
            <div className="blank">
              <h2>Tell me what you have</h2>
              <p>
                Add a few ingredients and any devices — an air fryer, a pressure cooker, a
                blender. Everything you can cook right now floats to the top, with the
                substitutions worked out for whatever you are missing.
              </p>
              <p className="blank-alt">Or do not, and let it pick for you.</p>
              <SuggestButton onClick={suggest} disabled={!pool.length} variant="blank" />
            </div>
          ) : (
            <>
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
                      most. Or press <b>Suggest a recipe</b>, which will happily propose
                      something you are a shop away from.
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
