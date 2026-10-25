import { useEffect, useRef, useState } from 'react'
import { requestJson } from '../api.js'
import { helpedTitles } from '../reflection.js'

const formatDate = (iso) => new Date(iso).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })

function emptyDraft(reflection) {
  return {
    helped: reflection?.helped ?? [],
    supportsUsed: reflection?.supportsUsed ?? [],
    changeNextTime: reflection?.changeNextTime ?? '',
    notesForNextVisit: reflection?.notesForNextVisit ?? '',
  }
}

function toggle(list, value) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
}

// The optional "After the visit" notes on a plan. `startOpen` opens the form
// and scrolls to it, for the link at the end of the visit journey.
function ReflectionSection({ story, onSaved, startOpen = false }) {
  const [editing, setEditing] = useState(startOpen)
  const [draft, setDraft] = useState(() => emptyDraft(story.reflection))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const sectionRef = useRef(null)
  const { reflection, reflectionChoices: choices } = story

  useEffect(() => {
    if (startOpen) sectionRef.current?.scrollIntoView({ block: 'start' })
  }, [startOpen])

  function startEditing() {
    setDraft(emptyDraft(reflection))
    setMessage('')
    setError('')
    setEditing(true)
  }

  async function save(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const updated = await requestJson(`/api/stories/${story.id}/reflection`, {
        method: 'PUT',
        body: JSON.stringify(draft),
      })
      onSaved(updated)
      setEditing(false)
      setMessage('✓ Your notes are saved.')
    } catch (saveError) {
      setError(`Your notes were not saved. ${saveError.message}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section id="reflection" className="reflection-panel" ref={sectionRef} aria-labelledby="reflection-heading">
      <h2 id="reflection-heading">After the visit</h2>
      <p className="field-help">
        Optional notes for you, saved with this plan. Ready Together does not
        analyze them or build a profile of your child.
      </p>
      <p className="done-note" role="status">{message}</p>

      {editing ? (
        <form className="form-panel reflection-form" onSubmit={save}>
          <fieldset>
            <legend>Which parts of the preparation helped?</legend>
            <div className="support-grid">
              {choices.helped.map((part) => (
                <label className="choice" key={part.id}>
                  <input
                    type="checkbox"
                    checked={draft.helped.includes(part.id)}
                    onChange={() => setDraft((current) => ({ ...current, helped: toggle(current.helped, part.id) }))}
                  />
                  {part.title}
                </label>
              ))}
            </div>
          </fieldset>
          {choices.supports.length > 0 && (
            <fieldset>
              <legend>Which supports did you use?</legend>
              <div className="support-grid">
                {choices.supports.map((support) => (
                  <label className="choice" key={support}>
                    <input
                      type="checkbox"
                      checked={draft.supportsUsed.includes(support)}
                      onChange={() => setDraft((current) => ({
                        ...current,
                        supportsUsed: toggle(current.supportsUsed, support),
                      }))}
                    />
                    {support}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <label>
            What would you change next time?
            <textarea
              name="changeNextTime"
              value={draft.changeNextTime}
              onChange={(event) => setDraft((current) => ({ ...current, changeNextTime: event.target.value }))}
              maxLength={500}
              rows={3}
            />
          </label>
          <label>
            Notes for a future visit
            <textarea
              name="notesForNextVisit"
              value={draft.notesForNextVisit}
              onChange={(event) => setDraft((current) => ({ ...current, notesForNextVisit: event.target.value }))}
              maxLength={500}
              rows={3}
            />
            <span className="field-help">Up to 500 characters each. Every question is optional.</span>
          </label>
          {error && <p className="error-message" role="alert">{error}</p>}
          <div className="button-row">
            <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save notes'}</button>
            <button className="button-link-secondary" type="button" onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </button>
          </div>
        </form>
      ) : reflection ? (
        <>
          <dl className="reflection-summary">
            <div>
              <dt>What helped</dt>
              <dd>{helpedTitles(story).join(', ') || 'Not noted'}</dd>
            </div>
            <div>
              <dt>Supports used</dt>
              <dd>{reflection.supportsUsed.join(', ') || 'Not noted'}</dd>
            </div>
            <div>
              <dt>What to change next time</dt>
              <dd className="pre-wrap">{reflection.changeNextTime || 'Not noted'}</dd>
            </div>
            <div>
              <dt>Notes for a future visit</dt>
              <dd className="pre-wrap">{reflection.notesForNextVisit || 'Not noted'}</dd>
            </div>
          </dl>
          <p className="field-help">Saved {formatDate(reflection.updatedAt)}</p>
          <button className="button-link-secondary" type="button" onClick={startEditing}>Edit notes</button>
        </>
      ) : (
        <>
          <p>When you are ready, you can note what helped and what you would change.</p>
          <button className="button-link-secondary" type="button" onClick={startEditing}>Add notes about the visit</button>
        </>
      )}
    </section>
  )
}

export default ReflectionSection
