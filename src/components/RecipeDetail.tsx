import { useEffect } from 'react'
import { ingredientLineText } from '../lib/db'
import type { MatchedLine, RecipeMatch } from '../lib/types'

const TICK = { have: '✓', substitute: '⇄', missing: '!', skip: '–' } as const

function IngredientRow({ line }: { line: MatchedLine }) {
  const sub = line.substitution
  return (
    <li className="ing">
      <span className={`tick ${line.status}`} aria-hidden>
        {TICK[line.status]}
      </span>
      <div className="ing-main">
        {sub ? (
          <>
            <div className="sub-line">
              <span className="strike">
                {ingredientLineText(line.ingredient.qty, line.ingredient.id)}
              </span>
            </div>
            <div>
              <span className="sub-to">{sub.amount}</span>{' '}
              <span className="qty">{sub.useName.toLowerCase()}</span>
              {sub.reference && <span className="tag">per {sub.reference}</span>}
              {sub.reason === 'avoid' && <span className="tag">avoided</span>}
              {sub.reason === 'prefer_not' && <span className="tag">your swap</span>}
            </div>
            {sub.notes && <div className="aside">{sub.notes}</div>}
            {!sub.clean && sub.compensate && (
              <div className="heads-up">
                <b>Watch out:</b> {sub.compensate}
              </div>
            )}
          </>
        ) : (
          <>
            <div>
              <span className="qty">
                {ingredientLineText(line.ingredient.qty, line.ingredient.id)}
              </span>
              {line.status === 'skip' && <span className="tag">optional — skipping</span>}
              {line.status === 'missing' && (
                <span className="tag">
                  {line.blockedByAvoid ? 'on your avoid list' : 'missing'}
                </span>
              )}
              {line.status === 'have' && line.ingredient.optional && (
                <span className="tag">optional</span>
              )}
            </div>
            {line.ingredient.note && <div className="aside">{line.ingredient.note}</div>}
          </>
        )}
      </div>
    </li>
  )
}

interface Props {
  match: RecipeMatch
  onClose: () => void
}

export function RecipeDetail({ match, onClose }: Props) {
  const { recipe, lines, equipment, missing } = match
  const n = recipe.nutrition_per_serving

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const deviceNotes = equipment.filter((e) => !e.have)

  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal>
        <header className="sheet-head">
          <button className="close" onClick={onClose} aria-label="Close">
            ×
          </button>
          <h2>{recipe.title}</h2>
          <p className="summary">{recipe.summary}</p>
          <div className="stats">
            <div>
              <span className="k">Time</span>
              <span className="v">{recipe.time.total} min</span>
            </div>
            <div>
              <span className="k">Serves</span>
              <span className="v">{recipe.servings}</span>
            </div>
            {n?.protein_g !== undefined && (
              <div>
                <span className="k">Protein</span>
                <span className="v">{n.protein_g} g</span>
              </div>
            )}
            {n?.calories !== undefined && (
              <div>
                <span className="k">Calories</span>
                <span className="v">{n.calories}</span>
              </div>
            )}
            {n?.fibre_g !== undefined && (
              <div>
                <span className="k">Fibre</span>
                <span className="v">{n.fibre_g} g</span>
              </div>
            )}
            {n?.added_sugar_g !== undefined && (
              <div>
                <span className="k">Added sugar</span>
                <span className="v">{n.added_sugar_g} g</span>
              </div>
            )}
          </div>
        </header>

        <div className="sheet-body">
          {match.blockers.length > 0 && (
            <div className="note stop" style={{ fontSize: 13.5 }}>
              <b>Cannot make this right now.</b> {match.blockers.join('. ')}.
            </div>
          )}

          {deviceNotes.length > 0 && (
            <div className="block">
              <h3>Equipment</h3>
              <div className="notelist">
                {deviceNotes.map((e) => (
                  <div key={e.need} className={e.useInstead ? 'note device' : 'note stop'}>
                    {e.useInstead ? (
                      <>
                        <b>
                          No {e.needName.toLowerCase()}? Use your{' '}
                          {e.useInstead.name.toLowerCase()}.
                        </b>{' '}
                        {e.useInstead.note}
                      </>
                    ) : (
                      <>This one really does need a {e.needName.toLowerCase()}.</>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="block">
            <h3>Ingredients</h3>
            <ul className="ing-list">
              {lines.map((line) => (
                <IngredientRow key={line.ingredient.id + line.ingredient.qty} line={line} />
              ))}
            </ul>
            {missing.length > 0 && (
              <p className="hint" style={{ marginTop: 12 }}>
                Shopping list: {missing.map((m) => m.name.toLowerCase()).join(', ')}
              </p>
            )}
          </div>

          <div className="block">
            <h3>Method</h3>
            <ol className="steps">
              {recipe.steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </div>

          {recipe.tips && recipe.tips.length > 0 && (
            <div className="block">
              <h3>Worth knowing</h3>
              <ul className="bullets">
                {recipe.tips.map((tip, i) => (
                  <li key={i}>{tip}</li>
                ))}
              </ul>
            </div>
          )}

          {recipe.health_notes && (
            <div className="block">
              <h3>Why it is good for you</h3>
              <div className="callout">{recipe.health_notes}</div>
            </div>
          )}

          <div className="block">
            <div className="tagrow">
              <span>{recipe.cuisine}</span>
              {recipe.meal.map((m) => (
                <span key={m}>{m}</span>
              ))}
              {recipe.tags.map((t) => (
                <span key={t}>{t}</span>
              ))}
            </div>
          </div>

          {recipe.source && (
            <div className="source">
              {recipe.source.url ? (
                <>
                  From{' '}
                  <a href={recipe.source.url} target="_blank" rel="noreferrer">
                    {recipe.source.title || recipe.source.url}
                  </a>
                  {recipe.source.channel && ` — ${recipe.source.channel}`}
                </>
              ) : (
                <>Source: {recipe.source.type}</>
              )}
              {recipe.source.adapted && <div>Adapted: {recipe.source.adapted}</div>}
              {n?.estimated && <div>Nutrition figures are estimates.</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
