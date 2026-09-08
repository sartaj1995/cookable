#!/usr/bin/env node
/**
 * Checks the data files for anything that would quietly break matching:
 * unknown ingredient ids, missing devices, duplicate recipes, bad shapes.
 *
 *   npm run validate
 *
 * Run this after adding a recipe. An unknown ingredient id is the failure mode
 * that matters - the recipe still renders, but the app can never mark it
 * cookable, because nothing in your kitchen will ever match that id.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'))

const errors = []
const warnings = []
const err = (file, msg) => errors.push(`${file}: ${msg}`)
const warn = (file, msg) => warnings.push(`${file}: ${msg}`)

const ingredientsFile = read('data/ingredients.json')
const equipmentFile = read('data/equipment.json')
const substitutions = read('data/substitutions.json')
const preferences = read('data/preferences.json')
const favourites = read('data/favourites.json')
const standing = read('data/standing.json')

const ingredientIds = new Set(ingredientsFile.ingredients.map((i) => i.id))
const equipmentIds = new Set(equipmentFile.equipment.map((e) => e.id))

/* ---------- registries ---------- */

const seenIngredient = new Set()
for (const item of ingredientsFile.ingredients) {
  if (seenIngredient.has(item.id)) err('data/ingredients.json', `duplicate id "${item.id}"`)
  seenIngredient.add(item.id)
  if (!item.name) err('data/ingredients.json', `"${item.id}" has no name`)
  if (!Array.isArray(item.aliases)) err('data/ingredients.json', `"${item.id}" aliases must be an array`)
}

// An alias pointing at two different ingredients means one of them is unreachable.
const aliasOwner = new Map()
for (const item of ingredientsFile.ingredients) {
  for (const alias of item.aliases ?? []) {
    const key = alias.toLowerCase().trim()
    if (aliasOwner.has(key) && aliasOwner.get(key) !== item.id) {
      warn(
        'data/ingredients.json',
        `alias "${alias}" is claimed by both "${aliasOwner.get(key)}" and "${item.id}" - the first one wins`,
      )
    }
    aliasOwner.set(key, item.id)
  }
}

for (const group of substitutions.groups) {
  for (const member of group.members) {
    if (!ingredientIds.has(member.ingredient)) {
      err('data/substitutions.json', `group "${group.id}" references unknown ingredient "${member.ingredient}"`)
    }
    if (!member.amount) {
      warn('data/substitutions.json', `group "${group.id}" member "${member.ingredient}" has no amount`)
    }
  }
  if (group.members.length < 2) {
    warn('data/substitutions.json', `group "${group.id}" has fewer than 2 members, so it can never swap anything`)
  }
}

for (const rule of substitutions.rules) {
  for (const target of rule.to) {
    if (!ingredientIds.has(target.ingredient)) {
      err('data/substitutions.json', `rule "${rule.id}" points at unknown ingredient "${target.ingredient}"`)
    }
  }
}

for (const [key, list] of Object.entries(preferences.prefer)) {
  if (key.startsWith('_')) continue
  const group = substitutions.groups.find((g) => g.id === key)
  if (!group) {
    err('data/preferences.json', `prefer."${key}" is not a group id in substitutions.json`)
    continue
  }
  for (const id of list) {
    if (!group.members.some((m) => m.ingredient === id)) {
      warn('data/preferences.json', `prefer."${key}" lists "${id}", which is not in that group`)
    }
  }
}

for (const list of [preferences.avoid.ingredients, preferences.prefer_not.ingredients]) {
  for (const id of list) {
    if (!ingredientIds.has(id)) err('data/preferences.json', `unknown ingredient "${id}"`)
  }
}

/* ---------- favourites ---------- */

// A favourite that does not exist renders as nothing at all: the pinned row just
// silently comes up short, with no clue which id was wrong.
const stapleIds = new Set([
  ...ingredientsFile.ingredients.filter((i) => i.staple).map((i) => i.id),
  ...equipmentFile.equipment.filter((e) => e.staple).map((e) => e.id),
])
const seenFavourite = new Set()
for (const id of favourites.items) {
  if (!ingredientIds.has(id) && !equipmentIds.has(id)) {
    err('data/favourites.json', `unknown id "${id}"`)
  }
  if (seenFavourite.has(id)) warn('data/favourites.json', `"${id}" is listed twice`)
  seenFavourite.add(id)
  if (stapleIds.has(id)) {
    warn('data/favourites.json', `"${id}" is a staple - the basics switch already covers it`)
  }
}

/* ---------- standing ---------- */

// A standing id that matches no recipe does nothing at all - it does not demote
// anything, and there is no way to tell from the app that it missed.
const recipeIdsSeen = new Set(
  readdirSync(join(root, 'recipes'))
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, '')),
)
const pinned = new Set(standing.pinned)
for (const [list, ids] of [
  ['pinned', standing.pinned],
  ['rare', standing.rare],
]) {
  const seen = new Set()
  for (const id of ids) {
    if (!recipeIdsSeen.has(id)) {
      err('data/standing.json', `${list} lists "${id}", which is not a recipe`)
    }
    if (seen.has(id)) {
      warn('data/standing.json', `${list} lists "${id}" twice`)
      continue
    }
    seen.add(id)
    if (list === 'rare' && pinned.has(id)) {
      warn(
        'data/standing.json',
        `"${id}" is in both pinned and rare - rare wins, but one of them is wrong`,
      )
    }
  }
}

