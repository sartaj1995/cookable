import {
  equipmentAlternates,
  groupsByIngredient,
  nameOf,
  rulesByIngredient,
  standingOf,
} from './db'
import { avoidsFromDiet } from './diet'
import type {
  EquipmentCheck,
  MatchedLine,
  Preferences,
  Recipe,
  RecipeIngredient,
  RecipeMatch,
  Standing,
  SubstitutionResult,
  Verdict,
} from './types'

export interface Kitchen {
  /** Ingredient ids you have, staples already folded in. */
  ingredients: Set<string>
  /** Device ids you have. */
  equipment: Set<string>
}

interface Candidate {
  result: SubstitutionResult
  /** Lower sorts first. */
  rank: number
}

export const VERDICT_RANK: Record<Verdict, number> = {
  ready: 0,
  almost: 1,
  stretch: 2,
  blocked: 3,
}

const STANDING_RANK: Record<Standing, number> = { pinned: 0, normal: 1, rare: 2 }

/**
 * The two keys every sort mode agrees on, before it applies its own.
 *
 * Verdict comes first and standing second, never the other way round: a pinned
 * recipe you cannot cook tonight must not outrank one you can, or the sections
 * stop meaning what they say. Standing only reorders within a section, which is
 * why it is a comparator here rather than a term in `score` - `score` answers
 * "how well does this fit the kitchen", and how much you like the dish is no
 * part of that question.
 */
export function byShelf(a: RecipeMatch, b: RecipeMatch): number {
  const verdict = VERDICT_RANK[a.verdict] - VERDICT_RANK[b.verdict]
  if (verdict !== 0) return verdict
  return STANDING_RANK[a.standing] - STANDING_RANK[b.standing]
}

/**
 * Find something in your kitchen that can stand in for `line`.
 *
 * Two sources, in order: the interchangeable groups in substitutions.json, then
 * the one-directional rules. Candidates are ranked by your stated preferences
 * first, then by whether the stand-in actually does the job the recipe needs
 * this ingredient for.
 */
function findSubstitute(
  line: RecipeIngredient,
  kitchen: Kitchen,
  prefs: Preferences,
  avoid: Set<string>,
  reason: SubstitutionResult['reason'],
): SubstitutionResult | null {
  if (line.sub_group === 'none') return null
  // An optional ingredient that is missing gets skipped, not replaced. Nobody
  // needs to be told which of three things to use in place of a garnish.
  if (line.optional) return null

  const candidates: Candidate[] = []
  const needed = line.function

  const groups = (groupsByIngredient.get(line.id) ?? []).filter(
    (g) => !line.sub_group || line.sub_group === g.id,
  )

  for (const group of groups) {
    const preferred = prefs.prefer[group.id] ?? []

    // Recipes get written by hand, so a `function` may be a word this group has
    // never heard of ("marinade", "topping"). When nothing in the group claims
    // to provide it, the word carries no information - fall back to trusting the
    // group, rather than silently rejecting every possible swap.
    const understood = needed
      ? group.members.some((m) => m.provides?.includes(needed))
      : false

    for (const member of group.members) {
      if (member.ingredient === line.id) continue
      if (!kitchen.ingredients.has(member.ingredient)) continue
      if (avoid.has(member.ingredient)) continue

      // Does the stand-in do the job this recipe needs the original for?
      let clean = true
      if (needed) {
        if (member.lacks?.includes(needed)) clean = false
        else if (understood && member.provides && !member.provides.includes(needed))
          clean = false
      }

      // A swap that does not do the job is only worth offering when the table
      // says how to make up the difference - otherwise it is a bad suggestion
      // dressed up as a helpful one.
      if (!clean && !member.compensate) continue
      // `core` means the recipe is not itself without this ingredient, so it
      // only gets a like-for-like replacement.
      if (!clean && line.core) continue

      const prefIndex = preferred.indexOf(member.ingredient)
      let rank = prefIndex >= 0 ? prefIndex : 50
      if (!clean) rank += 100
      if (prefs.preferNot.includes(member.ingredient)) rank += 200

      candidates.push({
        rank,
        result: {
          use: member.ingredient,
          useName: nameOf(member.ingredient),
          amount: member.amount,
          clean,
          reason,
          groupName: group.name,
          reference: group.reference,
          notes: member.notes,
          compensate: clean ? undefined : member.compensate,
        },
      })
    }
  }

  for (const rule of rulesByIngredient.get(line.id) ?? []) {
    for (const target of rule.to) {
      if (!kitchen.ingredients.has(target.ingredient)) continue
      if (avoid.has(target.ingredient)) continue
      if (target.flagged && line.core) continue
      candidates.push({
        rank: target.flagged ? 400 : 300,
        result: {
          use: target.ingredient,
          useName: nameOf(target.ingredient),
          amount: target.amount,
          clean: !target.flagged,
          reason,
          groupName: rule.note,
          notes: target.notes,
        },
      })
    }
  }

  if (!candidates.length) return null
  candidates.sort((a, b) => a.rank - b.rank)
  return candidates[0].result
}

