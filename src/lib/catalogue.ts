import { equipment, ingredients } from './db'

/**
 * The browsable picker in the kitchen panel: what you can tap instead of typing.
 * Built from the registries, so anything added to data/ingredients.json shows up
 * on its own.
 */

export interface PickerOption {
  id: string
  label: string
}

export interface PickerGroup {
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
  { label: 'Proteins', options: byCategory('protein') },
  { label: 'Dairy', options: byCategory('dairy') },
  { label: 'Vegetables & fruit', options: byCategory('produce') },
  { label: 'Grains & flours', options: byCategory('grain') },
  { label: 'Dals, beans & pulses', options: byCategory('legume') },
  { label: 'Nuts & seeds', options: byCategory('nut_seed') },
  { label: 'Fats & oils', options: byCategory('fat') },
  { label: 'Sauces & condiments', options: byCategory('condiment') },
]

const SPICE_GROUPS: PickerGroup[] = [
  { label: 'Spices', options: byCategory('spice') },
  { label: 'Fresh herbs', options: byCategory('herb') },
]

const SWEETENER_GROUPS: PickerGroup[] = [{ options: byCategory('sweetener') }]

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

export const pickerSections: PickerSection[] = [
  {
    id: 'equipment',
    label: 'Equipment',
    kind: 'equipment',
    groups: [
      {
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
      ...(leftovers.length ? [{ label: 'Everything else', options: leftovers }] : []),
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
