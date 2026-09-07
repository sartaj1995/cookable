import type { RecipeMatch } from './types'

/**
 * "Suggest a recipe" - the button for when you cannot decide.
 *
 * This deliberately does not ask what you can cook tonight. The sections below
 * already answer that, and answering it twice is what made the button feel
 * broken: pick paneer and the only thing on offer was the one paneer recipe you
 * could already see was ready, never the palak paneer you were a single shop
 * away from. Worse, a kitchen holding one thing produced no suggestion at all.
 *
 * So the pool here is wide on purpose. Short of ingredients is fine. Short of a
 * device is fine. You are being handed an idea to react to, not a plan to
 * follow, and the panel prints the verdict and what is missing so you can turn
 * it down on the spot.
 *
 * The one thing it will not offer is something you have said you cannot eat.
 * `avoid` in preferences.json is a hard no - "never suggested, never used" -
 * so a recipe needing an avoided ingredient with no way around it stays out.
 * The diet flags feed that same list.
 *
 * `pickNext` is a shuffle bag rather than a dice roll. Plain random repeats
 * itself: with six candidates there is a one-in-six chance every click of
 * landing back on the recipe you just rejected, which reads as a broken button.
 * So we remember what has already come up and draw from the rest, refilling
 * only once the bag is empty - you see every option before you see any twice.
 */

/**
 * What is in the running.
 *
 * `picked` is what you actually chose, not what the kitchen resolves to. The
 * staples are folded in for matching, and counting them here would make every
 * recipe "relevant" on the strength of the salt.
 */
export function suggestionPool(
  matches: RecipeMatch[],
  picked: Set<string>,
): RecipeMatch[] {
  const eligible = matches.filter(allowed)
  if (!picked.size) return eligible

  const uses = eligible.filter((m) =>
    m.recipe.ingredients.some((i) => picked.has(i.id)),
  )
  // Nothing you picked turns up in any recipe - a kitchen of nothing but
  // sugar-free jelly, say. Widen rather than hand back an empty pool: a button
  // that goes dead on you is the exact thing this is meant to stop.
  return uses.length ? uses : eligible
}

/** Diet and the avoid list are the only hard no. Everything else is fair game. */
function allowed(match: RecipeMatch): boolean {
  return !match.missing.some((line) => line.blockedByAvoid)
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
  return { id, seen: [...seen.filter((s) => ids.includes(s)), id] }
}

function draw(ids: string[]): string {
  return ids[Math.floor(Math.random() * ids.length)]
}
