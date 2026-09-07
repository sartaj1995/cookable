# Data format

Four data files and a folder of recipes. Everything is plain JSON so it diffs
cleanly in git and can be edited by hand or by Claude Code.

Keys beginning with `_` (like `_comment`) are notes for humans and are ignored.

---

## `recipes/*.json`

One file per recipe, named `<id>.json`. Vite picks up every file in the folder at
build time, so adding a file is all it takes — there is no index.

```jsonc
{
  "id": "besan-chilla",              // must match the filename
  "title": "Loaded besan chilla",
  "summary": "One or two sentences on why you'd cook this.",
  "cuisine": "Indian",
  "meal": ["breakfast", "lunch"],    // free-form
  "servings": 2,
  "time": { "prep": 5, "cook": 10, "total": 15, "note": "optional" },
  "difficulty": "easy",              // easy | medium | hard
  "tags": ["high-protein", "vegetarian", "gluten-free"],

  "nutrition_per_serving": {
    "calories": 290, "protein_g": 17, "carbs_g": 34,
    "fat_g": 9, "fibre_g": 7, "added_sugar_g": 0,
    "estimated": true                // true unless it came off a label
  },

  "equipment": {
    "required": ["pan", "stovetop"], // ids from data/equipment.json
    "optional": []
  },

  "ingredients": [ /* see below */ ],
  "steps": ["...", "..."],           // ordered, one action each
  "tips": ["..."],                   // optional
  "health_notes": "...",             // optional

  "source": {
    "type": "youtube",               // youtube | traditional | web | book | own
    "url": "https://...",
    "channel": "...",
    "title": "...",
    "captured": "2026-09-07",
    "adapted": "What was changed from the original, and why."
  }
}
```

### Ingredient lines

```jsonc
{
  "id": "besan",                  // must exist in data/ingredients.json
  "qty": "1 cup (110 g)",         // free text, as a person would write it
  "note": "optional line note",
  "core": true,                   // recipe fails without it
  "optional": true,               // garnish / nice-to-have
  "function": "structure",        // what it is doing here
  "sub_group": "none"             // "none" = never swap; or a group id to restrict
}
```

**`qty` may repeat the ingredient name.** `"1 tbsp rice vinegar"` on the
`vinegar` line is fine — the app detects the repetition and does not print
"rice vinegar vinegar". Write quantities the way they sound.

### The flags, and what they do to matching

| Flag | Missing from your kitchen | Can it be swapped? |
| --- | --- | --- |
| `core: true` | Recipe is **blocked** | Only a like-for-like swap |
| `sub_group: "none"` | Recipe is blocked if also `core` | **Never**, not even a good one |
| `optional: true` | Silently skipped | Never — it just gets dropped |
| *(neither)* | Recipe drops a rank | Yes, including imperfect swaps with a warning |

`sub_group: "none"` is the identity flag: the dish *is* this ingredient. Paneer
in paneer bhurji, besan in besan chilla, dates in date balls. Without it the
engine will offer a technically-valid swap that produces a different dish.

### `function`

What the ingredient is doing, so the engine can judge whether a stand-in is a
clean swap or one that needs a warning. Honey as `"sweetness"` can become stevia;
honey as `"binding"` cannot, not without adding something sticky back.

Words the swap table understands: `sweetness`, `binding`, `bulk`, `browning`,
`moisture`, `fat`, `flavour`, `high_heat`, `acid`, `freshness`, `protein`,
`lean`, `creaminess`, `richness`, `thickness`, `liquid`, `salt`, `umami`,
`crunch`, `texture`, `aromatic`, `heat`, `colour`, `structure`, `base`, `carbs`,
`fibre`, `greens`, `melt`, `omega3`, `depth`, `concentration`, `heat_stable`.

Any other word is allowed but carries no information — the engine falls back to
trusting the group. `npm run validate` lists off-vocabulary words it finds.

---

## `data/ingredients.json`

