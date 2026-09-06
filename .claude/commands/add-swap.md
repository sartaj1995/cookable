---
description: Add or adjust an ingredient substitution in the swap table
argument-hint: "<e.g. 'I never have buttermilk' or 'use allulose instead of sugar'>"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(npm run validate)
---

Update `data/substitutions.json` (and `data/preferences.json` where it is really
a standing preference) based on this:

<input>
$ARGUMENTS
</input>

If `<input>` is empty, ask what swap to add and stop.

## Work out which thing is being asked for

Three different requests look similar and land in different files:

1. **"X can stand in for Y"** — a swap. Goes in `data/substitutions.json`.
2. **"I never want X"** — a preference. Goes in `data/preferences.json` under
   `prefer_not` (swap it out when possible, never block a recipe) or `avoid`
   (hard no, blocks the recipe if nothing can replace it). Allergies and real
   dislikes go in `avoid`; "I would rather not" goes in `prefer_not`.
3. **"When there is a choice, give me X first"** — ranking. Goes in
   `preferences.prefer.<groupId>`, in order.

Ask which one is meant only if it is genuinely ambiguous. "I don't like honey"
is `prefer_not`. "I'm allergic to peanuts" is `avoid`.

## Group or rule?

- **Group** if the relationship is symmetric — any member replaces any other.
  Add to an existing group if one fits; do not create a near-duplicate.
- **Rule** if it only works one way. Greek yogurt replaces mayo; mayo does not
  replace Greek yogurt.

## Make the entry a good one

Read `CLAUDE.md` for the full conventions. The two things that matter:

- **`amount` against the group's `reference`.** Real numbers. If you do not know
  the conversion, say so rather than writing a plausible-looking ratio — a wrong
  ratio in this table silently ruins every recipe that uses it.
- **`lacks` + `compensate` whenever the swap is imperfect.** `lacks` names what
  the stand-in does not do; `compensate` says how to make up for it. An entry
  with `lacks` and no `compensate` is never offered by the engine at all, so the
  compensate note is not optional decoration.

Add `notes` for anything about taste or handling — "brands vary a lot in
strength", "press it dry first", "add it off the heat".

## Then

```bash
npm run validate
```

Report what you added, in which file, and — if the swap is imperfect — what the
compensate note tells the app to warn about.
