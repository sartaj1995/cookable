// Takes every picture in the README from the app itself, in light and dark, so
// they cannot drift from what it really looks like - the same rule as
// make-icons.mjs: no image in the repo that it cannot rebuild.
// Run with: npm run readme-images
//
// Builds the app, serves the build, and drives a Chrome or Edge you already have
// over the DevTools protocol. Node 22+ ships the WebSocket that needs, so there
// is nothing to install. Set CHROME_PATH if the browser lives somewhere unusual.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build, preview } from 'vite'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = resolve(ROOT, 'docs', 'images')
const STORAGE_KEY = 'cookable.v1' // from src/App.tsx
const THEMES = ['light', 'dark']

const read = (...path) => JSON.parse(readFileSync(resolve(ROOT, ...path), 'utf8'))
const INGREDIENT = new Map(read('data', 'ingredients.json').ingredients.map((i) => [i.id, i.name]))
const DEVICE = new Map(read('data', 'equipment.json').equipment.map((e) => [e.id, e.name]))

/*
 * The demo kitchen, picked so every picture has something to show: six recipes
 * ready and a few more one or two things short. Baked protein oats is the one
 * that gets opened - there is no oven, so it gets the air fryer note; there is
 * almond milk rather than milk; and honey is on the prefer_not list, so stevia
 * comes up as "your swap".
 */
const KITCHEN = {
  ingredients: [
    'chicken_breast', 'eggs', 'paneer', 'greek_yogurt', 'oats', 'whey_protein',
    'banana', 'almond_milk', 'honey', 'stevia', 'peanut_butter', 'dark_chocolate',
    'spinach', 'onion', 'tomato', 'garlic', 'ginger', 'green_chilli', 'lemon',
    'coriander', 'turmeric', 'garam_masala', 'cumin_seeds', 'cumin_powder',
    'coriander_powder', 'red_chilli_powder', 'baking_powder',
  ],
  devices: ['air_fryer', 'blender'],
}
const OPEN_RECIPE = 'baked-protein-oats'

const SHOTS = [
  // Kitchen on the left, matches on the right - the first thing in the README.
  { name: 'kitchen', width: 1180, height: 820 },
  // One recipe opened, cut off below the ingredients, which is where the swaps are.
  { name: 'recipe', width: 1180, height: 1400, open: OPEN_RECIPE, clipTo: 'ingredients' },
  // The installed app on a phone, scrolled past the kitchen to what it found.
  { name: 'phone', width: 390, height: 844, mobile: true, scrollTo: '.results-head', frame: true },
  // The wordmark, drawn with the app's own tokens and fonts - see banner().
  { name: 'banner', width: 1280, height: 420, banner: true },
]

function savedKitchen() {
  const label = (map, id) => {
    const name = map.get(id)
    if (!name) throw new Error(`"${id}" in the demo kitchen is not in the registry any more`)
    return name
  }
  const items = [
    ...KITCHEN.ingredients.map((id) => ({ id, label: label(INGREDIENT, id), kind: 'ingredient' })),
    ...KITCHEN.devices.map((id) => ({ id, label: label(DEVICE, id), kind: 'equipment' })),
  ]
  return JSON.stringify({ items, includeStaples: true })
}

/*
 * Rendered inside the running app rather than as a standalone page, so it picks
 * up the real stylesheet: the same colour tokens, the same Playfair and Karla,
 * the same paper grain, and the dark palette whenever the page is emulating it.
 * Nothing here repeats a hex value from styles.css.
 */
function banner() {
  const icon = readFileSync(resolve(ROOT, 'public', 'favicon.svg'), 'utf8')
  const typed = ['paneer', 'dahi', 'jeera', 'shimla mirch', 'air fryer']
  return `
    <style>
      .bn { position: relative; z-index: 1; height: 100vh; display: grid; place-items: center; text-align: center; }
      .bn-icon svg { width: 76px; height: 76px; border-radius: 18px; box-shadow: var(--shadow-lg); }
      .bn h1 { font: 600 88px/1 var(--display); letter-spacing: -0.02em; margin: 22px 0 10px; color: var(--text); }
      .bn p { font: italic 500 27px/1.3 var(--display); color: var(--text-dim); margin: 0 0 30px; }
      .bn-row { display: flex; gap: 10px; align-items: center; justify-content: center; font: 500 17px var(--ui); }
      .bn-chip { padding: 7px 15px; border-radius: 999px; background: var(--surface); border: 1px solid var(--border-strong); color: var(--text); }
      .bn-arrow { color: var(--text-faint); margin: 0 6px; font-size: 22px; }
      .bn-out { padding: 7px 16px; border-radius: 999px; background: var(--ready-soft); border: 1px solid var(--ready-edge); color: var(--ready); font-weight: 700; }
    </style>
    <div class="bn">
      <div>
        <div class="bn-icon">${icon}</div>
        <h1>Cookable</h1>
        <p>What can I actually make right now?</p>
        <div class="bn-row">
          ${typed.map((t) => `<span class="bn-chip">${t}</span>`).join('')}
          <span class="bn-arrow">&rarr;</span>
          <span class="bn-out">Make it now</span>
        </div>
      </div>
    </div>`
}