for (const alt of equipmentFile.alternates) {
  for (const id of [alt.from, alt.to]) {
    if (!equipmentIds.has(id)) err('data/equipment.json', `alternate references unknown device "${id}"`)
  }
}

/* ---------- recipes ---------- */

// Every function word the swap table knows how to reason about. A recipe can
// use others, but the engine cannot judge a swap against them.
const knownFunctions = new Set()
for (const group of substitutions.groups) {
  for (const member of group.members) {
    for (const f of member.provides ?? []) knownFunctions.add(f)
    for (const f of member.lacks ?? []) knownFunctions.add(f)
  }
}

const files = readdirSync(join(root, 'recipes')).filter((f) => f.endsWith('.json'))
const recipeIds = new Set()
const offVocabulary = new Map()
let unknownIngredientUses = 0

for (const file of files) {
  const path = `recipes/${file}`
  let recipe
  try {
    recipe = read(path)
  } catch (e) {
    err(path, `is not valid JSON - ${e.message}`)
    continue
  }

  for (const field of ['id', 'title', 'summary', 'servings', 'time', 'equipment', 'ingredients', 'steps']) {
    if (recipe[field] === undefined) err(path, `missing required field "${field}"`)
  }
  if (recipe.id && recipeIds.has(recipe.id)) err(path, `duplicate recipe id "${recipe.id}"`)
  recipeIds.add(recipe.id)
  if (recipe.id && `${recipe.id}.json` !== file) {
    warn(path, `id "${recipe.id}" does not match the filename`)
  }

  if (recipe.time && typeof recipe.time.total !== 'number') err(path, 'time.total must be a number')
  if (recipe.servings !== undefined && !(recipe.servings > 0)) err(path, 'servings must be greater than 0')
  if (Array.isArray(recipe.steps) && recipe.steps.length === 0) err(path, 'has no steps')

  for (const line of recipe.ingredients ?? []) {
    if (!line.id) {
      err(path, 'an ingredient line has no id')
      continue
    }
    if (!ingredientIds.has(line.id)) {
      unknownIngredientUses++
      err(path, `unknown ingredient "${line.id}" - add it to data/ingredients.json`)
    }
    if (!line.qty) warn(path, `ingredient "${line.id}" has no qty`)
    if (line.function && !knownFunctions.has(line.function) && !line.optional) {
      const seen = offVocabulary.get(line.function) ?? []
      seen.push(`${file}:${line.id}`)
      offVocabulary.set(line.function, seen)
    }
    if (line.core && line.optional) warn(path, `ingredient "${line.id}" is marked both core and optional`)
    if (line.sub_group && line.sub_group !== 'none') {
      if (!substitutions.groups.some((g) => g.id === line.sub_group)) {
        err(path, `ingredient "${line.id}" points at unknown sub_group "${line.sub_group}"`)
      }
    }
  }

  const devices = [...(recipe.equipment?.required ?? []), ...(recipe.equipment?.optional ?? [])]
  for (const id of devices) {
    if (!equipmentIds.has(id)) err(path, `unknown device "${id}" - add it to data/equipment.json`)
  }

  // A recipe whose every ingredient is core can essentially never be matched
  // with substitutions, which is usually a mistake rather than a decision.
  const core = (recipe.ingredients ?? []).filter((i) => i.core).length
  if (recipe.ingredients?.length > 4 && core === recipe.ingredients.length) {
    warn(path, 'every ingredient is marked core - the swap table will never be able to help')
  }
  if (!recipe.nutrition_per_serving) warn(path, 'no nutrition_per_serving block')
  if (!recipe.source) warn(path, 'no source block - where did this come from?')
}

/* ---------- report ---------- */

const green = (s) => `\x1b[32m${s}\x1b[0m`
const red = (s) => `\x1b[31m${s}\x1b[0m`
const yellow = (s) => `\x1b[33m${s}\x1b[0m`
const dim = (s) => `\x1b[2m${s}\x1b[0m`

console.log(
  dim(
    `\n${files.length} recipes · ${ingredientIds.size} ingredients · ${equipmentIds.size} devices · ` +
      `${substitutions.groups.length} swap groups · ${substitutions.rules.length} swap rules\n`,
  ),
)

if (offVocabulary.size) {
  console.log(
    yellow(`${offVocabulary.size} function word(s) the swap table does not know`),
  )
  for (const [fn, uses] of offVocabulary) {
    console.log(`  "${fn}" - used by ${uses.slice(0, 3).join(', ')}${uses.length > 3 ? ` +${uses.length - 3}` : ''}`)
  }
  console.log(
    dim(
      '  Swaps for these lines are judged on the group alone. Either reuse a word from ' +
        'substitutions.json (sweetness, binding, bulk, fat, acid, protein, creaminess) ' +
        'or add it to the relevant members provides list.',
    ),
  )
  console.log()
}

if (warnings.length) {
  console.log(yellow(`${warnings.length} warning${warnings.length === 1 ? '' : 's'}`))
  for (const w of warnings) console.log(`  ${w}`)
  console.log()
}

if (errors.length) {
  console.log(red(`${errors.length} error${errors.length === 1 ? '' : 's'}`))
  for (const e of errors) console.log(`  ${e}`)
  if (unknownIngredientUses) {
    console.log(
      dim(
        `\n  ${unknownIngredientUses} recipe line(s) reference an ingredient that does not exist.` +
          `\n  Those recipes will never match your kitchen until you add the ids to data/ingredients.json.`,
      ),
    )
  }
  console.log()
  process.exit(1)
}

console.log(green('All good.\n'))
