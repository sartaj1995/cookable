import { ingredients } from './db'

/**
 * Diet filters work by adding to your avoid list rather than by trusting recipe
 * tags. Turning on "vegetarian" makes the engine try to swap the chicken for
 * paneer - and only hides the recipe if there is genuinely no way around it.
 */

export const MEAT_AND_FISH = [
  'chicken_breast',
  'chicken_thigh',
  'chicken_mince',
  'mutton',
  'salmon',
  'white_fish',
  'prawns',
  'tuna_canned',
]

export const EGGS = ['eggs', 'egg_whites']

export const DAIRY = ingredients
  .filter((i) => i.category === 'dairy')
  .map((i) => i.id)
  .concat(['ghee', 'paneer', 'whey_protein'])

export const GLUTEN = [
  'whole_wheat_flour',
  'bread',
  'pasta',
  'suji',
  'couscous',
  'tortilla',
  'soy_sauce',
]

export const ANIMAL = [...MEAT_AND_FISH, ...EGGS, ...DAIRY, 'honey']

export const DIET_RULES: Record<string, string[]> = {
  vegetarian: MEAT_AND_FISH,
  vegan: ANIMAL,
  eggless: EGGS,
  dairy_free: DAIRY,
  gluten_free: GLUTEN,
}

export const DIET_LABELS: Record<string, string> = {
  vegetarian: 'Vegetarian',
  vegan: 'Vegan',
  eggless: 'Eggless',
  dairy_free: 'Dairy-free',
  gluten_free: 'Gluten-free',
}

export function avoidsFromDiet(diet: Record<string, boolean>): string[] {
  const out = new Set<string>()
  for (const [key, on] of Object.entries(diet)) {
    if (!on) continue
    for (const id of DIET_RULES[key] ?? []) out.add(id)
  }
  return [...out]
}
