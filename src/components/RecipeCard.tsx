import { MatchNotes } from './MatchNotes'
import type { RecipeMatch, Verdict } from '../lib/types'

export const VERDICT_LABEL: Record<Verdict, string> = {
  ready: 'Make it now',
  almost: 'Almost',
  stretch: 'Short a few',
  blocked: 'Not tonight',
}

interface Props {
  match: RecipeMatch
  onOpen: () => void
  /** Position in its section, used to stagger the entrance animation. */
  index?: number
}

const STANDING_LABEL = { pinned: 'pinned', rare: 'rarely', normal: '' } as const

export function RecipeCard({ match, onOpen, index = 0 }: Props) {
  const { recipe, verdict, standing } = match
  const protein = recipe.nutrition_per_serving?.protein_g

  return (
    <button
      className={`card v-${verdict}`}
      style={{ '--i': index } as React.CSSProperties}
      onClick={onOpen}
      aria-label={`Open ${recipe.title}`}
    >
      <div className="card-top">
        <h3>{recipe.title}</h3>
        <span className={`badge ${verdict}`}>{VERDICT_LABEL[verdict]}</span>
      </div>

      <p className="summary">{recipe.summary}</p>

      <MatchNotes match={match} />

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
        {/* Standing is not a fact about the food, so it sits apart from the
            numbers rather than reading as another one of them. */}
        {standing !== 'normal' && (
          <span className={`stand ${standing}`}>{STANDING_LABEL[standing]}</span>
        )}
      </div>
    </button>
  )
}
