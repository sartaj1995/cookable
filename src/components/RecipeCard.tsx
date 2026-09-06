import type { RecipeMatch } from '../lib/types'

const VERDICT_LABEL = {
  ready: 'Make it now',
  almost: 'Almost',
  stretch: 'Short a few',
  blocked: 'Not tonight',
} as const

interface Props {
  match: RecipeMatch
  onOpen: () => void
}

export function RecipeCard({ match, onOpen }: Props) {
  const { recipe, verdict, missing, substitutions, equipment } = match
  const swapsNeeded = substitutions.filter((s) => s.substitution?.reason !== 'prefer_not')
  const preferenceSwaps = substitutions.filter((s) => s.substitution?.reason === 'prefer_not')
  const deviceSwap = equipment.find((e) => !e.have && e.useInstead)
  const protein = recipe.nutrition_per_serving?.protein_g

  return (
    <button
      className={`card ${verdict === 'blocked' ? 'is-blocked' : ''}`}
      onClick={onOpen}
      aria-label={`Open ${recipe.title}`}
    >
      <div className="card-top">
        <h3>{recipe.title}</h3>
        <span className={`badge ${verdict}`}>{VERDICT_LABEL[verdict]}</span>
      </div>

      <p className="summary">{recipe.summary}</p>

      <div className="notelist">
        {swapsNeeded.length > 0 && (
          <div className="note swap">
            {swapsNeeded.slice(0, 2).map((s, i) => (
              <span key={s.ingredient.id}>
                {i > 0 && ', '}
                <b>{s.substitution!.useName}</b> in place of {s.name.toLowerCase()}
              </span>
            ))}
            {swapsNeeded.length > 2 && ` +${swapsNeeded.length - 2} more`}
          </div>
        )}

        {preferenceSwaps.length > 0 && (
          <div className="note swap">
            <b>{preferenceSwaps.map((s) => s.substitution!.useName).join(', ')}</b> in place
            of {preferenceSwaps.map((s) => s.name.toLowerCase()).join(', ')} — your swap
          </div>
        )}

        {deviceSwap && (
          <div className="note device">
            No {deviceSwap.needName.toLowerCase()} — use your{' '}
            <b>{deviceSwap.useInstead!.name.toLowerCase()}</b>
          </div>
        )}

        {verdict !== 'blocked' && missing.length > 0 && (
          <div className="note gap">
            Missing <b>{missing.map((m) => m.name.toLowerCase()).join(', ')}</b>
          </div>
        )}

        {verdict === 'blocked' && <div className="note stop">{match.blockers[0]}</div>}
      </div>

      <div className="meta">
        <span>
          <b>{recipe.time.total}</b> min
        </span>
        {protein !== undefined && (
          <span>
            <b>{protein}g</b> protein
          </span>
        )}
        {recipe.nutrition_per_serving?.calories !== undefined && (
          <span>
            <b>{recipe.nutrition_per_serving.calories}</b> kcal
          </span>
        )}
        <span>serves {recipe.servings}</span>
      </div>
    </button>
  )
}
