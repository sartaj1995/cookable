import { MatchNotes } from './MatchNotes'
import { VERDICT_LABEL } from './RecipeCard'
import { IconClose, IconRefresh, IconSparkle } from './Icons'
import type { RecipeMatch } from '../lib/types'

interface Props {
  match: RecipeMatch
  /** How many recipes are in the running, so the copy can be honest about it. */
  poolSize: number
  onAnother: () => void
  onDismiss: () => void
  onOpen: () => void
}

/**
 * One recipe, picked for you, sitting above the results rather than replacing
 * them - the list you were already reading stays where it was.
 *
 * The recipe title is keyed so React remounts the body on every draw and the
 * crossfade replays. The announcement below it is a separate, permanently
 * mounted region: a live region that unmounts with its content announces
 * nothing, and reading the whole panel aloud on every click would be a lot.
 */
export function Spotlight({ match, poolSize, onAnother, onDismiss, onOpen }: Props) {
  const { recipe, verdict } = match
  const n = recipe.nutrition_per_serving
  const alone = poolSize <= 1

  return (
    <section className="spotlight" aria-labelledby="spot-eyebrow">
      <div className="spot-head">
        <h2 className="eyebrow" id="spot-eyebrow">
          <IconSparkle size={13} />
          Tonight&rsquo;s pick
        </h2>

        {alone ? (
          <span className="spot-alone">the only thing that fits right now</span>
        ) : (
          <button className="spot-btn" onClick={onAnother}>
            <IconRefresh size={13} />
            Another
          </button>
        )}

        <button className="spot-btn icon" onClick={onDismiss} aria-label="Dismiss suggestion">
          <IconClose size={15} />
        </button>
      </div>

      <div className="spot-body" key={recipe.id}>
        <div className="spot-title-row">
          <h3>{recipe.title}</h3>
          <span className={`badge ${verdict}`}>{VERDICT_LABEL[verdict]}</span>
        </div>

        <p className="spot-summary">{recipe.summary}</p>

        <MatchNotes match={match} />

        <div className="spot-foot">
          <div className="meta">
            <span>
              <b>{recipe.time.total}</b> min
            </span>
            {n?.protein_g !== undefined && (
              <span>
                <b>{n.protein_g}g</b> protein
              </span>
            )}
            {n?.calories !== undefined && (
              <span>
                <b>{n.calories}</b> kcal
              </span>
            )}
            <span>serves {recipe.servings}</span>
          </div>

          <button className="spot-open" onClick={onOpen}>
            See the recipe
          </button>
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        Suggested: {recipe.title}. {VERDICT_LABEL[verdict]}.
      </p>
    </section>
  )
}