function findBrowser() {
  const found = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/microsoft-edge',
  ].find((path) => path && existsSync(path))
  if (!found) throw new Error('No Chrome or Edge found - set CHROME_PATH to one')
  return found
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

/**
 * Headless browser with a throwaway profile, and a DevTools connection to its tab.
 *
 * Edge relaunches itself on start: the process spawned here exits at once with
 * a clean code, and the browser doing the work is one this script never gets a
 * handle on. So the DevTools address comes from the file the browser writes
 * into its profile, not from its output, and quitting goes through DevTools
 * rather than through the process.
 */
async function launch() {
  const profile = mkdtempSync(join(tmpdir(), 'cookable-shots-'))
  const child = spawn(
    findBrowser(),
    [
      '--headless=new',
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      // Edge's built-in extensions keep it running after it has been told to quit.
      '--disable-extensions',
      '--disable-component-extensions-with-background-pages',
      '--hide-scrollbars',
      '--force-color-profile=srgb',
      'about:blank',
    ],
    { stdio: 'ignore' },
  )
  let crashed = null
  child.once('exit', (code) => (crashed = code || null))

  const portFile = join(profile, 'DevToolsActivePort')
  let port, browserPath
  for (let waited = 0; !browserPath; waited += 100) {
    // Checked for a complete second line, since the file can be seen mid-write.
    const [line, path] = existsSync(portFile) ? readFileSync(portFile, 'utf8').split('\n') : []
    if (path?.startsWith('/devtools/browser/')) [port, browserPath] = [line, path.trim()]
    else if (crashed) throw new Error(`The browser quit on start (exit code ${crashed})`)
    else if (waited > 20_000) throw new Error('The browser had not started after 20 seconds')
    else await sleep(100)
  }

  const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json())
  const tab = targets.find((t) => t.type === 'page')
  const ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((done, fail) => {
    ws.onopen = done
    ws.onerror = () => fail(new Error('Could not connect to the browser tab'))
  })

  let lastId = 0
  const pending = new Map()
  const waiting = []
  ws.onmessage = ({ data }) => {
    const msg = JSON.parse(data)
    if (msg.id) {
      const { done, fail } = pending.get(msg.id)
      pending.delete(msg.id)
      msg.error ? fail(new Error(msg.error.message)) : done(msg.result)
    } else {
      for (const w of waiting.filter((w) => w.method === msg.method)) {
        waiting.splice(waiting.indexOf(w), 1)
        w.done(msg.params)
      }
    }
  }

  const send = (method, params = {}) =>
    new Promise((done, fail) => {
      pending.set(++lastId, { done, fail })
      ws.send(JSON.stringify({ id: lastId, method, params }))
    })
  const next = (method) => new Promise((done) => waiting.push({ method, done }))

  async function evaluate(expression) {
    const { result, exceptionDetails } = await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    })
    if (exceptionDetails) {
      throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text)
    }
    return result.value
  }

  async function close() {
    ws.close()
    // Browser.close has to go to the browser itself rather than the tab, and the
    // browser hangs up instead of answering, so the hang-up is what is awaited.
    const browser = new WebSocket(`ws://127.0.0.1:${port}${browserPath}`)
    const hungUp = new Promise((done) => browser.addEventListener('close', done))
    await new Promise((done) => {
      browser.onopen = done
      browser.onerror = done
    })
    if (browser.readyState === WebSocket.OPEN) {
      browser.send(JSON.stringify({ id: 1, method: 'Browser.close' }))
      await Promise.race([hungUp, sleep(10_000)])
    }
    // Its helper processes hold the profile for most of a second after the
    // browser hangs up. rmSync's own retries sleep synchronously and gave up
    // before they were done, so this waits properly instead.
    for (let waited = 0; ; waited += 250) {
      try {
        rmSync(profile, { recursive: true, force: true })
        break
      } catch {
        if (waited > 10_000) {
          console.warn(`could not remove ${profile} - a browser may still be running from it`)
          break
        }
        await sleep(250)
      }
    }
  }

  await send('Page.enable')
  return { send, next, evaluate, close }
}

