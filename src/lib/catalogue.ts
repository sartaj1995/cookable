import { equipment, equipmentById, favouriteIds, ingredientById, ingredients } from './db'

/**
 * The browsable picker in the kitchen panel: what you can tap instead of typing.
 * Built from the registries, so anything added to data/ingredients.json shows up
 * on its own.
 */

export interface PickerOption {
  id: string
  label: string
  /** Overrides the section's kind, for a section that mixes food and devices. */
  kind?: 'ingredient' | 'equipment'
}

export interface PickerGroup {
  /** Stable key for the open/closed state, so it survives a re-render. */
  id: string
  /** A labelled group can be folded away. An unlabelled one is always shown. */
  label?: string
  options: PickerOption[]
}

export interface PickerSection {
  id: string
  label: string
  kind: 'ingredient' | 'equipment'
  groups: PickerGroup[]
}

/** Staples are covered by the "I have the basics" switch, so they are not listed. */
const pickable = ingredients.filter((i) => !i.staple)

const byCategory = (...categories: string[]): PickerOption[] =>
  categories
    .flatMap((c) => pickable.filter((i) => i.category === c))
    .map((i) => ({ id: i.id, label: i.name }))

const KEY_GROUPS: PickerGroup[] = [
  { id: 'protein', label: 'Proteins', options: byCategory('protein') },
  { id: 'dairy', label: 'Dairy', options: byCategory('dairy') },
  { id: 'produce', label: 'Vegetables & fruit', options: byCategory('produce') },
  { id: 'grain', label: 'Grains & flours', options: byCategory('grain') },
  { id: 'legume', label: 'Dals, beans & pulses', options: byCategory('legume') },
  { id: 'nut_seed', label: 'Nuts & seeds', options: byCategory('nut_seed') },
  { id: 'fat', label: 'Fats & oils', options: byCategory('fat') },
  { id: 'condiment', label: 'Sauces & condiments', options: byCategory('condiment') },
  // Coffee, dark chocolate and rice paper used to fall through to "Everything
  // else" - the bottom of the longest list - because nothing claimed the pantry
  // and liquid categories.
  { id: 'pantry', label: 'Pantry & drinks', options: byCategory('pantry', 'liquid') },
]

const SPICE_GROUPS: PickerGroup[] = [
  { id: 'spice', label: 'Spices', options: byCategory('spice') },
  { id: 'herb', label: 'Fresh herbs', options: byCategory('herb') },
]

const SWEETENER_GROUPS: PickerGroup[] = [
  { id: 'sweetener', options: byCategory('sweetener') },
]

// Anything not explicitly placed above still needs somewhere to live, or a newly
// added ingredient would only be reachable by typing its name.
const placed = new Set(
  [...KEY_GROUPS, ...SPICE_GROUPS, ...SWEETENER_GROUPS].flatMap((g) =>
    g.options.map((o) => o.id),
  ),
)
const leftovers = pickable
  .filter((i) => !placed.has(i.id))
  .map((i) => ({ id: i.id, label: i.name }))

/**
 * The shortlist, pinned above everything else.
 *
 * These are shortcuts rather than a move: each one still appears in its real
 * category below, and because selection is keyed by id, ticking it in either
 * place shows it ticked in both.
 */
const favouriteOptions: PickerOption[] = favouriteIds.map((id) => {
  const food = ingredientById.get(id)
  return food
    ? { id, label: food.name, kind: 'ingredient' as const }
    : { id, label: equipmentById.get(id)!.name, kind: 'equipment' as const }
})

export const pickerSections: PickerSection[] = [
  ...(favouriteOptions.length
    ? [
        {
          id: 'favourites',
          label: 'Favourites',
          kind: 'ingredient' as const,
          groups: [{ id: 'favourites', options: favouriteOptions }],
        },
      ]
    : []),
  {
    id: 'equipment',
    label: 'Equipment',
    kind: 'equipment',
    groups: [
      {
        id: 'equipment',
        options: equipment
          .filter((e) => !e.staple)
          .map((e) => ({ id: e.id, label: e.name })),
      },
    ],
  },
  {
    id: 'key',
    label: 'Key ingredients',
    kind: 'ingredient',
    groups: [
      ...KEY_GROUPS,
      ...(leftovers.length
        ? [{ id: 'other', label: 'Everything else', options: leftovers }]
        : []),
    ].filter((g) => g.options.length > 0),
  },
  {
    id: 'spices',
    label: 'Spices & herbs',
    kind: 'ingredient',
    groups: SPICE_GROUPS.filter((g) => g.options.length > 0),
  },
  {
    id: 'sweeteners',
    label: 'Sweeteners',
    kind: 'ingredient',
    groups: SWEETENER_GROUPS.filter((g) => g.options.length > 0),
  },
]

export const sectionTotals = Object.fromEntries(
  pickerSections.map((s) => [s.id, s.groups.reduce((n, g) => n + g.options.length, 0)]),
) as Record<string, number>
