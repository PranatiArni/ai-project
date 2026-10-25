// End-to-end test in a real browser. It starts its own API and Vite servers
// with a throwaway database, then drives headless Chrome through the DevTools
// protocol: creating plans with the form, reading the story by keyboard,
// following the visit journey, taking a break, and handling a failed save.
//
// Run with `npm run test:browser`. Needs Google Chrome; set CHROME_PATH if it
// is not in the default macOS location.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const API_PORT = 3101
const WEB_PORT = 5199
const DEBUG_PORT = 9333
const APP = `http://localhost:${WEB_PORT}`
const CHROME = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

if (!fs.existsSync(CHROME)) {
  console.error(`Chrome was not found at ${CHROME}. Set CHROME_PATH to your Chrome or Chromium executable.`)
  process.exit(1)
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const workDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'ready-together-browser-'))
const children = []

function start(command, args, options) {
  const child = spawn(command, args, { stdio: 'ignore', ...options })
  children.push(child)
  return child
}

async function cleanUp() {
  for (const child of children) {
    if (child.exitCode === null) {
      child.kill()
      await new Promise((resolve) => child.once('exit', resolve))
    }
  }
  fs.rmSync(workDirectory, { recursive: true, force: true, maxRetries: 5 })
}

async function waitForUrl(url, timeout = 20_000) {
  const end = Date.now() + timeout
  while (Date.now() < end) {
    try {
      if ((await fetch(url)).ok) return
    } catch { /* not ready yet */ }
    await sleep(200)
  }
  throw new Error(`${url} did not respond in time`)
}

let failures = 0
function check(name, ok, detail = '') {
  if (!ok) failures += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
}