function checkEquipment(recipe: Recipe, kitchen: Kitchen): EquipmentCheck[] {
  return recipe.equipment.required.map((need) => {
    if (kitchen.equipment.has(need)) {
      return { need, needName: nameOf(need), have: true }
    }
    const alternate = equipmentAlternates.find(
      (a) => a.from === need && kitchen.equipment.has(a.to),
    )
    if (alternate) {
      return {
        need,
        needName: nameOf(need),
        have: false,
        useInstead: {
          id: alternate.to,
          name: nameOf(alternate.to),
          note: alternate.note,
          flagged: alternate.flagged,
        },
      }
    }
    return { need, needName: nameOf(need), have: false }
  })
}

export function matchRecipe(
  recipe: Recipe,
  kitchen: Kitchen,
  prefs: Preferences,
): RecipeMatch {
  const avoid = new Set([...prefs.avoid, ...avoidsFromDiet(prefs.diet)])
  const lines: MatchedLine[] = []

  for (const ingredient of recipe.ingredients) {
    const name = nameOf(ingredient.id)
    const have = kitchen.ingredients.has(ingredient.id)
    const isAvoided = avoid.has(ingredient.id)
    const isDisliked = prefs.preferNot.includes(ingredient.id)

    // Swap out anything you have said no to, even when it is sitting in the
    // kitchen - that is the whole point of the prefer_not list.
    if (have && !isAvoided && !isDisliked) {
      lines.push({ ingredient, name, status: 'have' })
      continue
    }

    const reason: SubstitutionResult['reason'] = isAvoided
      ? 'avoid'
      : isDisliked && have
        ? 'prefer_not'
        : 'missing'

    const substitution = findSubstitute(ingredient, kitchen, prefs, avoid, reason)
    if (substitution) {
      lines.push({ ingredient, name, status: 'substitute', substitution })
      continue
    }

    // No swap available. A disliked-but-present ingredient still gets used;
    // an avoided one does not.
    if (isDisliked && have && !isAvoided) {
      lines.push({ ingredient, name, status: 'have' })
      continue
    }
    if (isAvoided && have) {
      lines.push({ ingredient, name, status: 'missing', blockedByAvoid: true })
      continue
    }
    if (ingredient.optional) {
      lines.push({ ingredient, name, status: 'skip' })
      continue
    }
    lines.push({ ingredient, name, status: 'missing', blockedByAvoid: isAvoided })
  }

  const equipment = checkEquipment(recipe, kitchen)
  const missing = lines.filter((l) => l.status === 'missing')
  const substitutions = lines.filter((l) => l.status === 'substitute')

  const blockers: string[] = []
  for (const line of missing) {
    if (line.ingredient.core) {
      blockers.push(
        line.blockedByAvoid
          ? `${line.name} is on your avoid list and nothing can replace it here`
          : `No ${line.name}, and nothing in your kitchen can stand in`,
      )
    }
  }
  for (const check of equipment) {
    if (!check.have && !check.useInstead) {
      blockers.push(`Needs a ${check.needName.toLowerCase()}`)
    }
  }

  let verdict: Verdict
  if (blockers.length) verdict = 'blocked'
  else if (missing.length === 0) verdict = 'ready'
  else if (missing.length <= 2) verdict = 'almost'
  else verdict = 'stretch'

  const counted = lines.filter((l) => l.status !== 'skip')
  const haveRatio = counted.length
    ? (counted.length - missing.length) / counted.length
    : 1

  const messySubs = substitutions.filter((s) => !s.substitution?.clean).length
  const score =
    VERDICT_RANK[verdict] * 1000 +
    missing.length * 20 +
    messySubs * 4 +
    substitutions.length * 1 +
    equipment.filter((e) => !e.have).length * 2 +
    recipe.time.total / 100

  return {
    recipe,
    verdict,
    lines,
    equipment,
    missing,
    substitutions,
    blockers,
    standing: standingOf(recipe.id),
    score,
    haveRatio,
  }
}

export function matchAll(
  recipes: Recipe[],
  kitchen: Kitchen,
  prefs: Preferences,
): RecipeMatch[] {
  return recipes
    .map((r) => matchRecipe(r, kitchen, prefs))
    .sort((a, b) => byShelf(a, b) || a.score - b.score)
}