```jsonc
{
  "id": "greek_yogurt",
  "name": "Greek yogurt",       // shown in the app
  "category": "dairy",          // produce | protein | dairy | grain | legume |
                                // nut_seed | fat | sweetener | spice | herb |
                                // condiment | liquid | seasoning | pantry
  "staple": true,               // assumed present under "I have the basics"
  "aliases": ["hung curd", "dahi", "thick yogurt"]
}
```

Aliases are how typed text becomes an id. Include the Hindi name, the plural, and
the supermarket name. The resolver also strips leading quantities, so
`"2 large onions"` finds `onion` on its own.

An alias claimed by two ingredients is a bug — the first one wins and the second
becomes unreachable. `npm run validate` warns about this.

---

## `data/substitutions.json`

### Groups — symmetric, any member for any other

```jsonc
{
  "id": "sweeteners",
  "name": "Sweeteners",
  "reference": "1 tbsp honey",      // what every `amount` is quoted against
  "note": "Shown as context in the app.",
  "members": [
    { "ingredient": "honey", "amount": "1 tbsp",
      "provides": ["sweetness", "bulk", "binding", "browning"] },

    { "ingredient": "stevia",
      "amount": "6-8 drops liquid, or a scant 1/4 tsp powder",
      "provides": ["sweetness"],
      "lacks": ["bulk", "binding", "browning", "moisture"],
      "compensate": "Add ~1 tbsp of the recipe's own liquid per tbsp of syrup...",
      "notes": "Brands vary a lot in strength." }
  ]
}
```

- **`provides`** — what this member does. Matched against the recipe line's
  `function`.
- **`lacks`** — what it does not do. If the recipe needed one of these, the swap
  is flagged rather than clean.
- **`compensate`** — how to make up the difference. **Required whenever `lacks`
  is set**: the engine never offers a flagged swap it cannot explain, so a
  `lacks` without a `compensate` silently removes that member from consideration.
- **`notes`** — taste and handling, always shown.

### Rules — one direction only

```jsonc
{
  "id": "mayo_swap",
  "from": "mayo",
  "to": [
    { "ingredient": "greek_yogurt",
      "amount": "1:1 + 1/2 tsp mustard and a squeeze of lemon",
      "notes": "Saves ~80 cal a tablespoon and adds protein.",
      "flagged": true }      // optional: a compromise, never used for `core` lines
  ],
  "note": "Optional context."
}
```

---

## `data/equipment.json`

```jsonc
"equipment": [
  { "id": "air_fryer", "name": "Air fryer", "aliases": ["airfryer"] },
  { "id": "pan", "name": "Frying pan", "staple": true, "aliases": ["kadai", "tawa"] }
],
"alternates": [
  { "from": "oven", "to": "air_fryer",
    "note": "Drop the temperature by about 20C and check 20-25% earlier.",
    "flagged": true }        // optional: a poor substitute, shown as such
]
```

`from` is what the recipe asks for, `to` is what you have instead. The `note` is
the adjustment, and it is shown verbatim in the app — make it specific enough to
cook from.

---

## `data/preferences.json`

```jsonc
{
  "avoid":      { "ingredients": [] },          // hard no; blocks recipes
  "prefer_not": { "ingredients": ["sugar", "honey"] },  // swap out when possible
  "prefer": {                                    // ranked, by group id
    "sweeteners": ["monk_fruit", "stevia", "erythritol", "dates"]
  },
  "diet": { "vegetarian": false, "vegan": false, "eggless": false,
            "gluten_free": false, "dairy_free": false },
  "targets": { "min_protein_per_serving_g": 20 }
}
```

`avoid` blocks. `prefer_not` never blocks — it just swaps when the table offers a
way, and the app labels it "your swap". Diet flags work by adding to `avoid`
at match time, so setting *vegetarian* makes the engine try to swap the chicken
for paneer before it gives up on a recipe.

**This file is the only place preferences are set.** The app has no preference
controls — it reads these values on load and never writes them back. Only the
kitchen itself (what you have, and the basics switch) is remembered in the
browser.