try {
  start(process.execPath, ['server/index.js'], {
    cwd: root,
    env: { ...process.env, PORT: String(API_PORT), DATABASE_PATH: path.join(workDirectory, 'test.sqlite') },
  })
  start(path.join(root, 'client/node_modules/.bin/vite'), ['--port', String(WEB_PORT), '--strictPort'], {
    cwd: path.join(root, 'client'),
    env: { ...process.env, API_URL: `http://localhost:${API_PORT}` },
  })
  await waitForUrl(`${APP}/api/health`)

  start(CHROME, [
    '--headless=new', '--disable-gpu', `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${path.join(workDirectory, 'chrome')}`, '--window-size=1280,1000', 'about:blank',
  ])
  await waitForUrl(`http://127.0.0.1:${DEBUG_PORT}/json/version`)
  const targets = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json()
  const ws = new WebSocket(targets.find((target) => target.type === 'page').webSocketDebuggerUrl)
  await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }))

  let nextId = 0
  const pending = new Map()
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data)
    pending.get(message.id)?.(message)
    pending.delete(message.id)
  })
  const send = (method, params = {}) => {
    const id = (nextId += 1)
    ws.send(JSON.stringify({ id, method, params }))
    return new Promise((resolve) => pending.set(id, resolve))
  }
  const run = async (expression) => {
    const { result } = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description)
    return result.result.value
  }
  const waitFor = async (expression, timeout = 6000) => {
    const end = Date.now() + timeout
    while (Date.now() < end) {
      // Boolean() because page elements cannot be sent back as values.
      try { if (await run(`Boolean(${expression})`)) return true } catch { /* page is loading */ }
      await sleep(100)
    }
    return false
  }
  const open = async (route, ready) => {
    await send('Page.navigate', { url: `${APP}${route}` })
    return waitFor(ready)
  }
  // Clicks a button, link, or label by its visible text, the way a person would.
  const click = (text, within = 'document') => run(`(() => {
    const el = [...${within}.querySelectorAll('button, a, label')]
      .find((node) => node.textContent.replace(/\\s+/g, ' ').trim().includes(${JSON.stringify(text)}))
    if (!el) return false
    el.click()
    return true
  })()`)
  // Picks a radio option inside the fieldset whose legend matches.
  const choose = (legend, option) => click(option, `[...document.querySelectorAll('fieldset')]
    .find((set) => set.querySelector('legend')?.textContent.includes(${JSON.stringify(legend)}))`)
  // Sets a form field so React sees the change, like typing or choosing.
  const fill = (selector, value) => run(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)})
    const prototype = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype
      : el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(el, ${JSON.stringify(value)})
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }))
    return true
  })()`)
  const key = async (name, code, text) => {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: name, code: name, windowsVirtualKeyCode: code, text })
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: name, code: name, windowsVirtualKeyCode: code })
  }
  const api = async (route) => (await fetch(`${APP}${route}`)).json()
  const heading = `document.querySelector('[tabindex="-1"]')?.textContent`
  const storyIdFromUrl = () => run(`location.pathname.split('/')[2]`)

  await send('Page.enable')
  await send('Runtime.enable')

  async function createPlan({ destination, visitType, areas, supports }) {
    await open('/create-story', `document.querySelector('select[name=visitType] option[value=dentist]')`)
    await fill('input[name=destination]', destination)
    await fill('select[name=visitType]', visitType)
    for (const [legend, option] of areas) await choose(legend, option)
    for (const support of supports) await click(support)
    await click('Make my plan')
    await waitFor(`/^\\/stories\\/[^/]+$/.test(location.pathname) && document.querySelector('.plan-header')`)
    return storyIdFromUrl()
  }

  console.log('— Creating a plan with the form')
  await open('/create-story', `document.querySelector('form')`)
  await click('Make my plan')
  check('the form will not submit without a destination',
    await run(`location.pathname === '/create-story' && !document.querySelector('input[name=destination]').validity.valid`))

  const storyId = await createPlan({
    destination: 'the dentist',
    visitType: 'dentist',
    areas: [['Loud or sudden sounds', 'Often hard']],
    supports: ['Noise-reducing headphones'],
  })
  check('submitting the form opens the saved plan', Boolean(storyId))
  check('the plan shows what it was made for',
    await run(`document.querySelector('.choices-summary').textContent.includes('Loud or sudden sounds (often hard)')`))
  const story = await api(`/api/stories/${storyId}`)
  check('the saved plan has a sound section and the headphones', story.sections.some((s) => s.id === 'sound')
    && story.profile.supports.includes('headphones'))

  console.log('— Story reader (keyboard only)')
  await open(`/stories/${storyId}/read`, `${heading} === 'Getting ready'`)
  let reachedNext = false
  for (let i = 0; i < 15 && !reachedNext; i += 1) {
    await key('Tab', 9)
    reachedNext = await run(`document.activeElement?.textContent.trim().startsWith('Next')`)
  }
  check('Tab reaches the Next button', reachedNext)
  await key('Enter', 13, '\r')
  check('Enter on Next shows part 2', await waitFor(`${heading} === 'Arriving'`))
  check('focus moves to the part heading', await run(`document.activeElement === document.querySelector('[tabindex="-1"]')`))
  check('the URL remembers the part', await run(`location.search === '?part=2'`))

  console.log('— Read aloud')
  // A test cannot hear speech, so record what would be spoken instead.
  await run(`(() => {
    window.spoken = []
    window.speechCancels = 0
    window.speechSynthesis.speak = (utterance) => window.spoken.push(utterance.text)
    window.speechSynthesis.cancel = () => { window.speechCancels += 1 }
    window.speechSynthesis.pause = () => {}
    window.speechSynthesis.resume = () => {}
  })()`)
  check('the read-aloud button is offered', await run(`Boolean([...document.querySelectorAll('button')]
    .find((button) => button.textContent.includes('Read aloud')))`))
  await click('Read aloud')
  check('it reads the current part’s title and words',
    await waitFor(`window.spoken[0]?.startsWith('Arriving') && window.spoken[0].includes('front desk')`),
    await run('window.spoken[0]'))
  check('Pause and Stop appear while reading', await waitFor(`document.querySelector('.speech-controls').textContent.includes('Pause')
    && document.querySelector('.speech-controls').textContent.includes('Stop')`))
  await click('Pause')
  check('Pause changes to Resume', await waitFor(`document.querySelector('.speech-controls').textContent.includes('Resume')`))
  await click('Stop')
  check('Stop returns to the read-aloud button',
    await waitFor(`document.querySelector('.speech-controls').textContent.includes('Read aloud')`))
  await click('Read aloud')
  const cancelsBefore = await run('window.speechCancels')
  await click('Next')
  await waitFor(`${heading} === 'What might happen next'`)
  check('moving to another part stops the reading', await run(`window.speechCancels > ${cancelsBefore}
    && document.querySelector('.speech-controls').textContent.includes('Read aloud')`))

  console.log('— Visit journey')
  check('the journey opens on the requested step', await open(`/trip/${storyId}?step=arrive`, `${heading} === 'Arrive'`))
  await click('look for a quieter spot')
  await waitFor(`document.querySelector('.journey-box input')?.checked && !document.querySelector('.saving-note')`)
  check('ticking a checkbox on a step saves it',
    (await api(`/api/stories/${storyId}`)).checklist.find((item) => item.id === 'find-quiet-spot').completed)
  await click('Mark as done')
  check('marking a step done shows confirmation',
    await waitFor(`document.querySelector('.done-note')?.textContent.includes('✓ Done')`))
  check('step completion is saved',
    (await api(`/api/stories/${storyId}`)).journey.find((step) => step.id === 'arrive').completed)
  await click('Take a break')
  check('Take a break opens the calm break page', await waitFor(`location.pathname === '/calm-break/${storyId}'`))
  await click('Go back to the same step')
  check('the calm break returns to the same step', await waitFor(`location.search === '?step=arrive' && ${heading} === 'Arrive'`))
  await click('Next')
  check('Next moves to the next step', await waitFor(`${heading} === 'During the visit'`))
  check('the During step lists this family’s coping idea',
    await run(`document.querySelector('.coping-list').textContent.includes('put on my headphones')`))
  await click('Leave and head home')
  check('the step bar lets you skip ahead', await waitFor(`${heading} === 'Leave and head home'`))
  await send('Page.reload')
  check('a refresh keeps the current step', await waitFor(`${heading} === 'Leave and head home'`))

  // Make the next save fail, as if the server could not be reached.
  await run(`(() => {
    const realFetch = window.fetch
    window.fetch = (url, options) => options?.method === 'PATCH'
      ? Promise.reject(new TypeError('Failed to fetch'))
      : realFetch(url, options)
  })()`)
  await click('Mark as done')
  check('a failed save shows an error', await waitFor(`document.querySelector('[role=alert]')?.textContent.includes('not saved')`))
  check('a failed save undoes the change on screen',
    await run(`document.querySelector('.journey-actions button').textContent.includes('Mark as done')`))

  console.log('— Plan page checklist')
  await open(`/stories/${storyId}`, `document.querySelectorAll('.plan-aside input[type=checkbox]').length > 0`)
  await click('Read the story together')
  await waitFor(`!document.querySelector('.saving-note')`)
  check('ticking on the plan page saves',
    (await api(`/api/stories/${storyId}`)).checklist.find((item) => item.id === 'read-story').completed)
  check('the plan header progress updates', await run(`document.querySelector('.plan-meta').textContent.includes('2 of')`))

  console.log('— Editing the story wording')
  await open(`/stories/${storyId}`, `document.querySelector('.story-reader')`)
  await click('Edit wording')
  await waitFor(`document.querySelector('.story-editor textarea')`)
  await fill('.story-editor textarea', 'We are going to see Dr. Lee today\nIs it a short drive?')
  await click('Save', `document.querySelector('.story-editor')`)
  check('saving shows a confirmation', await waitFor(`document.querySelector('.done-note')?.textContent.includes('✓ Saved.')`))
  check('the reader shows the new wording and marks the part as edited', await waitFor(
    `document.querySelector('.reader-part').textContent.includes('We are going to see Dr. Lee today.')
      && document.querySelector('.step-reason.edited')`))
  let edited = await api(`/api/stories/${storyId}`)
  check('the edit is saved, keeping the question mark',
    edited.sections[0].edited && edited.sections[0].sentences.join(' ') === 'We are going to see Dr. Lee today. Is it a short drive?')

  console.log('— Changing preferences')
  await click('Change preferences')
  check('the form opens with the plan’s choices filled in', await waitFor(
    `document.querySelector('input[name=destination]')?.value === 'the dentist'
      && document.querySelector('input[name=area-sound][value=often]')?.checked`))
  check('it warns that wording edits will be replaced',
    await run(`document.body.textContent.includes('Heads up')`))
  await choose('Waiting', 'Often hard')
  await click('Update plan')
  await waitFor(`location.pathname === '/stories/${storyId}' && document.querySelector('.plan-header')`)
  edited = await api(`/api/stories/${storyId}`)
  check('the rebuilt plan follows the new choices', edited.sections.some((s) => s.id === 'waiting')
    && edited.sections.some((s) => s.id === 'sound'))
  check('checklist ticks are kept', edited.checklist.find((item) => item.id === 'read-story').completed)
  check('the rebuilt story replaced the edited wording', !edited.sections[0].edited)

  await click('Change preferences')
  await waitFor(`document.querySelector('input[name=destination]')?.value === 'the dentist'`)
  await click('Plan a visit')
  check('"Plan a visit" opens an empty form, not the plan being changed', await waitFor(
    `location.pathname === '/create-story' && document.querySelector('h1')?.textContent === 'Tell us about the visit'
      && document.querySelector('input[name=destination]')?.value === ''`))

  console.log('— After the visit')
  await open(`/trip/${storyId}?step=leave`, `${heading} === 'Leave and head home'`)
  await click('Note what helped')
  check('the last journey step opens the reflection form on the plan',
    await waitFor(`location.search === '?reflect=1' && document.querySelector('.reflection-form')`))
  const reflectionForm = `document.querySelector('.reflection-form')`
  check('the form offers only this plan’s own supports', await run(`${reflectionForm}.textContent.includes('Noise-reducing headphones')
    && !${reflectionForm}.textContent.includes('A visual timer')`))
  await click('The steps for the day', reflectionForm)
  await click('Noise-reducing headphones', reflectionForm)
  await fill('.reflection-form textarea[name=changeNextTime]', 'Book the first appointment of the day')
  await fill('.reflection-form textarea[name=notesForNextVisit]', 'Ask for the quiet room')
  await click('Save notes', reflectionForm)
  check('saved notes are shown back', await waitFor(`document.querySelector('.reflection-summary')?.textContent.includes('Ask for the quiet room')
    && document.querySelector('#reflection').textContent.includes('✓ Saved.')`))
  const reflected = await api(`/api/stories/${storyId}`)
  check('the reflection is saved and ticks "note what helped"', reflected.reflection?.supportsUsed.includes('Noise-reducing headphones')
    && reflected.checklist.find((item) => item.id === 'reflect').completed)

  console.log('— Bringing notes into a new plan')
  await open('/create-story', `document.querySelector('select[name=pastVisit] option[value="${storyId}"]')`)
  await fill('select[name=pastVisit]', storyId)
  check('choosing a past visit shows its notes without using them',
    await waitFor(`document.querySelector('.past-visit-card')?.textContent.includes('Book the first appointment')`))
  check('the new form still starts with no preferences chosen',
    await run(`document.querySelector('input[name=area-sound][value=not-a-concern]').checked`))
  await click('Use the same answers')
  check('copying fills in that plan’s preferences', await waitFor(`document.querySelector('input[name=area-sound][value=often]').checked
    && document.querySelector('input[name=area-waiting][value=often]').checked`))
  await click('Show these notes')
  await fill('input[name=destination]', 'the dentist')
  await fill('select[name=visitType]', 'dentist')
  await click('Make my plan')
  check('the new plan shows the notes the caregiver chose to bring', await waitFor(
    `document.querySelector('.previous-visit')?.textContent.includes('Ask for the quiet room')`))
  const withNotesId = await storyIdFromUrl()
  check('it is a new plan with its own empty reflection', withNotesId !== storyId
    && (await api(`/api/stories/${withNotesId}`)).reflection === null)

  console.log('— Places and family reports')
  await open('/places', `document.querySelectorAll('.place-card').length === 3`)
  check('example places are labeled and have no invented scores', await run(`[...document.querySelectorAll('.place-card')]
    .every((card) => card.textContent.includes('Example place') && card.textContent.includes('No reports yet'))`))
  const firstCard = `document.querySelector('.place-card')`
  await click('Add a report', firstCard)
  await waitFor(`${firstCard}.querySelector('.report-form')`)
  await click('Save report', firstCard)
  check('an untouched report form records nothing and explains why',
    await waitFor(`${firstCard}.querySelector('[role=alert]')?.textContent.includes('at least one')`))
  check('nothing was saved', (await api('/api/places')).every((place) => place.reportCount === 0))
  await fill('.report-form select[name=lighting]', '2')
  await choose('Was there a quiet place', 'Yes')
  await fill('.report-form textarea', 'Quiet benches by the pond')
  await click('Save report', firstCard)
  check('a report is saved and thanked', await waitFor(`document.body.textContent.includes('Your report was saved')`))
  const reportedCard = `[...document.querySelectorAll('.place-card')].find((card) => card.textContent.includes('1 report,'))`
  check('the card shows it as a family report with the answers given', await waitFor(`${reportedCard}
    && ${reportedCard}.textContent.includes('Reported by families')
    && ${reportedCard}.textContent.includes('1 of 1 family found one')
    && ${reportedCard}.textContent.includes('Quiet benches by the pond')`))
  check('unanswered categories stay Unknown',
    await run(`${reportedCard}.querySelectorAll('.unknown-text').length === 3`))

  await click('Add a place')
  await waitFor(`document.querySelector('.add-place-form')`)
  await fill('.add-place-form input', 'Maple Street Dental')
  await fill('.add-place-form select', 'Dentist')
  await click('Add place', `document.querySelector('.add-place-form')`)
  check('a family can add a place, and it is labeled as theirs', await waitFor(
    `[...document.querySelectorAll('.place-card')].some((card) => card.textContent.includes('Maple Street Dental')
      && card.textContent.includes('Added by a family'))`))

  console.log('— A second family with different preferences')
  const secondId = await createPlan({
    destination: 'the dentist',
    visitType: 'dentist',
    areas: [['Crowds and new places', 'Often hard'], ['Waiting', 'Often hard']],
    supports: ['A visual timer'],
  })
  const second = await api(`/api/stories/${secondId}`)
  const sectionIds = (plan) => plan.sections.map((section) => section.id)
  check('the second plan is a different saved plan', secondId && secondId !== storyId)
  check('its story has crowd and waiting parts but no sound part',
    sectionIds(second).includes('crowds') && sectionIds(second).includes('waiting') && !sectionIds(second).includes('sound'))
  check('a plan made without choosing a past visit has no notes from one', second.previousVisit === null)
  check('its checklist differs from the first family’s',
    second.checklist.some((item) => item.id === 'practice-waiting')
      && !second.checklist.some((item) => item.id === 'preview-sounds'))

  ws.close()
} catch (error) {
  failures += 1
  console.error(`ERROR  ${error.message}`)
} finally {
  await cleanUp()
}

console.log(failures === 0 ? '\nAll browser checks passed.' : `\n${failures} browser check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)
