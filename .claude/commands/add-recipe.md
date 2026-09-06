---
description: Turn a YouTube link, transcript, or description into a recipe file in this database
argument-hint: "<youtube url, transcript, or paste of a recipe>"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(npm run validate), WebFetch, WebSearch
---

Add a recipe to this database from what follows.

<input>
$ARGUMENTS
</input>

If `<input>` is empty, ask what to add and stop.

## 1. Get the content

- **A transcript or pasted recipe** — use it directly. This is the best input.
- **A YouTube URL** — `WebFetch` it. Titles, channel names and descriptions come
  through, and creators often put the full recipe in the description. Automatic
  captions usually do not come through.
- **If fetching gives you a title but no method**, say so and ask for the
  transcript. Do not reconstruct a recipe from the title and your own knowledge
  and present it as the video's — that is the one thing not to do here. If you
  do end up writing a recipe from general knowledge because Sartaj asks you to,
  set `source.type` to `"own"` and say clearly in your reply that it is not the
  video's version.

## 2. Read the conventions first

Read `CLAUDE.md` and skim two or three existing files in `recipes/` before
writing. Match their voice, their level of detail, and their punctuation.

## 3. Extract

Pull out: title, what it actually is, servings, prep/cook time, every ingredient
with the quantity as stated, the method in order, and any tip the creator gives
that is worth keeping.

Where the video is vague, stay vague — `"a thumb of ginger, grated"` is a better
record than an invented `"1 tbsp"`. Where the video is missing something you need
(servings, a temperature, a time), estimate it and note the estimate in your
reply, so Sartaj knows which numbers came from the video and which came from you.

## 4. Make it healthy — and say what you changed

This is a healthy-recipe database. Reasonable adaptations: air fry instead of
deep fry, Greek yogurt instead of cream or mayo, cut oil to a tablespoon or two,
swap refined flour for whole wheat or oat flour, cut sugar and note that stevia
or monk fruit works.

Every change goes in `source.adapted` as a plain sentence. If the original was
already healthy, say that instead.

## 5. Map ingredients to the registry

Every `ingredients[].id` must exist in `data/ingredients.json`. Grep for it before
assuming it is missing — a lot of things are there under an alias.

When you do add one, give it realistic aliases: the Hindi name, the plural, the
supermarket name, whatever a person would actually type. Aliases are how the app
recognises what Sartaj types into the box.

## 6. Set the flags

From `CLAUDE.md`, and get these right — the whole app is built on them:

- `sub_group: "none"` for the ingredient the dish is named after
- `core: true` for what it cannot work without
- `optional: true` for garnishes and nice-to-haves
- `function: "..."` reusing a word the swap table knows

## 7. Write the file

`recipes/<kebab-case-id>.json`, with `id` matching the filename. Full field
reference is in `SCHEMA.md`. Include `nutrition_per_serving` with
`"estimated": true`, and a `source` block:

```json
"source": {
  "type": "youtube",
  "url": "...",
  "channel": "...",
  "title": "...",
  "captured": "YYYY-MM-DD",
  "adapted": "What you changed and why."
}
```

## 8. Check it

```bash
npm run validate
```

Fix anything it reports. Then consider whether this recipe suggests a swap worth
adding to `data/substitutions.json` — if the video says "you can use X instead of
Y" and the table does not know that yet, that is worth adding while you are here.

## 9. Report back

Tell Sartaj:

- what you added, and the protein / calorie estimate
- **which numbers you estimated rather than took from the source**
- what you changed to make it healthier
- any new ingredients or swaps you added to the data files
- anything the source was too vague about to pin down
