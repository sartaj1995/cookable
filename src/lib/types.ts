export type IngredientId = string
export type EquipmentId = string

export interface Ingredient {
  id: IngredientId
  name: string
  category: string
  aliases: string[]
  staple?: boolean
}

export interface Equipment {
  id: EquipmentId
  name: string
  aliases: string[]
  staple?: boolean
}

export interface EquipmentAlternate {
  from: EquipmentId
  to: EquipmentId
  note: string
  flagged?: boolean
}

/** One member of an interchangeable group in substitutions.json. */
export interface SubMember {
  ingredient: IngredientId
  amount: string
  provides?: string[]
  lacks?: string[]
  /** What to do about whatever this member `lacks`. */
  compensate?: string
  notes?: string
}

export interface SubGroup {
  id: string
  name: string
  reference: string
  note?: string
  members: SubMember[]
}

export interface SubRuleTarget {
  ingredient: IngredientId
  amount: string
  notes?: string
  flagged?: boolean
}

export interface SubRule {
  id: string
  from: IngredientId
  to: SubRuleTarget[]
  note?: string
}

export interface RecipeIngredient {
  id: IngredientId
  qty: string
  note?: string
  /** The recipe is not itself without this. Missing + unsubstitutable = blocked. */
  core?: boolean
  /** Nice to have. Missing costs nothing. */
  optional?: boolean
  /** What this ingredient is doing here, checked against a stand-in's `provides`. */
  function?: string
  /** Restrict swaps to one group id, or "none" to forbid swapping entirely. */
  sub_group?: string
}

export interface Recipe {
  id: string
  title: string
  summary: string
  cuisine: string
  meal: string[]
  servings: number
  time: { prep: number; cook: number; total: number; note?: string }
  difficulty: 'easy' | 'medium' | 'hard'
  tags: string[]
  nutrition_per_serving?: {
    calories?: number
    protein_g?: number
    carbs_g?: number
    fat_g?: number
    fibre_g?: number
    added_sugar_g?: number
    estimated?: boolean
    note?: string
  }
  equipment: { required: EquipmentId[]; optional?: EquipmentId[] }
  ingredients: RecipeIngredient[]
  steps: string[]
  tips?: string[]
  health_notes?: string
  source?: {
    type: 'youtube' | 'traditional' | 'web' | 'book' | 'own'
    url?: string
    channel?: string
    title?: string
    captured?: string
    adapted?: string
  }
}

export interface Preferences {
  avoid: IngredientId[]
  preferNot: IngredientId[]
  prefer: Record<string, IngredientId[]>
  diet: Record<string, boolean>
}

/* ---------- match results ---------- */

export type LineStatus =
  | 'have'        // in your kitchen
  | 'substitute'  // swapped for something you have
  | 'skip'        // optional and missing, no harm done
  | 'missing'     // needed, not there, no swap available

export interface SubstitutionResult {
  use: IngredientId
  useName: string
  amount: string
  /** Provides everything the recipe needed it for. */
  clean: boolean
  reason: 'missing' | 'avoid' | 'prefer_not'
  groupName?: string
  /** The unit the `amount` is quoted against, e.g. "1 tbsp honey". */
  reference?: string
  notes?: string
  compensate?: string
}

export interface MatchedLine {
  ingredient: RecipeIngredient
  name: string
  status: LineStatus
  substitution?: SubstitutionResult
  /** Set when a hard-avoided ingredient has no way out. */
  blockedByAvoid?: boolean
}

export interface EquipmentCheck {
  need: EquipmentId
  needName: string
  have: boolean
  useInstead?: { id: EquipmentId; name: string; note: string; flagged?: boolean }
}

export type Verdict = 'ready' | 'almost' | 'stretch' | 'blocked'

/**
 * How much you want to cook this, from data/standing.json. Independent of
 * whether you *can* - a rare recipe with every ingredient in the kitchen is
 * still ready, it just sorts below the others and stays out of the dice roll.
 */
export type Standing = 'pinned' | 'normal' | 'rare'

export interface RecipeMatch {
  recipe: Recipe
  verdict: Verdict
  lines: MatchedLine[]
  equipment: EquipmentCheck[]
  missing: MatchedLine[]
  substitutions: MatchedLine[]
  /** Why it cannot be made at all. */
  blockers: string[]
  standing: Standing
  score: number
  haveRatio: number
}
