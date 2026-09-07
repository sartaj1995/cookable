# Cookable

Tell it what is in your kitchen — ingredients and devices — and it tells you what
you can actually make right now, working out the substitutions for whatever you
are missing.

```bash
npm install
npm run dev
```

Opens at http://localhost:5180.

## How it works

Type or paste what you have. `chicken, spinach, curd, air fryer, blender` — it
sorts the food from the devices on its own, and understands the names people
actually use (`dahi`, `kadai`, `capsicum`, `mixie`, `2 large onions`).

Or tap instead of typing: the panel has four browsable lists — **Equipment**,
**Key ingredients** (grouped by proteins, dairy, vegetables, grains, dals, nuts,
fats, condiments), **Spices & herbs** and **Sweeteners**. Each header shows how
many you have selected, and the lists are built from `data/ingredients.json`, so
anything you add there appears on its own.

Recipes then sort into:

- **Make it now** — you have everything, or a swap you already own covers it
- **One or two things short**
- **A few things short**
- **Not without a shop** — hidden unless you ask for it

Each card says what it is swapping and what you are missing. Open one and the
ingredient list is rewritten in terms of your kitchen: the thing you do not have
struck out, what to use instead underneath, and how much of it.

### The substitution table is the point

`data/substitutions.json` is what makes a recipe cookable when you are missing
something. A recipe calling for a tablespoon of honey will tell you to use 6-8
drops of stevia — and, because the table records that stevia gives sweetness but
no bulk or stickiness, it will also tell you what to add back if the honey was
holding the thing together.

Standing preferences live in `data/preferences.json` and nowhere else — there
are no preference controls in the app. `prefer_not` is for things to swap out
whenever possible (sugar, honey, jaggery and maple syrup are there by default),
`avoid` for a hard no, `prefer` to rank which stand-in gets offered first, and
`diet` for vegetarian / vegan / eggless / gluten-free / dairy-free. Edit the file
or ask Claude Code to; changes apply on the next page load. Only your kitchen is
remembered in the browser.

### Devices too

If a recipe wants an oven and you have an air fryer, it says so, with the
temperature and time adjustment. Same for a pressure cooker you do not have, a
blender, a steamer.

## Adding recipes

The app is read-only. Recipes are files in `recipes/`, one per recipe, added with
Claude Code:

```
/add-recipe https://youtube.com/shorts/xxxxx
/add-recipe <paste a transcript>
/add-swap I never have buttermilk
```

Paste the transcript if you have it — it is far more reliable than a bare link,
because YouTube does not hand out captions to a plain fetch.

Everything Claude Code needs to know about conventions is in `CLAUDE.md`, and the
full field reference is in `SCHEMA.md`.

After any data edit:

```bash
npm run validate
```

That catches the one mistake that matters — a recipe pointing at an ingredient id
that does not exist. Such a recipe renders fine and can never be matched, because
nothing in your kitchen will ever equal that id.

## Layout

```
recipes/*.json          one file per recipe, auto-discovered
data/ingredients.json   canonical ids + the aliases you might type
data/substitutions.json the swap table
data/equipment.json     devices + what to use instead
data/preferences.json   your standing preferences
src/lib/match.ts        the matching engine
scripts/validate.mjs    data checks
```

Vite + React + TypeScript, no backend. Your kitchen and preferences live in
browser storage; the recipe database lives in git.
