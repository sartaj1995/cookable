import type { RecipeMatch, Verdict } from './types'

/**
 * "Suggest a recipe" - and the bit that actually matters, which is that
 * clicking it again has to give you something else.
 *
 * Two pieces:
 *
 * `suggestionPool` decides what is fair game. Only things you could sit down
 * and eat tonight: the `ready` list first, widening to `almost` when there are
 * too few ready recipes for "another" to feel like it does anything, and to
 * `stretch` only when nothing better exists. `blocked` is never suggested -
 * being told to cook something you cannot cook is worse than no suggestion.
 *
 * `pickNext` is a shuffle bag rather than a dice roll. Plain random repeats
 * itself: with six candidates there is a one-in-six chance every click of
 * landing back on the recipe you just rejected, which reads as a broken button.
 * So we remember what has already come up and draw from the rest, refilling
 * only once the bag is empty - you see every option before you see any twice.
 */

/** Below this many `ready` recipes the bag empties too fast to feel random. */
const MIN_POOL = 3

export function suggestionPool(matches: RecipeMatch[]): RecipeMatch[] {
  const of = (v: Verdict) => matches.filter((m) => m.verdict === v)
  const ready = of('ready')
  if (ready.length >= MIN_POOL) return ready
  const cookable = [...ready, ...of('almost')]
  if (cookable.length) return cookable
  return of('stretch')
}

export interface Draw {
  /** The recipe to show, or null when there is nothing worth suggesting. */
  id: string | null
  /** What has come up since the bag was last refilled, including `id`. */
  seen: string[]
}

/**
 * Draw the next suggestion. `seen` is carried by the caller and pruned here, so
 * a kitchen change that shrinks the pool cannot leave stale ids in the bag.
 */
export function pickNext(
  pool: RecipeMatch[],
  seen: string[],
  current: string | null,
): Draw {
  const ids = pool.map((m) => m.recipe.id)
  if (!ids.length) return { id: null, seen: [] }

  const bag = new Set(seen)
  const unseen = ids.filter((id) => !bag.has(id))

  if (!unseen.length) {
    // Bag empty, so refill it. Drop whatever is on screen first, so a refill
    // never hands back the same recipe twice running - unless it is the only
    // one there is, in which case there is nothing else to give.
    const others = ids.filter((id) => id !== current)
    const from = others.length ? others : ids
    const id = draw(from)
    return { id, seen: [id] }
  }

  const id = draw(unseen)
  return { id, seen: [...seen.filter((s) => bag.has(s) && ids.includes(s)), id] }
}

function draw(ids: string[]): string {
  return ids[Math.floor(Math.random() * ids.length)]
}
