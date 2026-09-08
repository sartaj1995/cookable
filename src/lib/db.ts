import ingredientsData from '../../data/ingredients.json'
import equipmentData from '../../data/equipment.json'
import substitutionsData from '../../data/substitutions.json'
import preferencesData from '../../data/preferences.json'
import favouritesData from '../../data/favourites.json'
import standingData from '../../data/standing.json'
import type {
  Equipment,
  EquipmentAlternate,
  Ingredient,
  Preferences,
  Recipe,
  Standing,
  SubGroup,
  SubRule,
} from './types'

/**
 * Every recipes/*.json file, picked up at build time. Drop a new file in that
 * folder and it shows up here - no registry to update, no import to add.
 */
const recipeModules = import.meta.glob<{ default: Recipe }>('../../recipes/*.json', {
  eager: true,
})

export const recipes: Recipe[] = Object.entries(recipeModules)
  .map(([path, mod]) => {
    const recipe = mod.default
    if (!recipe.id) {
      // Fall back to the filename so a half-finished recipe still renders.
      recipe.id = path.split('/').pop()!.replace(/\.json$/, '')
    }
    return recipe
  })
  .sort((a, b) => a.title.localeCompare(b.title))

export const ingredients: Ingredient[] = ingredientsData.ingredients as Ingredient[]
export const equipment: Equipment[] = equipmentData.equipment as Equipment[]
export const equipmentAlternates: EquipmentAlternate[] =
  equipmentData.alternates as EquipmentAlternate[]
export const subGroups: SubGroup[] = substitutionsData.groups as SubGroup[]
export const subRules: SubRule[] = substitutionsData.rules as SubRule[]

export const ingredientById = new Map(ingredients.map((i) => [i.id, i]))
export const equipmentById = new Map(equipment.map((e) => [e.id, e]))

/**
 * The pinned shortlist at the top of the kitchen panel. Ids that are not in
 * either registry are dropped rather than rendered as dead chips - the
 * validator is where a typo gets reported, not the UI.
 */
export const favouriteIds: string[] = favouritesData.items.filter(
  (id) => ingredientById.has(id) || equipmentById.has(id),
)

/**
 * How much you want to cook each recipe, from data/standing.json. Anything not
 * named in either list is 'normal', which is the useful default - the file only
 * has to hold the two ends, not all 23 recipes.
 *
 * Ids that match no recipe are dropped rather than kept in the map, so a typo
 * cannot quietly demote nothing at all. The validator is where it gets reported.
 */
const recipeIds = new Set(recipes.map((r) => r.id))
const standingById = new Map<string, Standing>()
for (const id of standingData.pinned) {
  if (recipeIds.has(id)) standingById.set(id, 'pinned')
}
for (const id of standingData.rare) {
  // Listed in both is a contradiction; rare wins, because the whole point of
  // marking something rare is to stop seeing it.
  if (recipeIds.has(id)) standingById.set(id, 'rare')
}

export function standingOf(recipeId: string): Standing {
  return standingById.get(recipeId) ?? 'normal'
}

export const stapleIngredients = ingredients.filter((i) => i.staple).map((i) => i.id)
export const stapleEquipment = equipment.filter((e) => e.staple).map((e) => e.id)

/** Which groups each ingredient belongs to, for swap lookups. */
export const groupsByIngredient = new Map<string, SubGroup[]>()
for (const group of subGroups) {
  for (const member of group.members) {
    const list = groupsByIngredient.get(member.ingredient) ?? []
    list.push(group)
    groupsByIngredient.set(member.ingredient, list)
  }
}

export const rulesByIngredient = new Map<string, SubRule[]>()
for (const rule of subRules) {
  const list = rulesByIngredient.get(rule.from) ?? []
  list.push(rule)
  rulesByIngredient.set(rule.from, list)
}

export const defaultPreferences: Preferences = {
  avoid: preferencesData.avoid.ingredients,
  preferNot: preferencesData.prefer_not.ingredients,
  prefer: Object.fromEntries(
    Object.entries(preferencesData.prefer).filter(([k]) => !k.startsWith('_')),
  ) as Record<string, string[]>,
  diet: Object.fromEntries(
    Object.entries(preferencesData.diet).filter(([k]) => !k.startsWith('_')),
  ) as Record<string, boolean>,
}

/**
 * Display name for an id. Recipes are allowed to reference ingredients that are
 * not in the registry yet, so fall back to a readable version of the id rather
 * than showing a raw slug.
 */
export function nameOf(id: string): string {
  const known = ingredientById.get(id) ?? equipmentById.get(id)
  if (known) return known.name
  return id.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
}

export const allTags = Array.from(new Set(recipes.flatMap((r) => r.tags))).sort()
export const allMeals = Array.from(new Set(recipes.flatMap((r) => r.meal))).sort()

/**
 * Compose the display text for an ingredient line.
 *
 * Recipes get written by hand and by transcription, so quantities often already
 * name the thing ("1 tbsp rice vinegar", "1 tsp kasuri methi"). Appending the
 * canonical name to those gives you "1 tbsp rice vinegar vinegar", so only add
 * it when the quantity does not already say it.
 */
export function ingredientLineText(qty: string, id: string): string {
  const meta = ingredientById.get(id)
  const name = nameOf(id)
  const haystack = qty.toLowerCase()
  const mentions = [name, ...(meta?.aliases ?? [])].some(
    (n) => n.length > 3 && haystack.includes(n.toLowerCase()),
  )
  return mentions ? qty : `${qty} ${name.toLowerCase()}`
}
