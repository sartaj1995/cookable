# Cookable — working notes for Claude Code

This repo is a recipe database plus a small web app that matches recipes against
whatever is in the kitchen. **The database is edited here, by you, not in the app.**
The app is read-only — Sartaj adds recipes by asking you.

## Where things live

| File | What it is |
| --- | --- |
| `recipes/*.json` | One file per recipe. Drop a new file in and the app picks it up — no index to update. |
| `data/ingredients.json` | Canonical ingredient ids + the aliases people actually type. |
| `data/substitutions.json` | The swap table: interchangeable groups + one-way rules. |
| `data/equipment.json` | Devices, and what you can use when you do not have one. |
| `data/preferences.json` | Standing preferences — avoid list, swap-out list, diet flags. **The app has no UI for these**, so this file is the only way to change them. |
| `src/lib/match.ts` | The matching engine. Read this before changing swap semantics. |
| `src/lib/catalogue.ts` | Builds the browsable pick-lists in the kitchen panel from the registries. Ingredients land in a section by `category`; anything with an unrecognised category falls into "Everything else" rather than disappearing. |
| `SCHEMA.md` | Full field reference for every file above. |

## After ANY data change

```bash
npm run validate
```

It catches the failure that actually matters: a recipe referencing an ingredient
id that does not exist. That recipe will render fine and can *never* be matched,
because nothing in the kitchen will ever equal that id. The validator exits
non-zero on real errors.

## Adding a recipe from a video

Use `/add-recipe`. The short version of what that command does:

1. **Get the content.** A pasted transcript is the most reliable input. For a
   bare URL, try `WebFetch` first — it usually gets title, channel and
   description, and many creators put the full recipe in the description. If
   that fails, ask for the transcript rather than guessing at quantities.
2. **Extract, do not invent.** Quantities that were actually said go in as
   stated. Where the video is vague ("some ginger"), write the vague version
   (`"a thumb, grated"`) rather than inventing `"1 tbsp"`. If a step is missing
   from the transcript, say so in the response — do not fill the gap silently.
3. **Make it healthy honestly.** These are meant to be healthy recipes, so it is
   fine to cut deep-frying to air-frying, or cream to Greek yogurt. Record every
   such change in `source.adapted`. Never quietly rewrite a recipe and present it
   as what the video said.
4. **Map every ingredient to a registry id.** If it does not exist, add it to
   `data/ingredients.json` with realistic aliases — including the Hindi name
   where there is one, because that is what gets typed.
5. **Set the flags.** This is where matching quality comes from — see below.
6. `npm run validate`, then tell Sartaj what you added and what you had to guess.

## The three flags that decide match quality

Getting these right matters more than anything else in the recipe file.

- **`core: true`** — the recipe does not work without it. Missing and
  unsubstitutable ⇒ the recipe is blocked. Only a like-for-like swap is ever
  offered for a core ingredient.
- **`sub_group: "none"`** — the recipe *is* this ingredient. Paneer in paneer
  bhurji. Besan in besan chilla. Dates in date balls. No swap, ever, even a good
  one. Without this the engine will cheerfully offer chicken thigh for the paneer
  in paneer bhurji, which is a different dish.
- **`optional: true`** — a garnish or a nice-to-have. Missing costs nothing and
  is never substituted.

Rule of thumb: if the ingredient is in the title, it is `sub_group: "none"`.
If the recipe collapses without it but a close cousin would do, it is `core`.
If you would still cook it on a Tuesday without the ingredient, it is `optional`.

`sub_group` also takes a **group id**, which is how you handle an ingredient that
belongs to several groups. Peanut butter is in both `nut_butters` and
`protein_boost`; in a smoothie it is the fat, so that line says
`"sub_group": "nut_butters"` and the engine stops offering Greek yogurt for it.
Reach for this whenever a swap comes out technically valid but obviously wrong.

Everything unflagged is the useful middle: needed, freely swappable, and its
absence downgrades the recipe rather than blocking it.

## `function` — what the ingredient is doing there

`"function": "sweetness"` on the honey line is what lets the engine know that
stevia is a fine swap for taste but leaves a hole where the stickiness was.

Reuse a word the swap table already knows — `sweetness`, `binding`, `bulk`,
`browning`, `moisture`, `fat`, `acid`, `protein`, `creaminess`, `crunch`,
`aromatic`, `heat`, `freshness`, `salt`, `umami`, `structure`, `base`. A word no
group uses carries no information, and the engine falls back to trusting the
group. `npm run validate` lists any off-vocabulary words you introduce.

## Adding a swap

Use `/add-swap`, or edit `data/substitutions.json` directly. Two mechanisms:

- **`groups`** — a set where every member can stand in for every other. Use this
  when the relationship is genuinely symmetric.
- **`rules`** — one-directional (`from` → one of `to`). Use this when it only
  works one way: Greek yogurt replaces mayo, mayo does not replace Greek yogurt.

Two things make a swap entry good:

- **`amount` relative to the group's `reference`.** Not "some stevia" — "6-8
  drops liquid, or a scant 1/4 tsp powder", against a reference of "1 tbsp
  honey". The app prints the reference next to the amount.
- **`lacks` + `compensate` when the swap is imperfect.** `lacks` is what the
  stand-in does not do; `compensate` is how to make up for it. **A swap marked
  `lacks` without a `compensate` note is never offered at all** — the engine
  refuses to suggest something it cannot explain.

## House style for recipe prose

Match the existing files. Specifically:

- `summary` is one or two sentences that say why you would cook this, with a real
  number in it where there is one. Not "a delicious and healthy meal".
- Steps carry the *reason* where a step is easy to get wrong — "squeeze the soya
  properly dry or it takes up no masala", "yogurt into a boiling pan will curdle".
- `tips` are the things that actually go wrong, and the device alternates.
- `health_notes` should contain a fact, not a vibe.
- Straight ASCII punctuation in JSON strings. No smart quotes, no em dashes in
  the data files — they end up rendered in the app.
- British-ish spelling is used throughout (`fibre`, `flavour`, `caramelise`).

## Nutrition

Estimate per serving and set `"estimated": true`. Be conservative and round to
sensible numbers. If the video claims a figure that looks wrong for the
ingredients listed, use your own estimate and mention the discrepancy in the
response — do not copy a wrong number through.

## Running it

```bash
npm run dev
```

`npm run build` type-checks and builds. There are no tests; `npm run validate`
plus a look at the running app is the check.
