import type { RecipeMatch } from '../lib/types'

/**
 * The one-line explanations under a recipe - what you would be swapping, what
 * device stands in, what you are short of. Shared by the card and the
 * suggestion panel so the same situation is never worded two different ways.
 */
export function MatchNotes({ match }: { match: RecipeMatch }) {
  const { verdict, missing, substitutions, equipment } = match
  const swapsNeeded = substitutions.filter((s) => s.substitution?.reason !== 'prefer_not')
  const preferenceSwaps = substitutions.filter((s) => s.substitution?.reason === 'prefer_not')
  const deviceSwap = equipment.find((e) => !e.have && e.useInstead)

  return (
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
          <b>{preferenceSwaps.map((s) => s.substitution!.useName).join(', ')}</b> in place of{' '}
          {preferenceSwaps.map((s) => s.name.toLowerCase()).join(', ')} — your swap
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
  )
}