async function main() {
  console.log('building...')
  await build({ root: ROOT, logLevel: 'warn' })
  const server = await preview({ root: ROOT, logLevel: 'warn', preview: { port: 4190, open: false } })
  const url = server.resolvedUrls.local[0]
  const browser = await launch()
  const { send, next, evaluate } = browser

  /**
   * Wait for whatever the last change asked for. Two frames make the browser lay
   * the page out, which is what starts a font loading - the banner's italic is a
   * face the app itself never uses - and fonts.ready then waits for it.
   */
  async function settle() {
    const loaded = await evaluate(`new Promise((done) =>
      requestAnimationFrame(() => requestAnimationFrame(() => document.fonts.ready.then(() =>
        done([...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/"/g, '')))))))`)
    // Fonts come from Google Fonts. Offline, the page quietly falls back to
    // Georgia, and a picture of that is worse than no picture.
    for (const family of ['Playfair Display', 'Karla']) {
      if (!loaded.includes(family)) throw new Error(`${family} did not load - are you online?`)
    }
  }

  async function load() {
    const loaded = next('Page.loadEventFired')
    await send('Page.navigate', { url })
    await loaded
    await settle()
  }

  /** Let whatever is not drawn come out see-through, plus any CSS the shot needs. */
  async function transparent(css = '') {
    await send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } })
    const style = `<style>html, body { background: transparent !important } ${css}</style>`
    await evaluate(`document.head.insertAdjacentHTML('beforeend', ${JSON.stringify(style)})`)
  }

  try {
    mkdirSync(OUT, { recursive: true })
    await load()
    await evaluate(`localStorage.setItem(${JSON.stringify(STORAGE_KEY)}, ${JSON.stringify(savedKitchen())})`)

    for (const theme of THEMES) {
      for (const shot of SHOTS) {
        await send('Emulation.setDefaultBackgroundColorOverride', {})
        await send('Emulation.setDeviceMetricsOverride', {
          width: shot.width,
          height: shot.height,
          deviceScaleFactor: 2,
          mobile: Boolean(shot.mobile),
        })
        // Reduced motion puts every card at its resting place immediately.
        await send('Emulation.setEmulatedMedia', {
          features: [
            { name: 'prefers-color-scheme', value: theme },
            { name: 'prefers-reduced-motion', value: 'reduce' },
          ],
        })
        await load()
        // The paper grain is noise, and noise is the one thing PNG cannot
        // compress - it triples every file for a texture nobody can make out at
        // the size GitHub shows these. Hidden for the picture only.
        await evaluate(`document.head.insertAdjacentHTML('beforeend',
          '<style>body::before { display: none !important }</style>')`)

        if (shot.banner) {
          await evaluate(`document.body.innerHTML = ${JSON.stringify(banner())}`)
        } else if (!(await evaluate(`document.querySelectorAll('.card').length`))) {
          throw new Error(`No recipe cards - has the storage key in src/App.tsx changed from ${STORAGE_KEY}?`)
        }

        if (shot.open) {
          const { title } = read('recipes', `${shot.open}.json`)
          const opened = await evaluate(`(() => {
            const card = [...document.querySelectorAll('.card')]
              .find((c) => c.querySelector('h3')?.textContent === ${JSON.stringify(title)})
            card?.click()
            return Boolean(card)
          })()`)
          if (!opened) throw new Error(`No card for "${title}" in the demo kitchen`)
        }

        if (shot.scrollTo) {
          await evaluate(`scrollTo(0, document.querySelector(${JSON.stringify(shot.scrollTo)})
            .getBoundingClientRect().top + scrollY - 20)`)
        }

        await settle()
        let clip
        if (shot.clipTo) {
          // Just the sheet. With the page and the dimmed backdrop still behind
          // it, its rounded corners come out filled in with them.
          await transparent(`.app > :not(.scrim) { visibility: hidden !important }
            .scrim { background: none !important; backdrop-filter: none !important }`)
          clip = await evaluate(`new Promise((done) => requestAnimationFrame(() => {
            const sheet = document.querySelector('.sheet').getBoundingClientRect()
            const block = [...document.querySelectorAll('.sheet .block')]
              .find((b) => b.querySelector('h3')?.textContent.toLowerCase() === ${JSON.stringify(shot.clipTo)})
              .getBoundingClientRect()
            done({ x: sheet.x, y: sheet.y, width: sheet.width, height: block.bottom + 24 - sheet.y, scale: 1 })
          }))`)
        }

        let { data } = await send('Page.captureScreenshot', { format: 'png', clip })

        if (shot.frame) {
          // A second pass: the phone-sized picture, set in a plain bezel. The
          // lighter edge is what keeps it visible against GitHub's dark theme.
          const bezel = 11
          const room = 28 // for the shadow
          await send('Emulation.setDeviceMetricsOverride', {
            width: shot.width + 2 * (bezel + room),
            height: shot.height + 2 * (bezel + room),
            deviceScaleFactor: 2,
            mobile: false,
          })
          await transparent(`
            .phone { margin: ${room - 1.5}px; padding: ${bezel}px; width: fit-content;
              border: 1.5px solid #3d3630; border-radius: 58px; background: #0c0a08;
              box-shadow: 0 24px 50px -20px rgba(0, 0, 0, 0.5) }
            .phone img { display: block; width: ${shot.width}px; height: ${shot.height}px; border-radius: 46px }`)
          await evaluate(`document.body.innerHTML =
            '<div class="phone"><img src="data:image/png;base64,${data}"></div>'`)
          await evaluate(`document.querySelector('.phone img').decode()`)
          await settle()
          ;({ data } = await send('Page.captureScreenshot', { format: 'png' }))
        }

        const file = resolve(OUT, `${shot.name}-${theme}.png`)
        writeFileSync(file, Buffer.from(data, 'base64'))
        console.log('wrote', `docs/images/${shot.name}-${theme}.png`)
      }
    }
  } finally {
    await browser.close()
    await server.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
