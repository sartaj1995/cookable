import { equipment, ingredients } from './db'

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Cheap singularisation - enough for a kitchen, not a linguistics paper. */
function variants(term: string): string[] {
  const out = [term]
  if (term.endsWith('ies')) out.push(term.slice(0, -3) + 'y')
  if (term.endsWith('es')) out.push(term.slice(0, -2))
  if (term.endsWith('s')) out.push(term.slice(0, -1))
  return out
}

export type ResolvedKind = 'ingredient' | 'equipment' | 'unknown'

export interface Resolved {
  kind: ResolvedKind
  id: string
  label: string
  input: string
}

const aliasIndex = new Map<string, { kind: ResolvedKind; id: string; label: string }>()

for (const item of ingredients) {
  const entry = { kind: 'ingredient' as const, id: item.id, label: item.name }
  for (const key of [item.id.replace(/_/g, ' '), item.name, ...item.aliases]) {
    for (const v of variants(normalize(key))) {
      if (!aliasIndex.has(v)) aliasIndex.set(v, entry)
    }
  }
}

for (const item of equipment) {
  const entry = { kind: 'equipment' as const, id: item.id, label: item.name }
  for (const key of [item.id.replace(/_/g, ' '), item.name, ...item.aliases]) {
    for (const v of variants(normalize(key))) {
      // Equipment wins ties: "pan" should be a device, not food.
      aliasIndex.set(v, entry)
    }
  }
}

/** Map one typed phrase to a known ingredient or device. */
export function resolve(input: string): Resolved {
  const cleaned = normalize(input)
  if (!cleaned) return { kind: 'unknown', id: '', label: '', input }

  for (const v of variants(cleaned)) {
    const hit = aliasIndex.get(v)
    if (hit) return { ...hit, input }
  }

  // "2 large onions" / "some fresh spinach" - drop leading quantities and fillers.
  const stripped = cleaned
    .replace(/^\d+(\s*\/\s*\d+)?\s*/, '')
    .replace(
      /^(kg|g|gram|grams|ml|l|litre|liter|cup|cups|tbsp|tsp|packet|packets|pack|bunch|can|tin|large|small|medium|fresh|frozen|dried|some|a|an|the)\s+/g,
      '',
    )
    .trim()
  if (stripped && stripped !== cleaned) {
    for (const v of variants(stripped)) {
      const hit = aliasIndex.get(v)
      if (hit) return { ...hit, input }
    }
  }

  return { kind: 'unknown', id: cleaned, label: input.trim(), input }
}

/** Split a pasted line - "chicken, spinach and oats" - into separate terms. */
export function splitEntry(text: string): string[] {
  return text
    .split(/[,\n;+]|\band\b|\bplus\b/gi)
    .map((s) => s.trim())
    .filter(Boolean)
}

export interface Suggestion {
  kind: 'ingredient' | 'equipment'
  id: string
  label: string
  detail: string
}

const searchable: Suggestion[] = [
  ...ingredients.map((i) => ({
    kind: 'ingredient' as const,
    id: i.id,
    label: i.name,
    detail: i.category,
  })),
  ...equipment.map((e) => ({
    kind: 'equipment' as const,
    id: e.id,
    label: e.name,
    detail: 'device',
  })),
]

const haystack = new Map<string, string>()
for (const item of [...ingredients, ...equipment]) {
  haystack.set(
    item.id,
    normalize([item.name, item.id.replace(/_/g, ' '), ...item.aliases].join(' ')),
  )
}

export function suggest(query: string, exclude: Set<string>, limit = 8): Suggestion[] {
  const q = normalize(query)
  if (!q) return []
  const scored: Array<{ item: Suggestion; score: number }> = []

  for (const item of searchable) {
    if (exclude.has(item.id)) continue
    const hay = haystack.get(item.id) ?? ''
    const label = normalize(item.label)

    let score = 0
    if (label === q) score = 100
    else if (label.startsWith(q)) score = 80
    else if (hay.split(' ').some((w) => w === q)) score = 70
    else if (hay.split(' ').some((w) => w.startsWith(q))) score = 55
    else if (hay.includes(q)) score = 30
    else continue

    // Shorter names are usually the more common ingredient.
    score -= Math.min(label.length, 20) * 0.2
    scored.push({ item, score })
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.item)
}
