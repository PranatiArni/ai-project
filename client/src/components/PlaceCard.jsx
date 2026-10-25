import { useState } from 'react'
import { requestJson } from '../api.js'

const SCORE_OPTIONS = [
  { value: '1', label: '1 — calm' },
  { value: '2', label: '2 — a little hard' },
  { value: '3', label: '3 — mixed' },
  { value: '4', label: '4 — hard' },
  { value: '5', label: '5 — very hard' },
]

const formatDate = (iso) => new Date(iso).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
const reportWord = (count) => `${count} report${count === 1 ? '' : 's'}`

// Every answer starts as "not sure", so an untouched form never records a score.
function ReportForm({ place, categories, onSaved, onCancel }) {
  const [scores, setScores] = useState(() => Object.fromEntries(categories.map(({ id }) => [id, ''])))
  const [quietSpace, setQuietSpace] = useState('not-sure')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(event) {
    event.preventDefault()
    setError('')
    const answered = Object.values(scores).some(Boolean) || quietSpace !== 'not-sure' || note.trim()
    if (!answered) {
      setError('Answer at least one question, or add a note.')
      return
    }
    setSaving(true)
    try {
      const result = await requestJson(`/api/places/${place.id}/ratings`, {
        method: 'POST',
        body: JSON.stringify({
          ...Object.fromEntries(Object.entries(scores).map(([id, value]) => [id, value ? Number(value) : null])),
          quietSpace,
          note: note.trim() || null,
        }),
      })
      onSaved(result)
    } catch (saveError) {
      setError(saveError.message)
      setSaving(false)
    }
  }

  return (
    <form className="report-form" onSubmit={submit}>
      <p className="field-help">Skip anything you didn’t notice.</p>
      <div className="report-scores">
        {categories.map(({ id, label }) => (
          <label key={id}>
            {label}
            <select
              name={id}
              value={scores[id]}
              onChange={(event) => setScores((current) => ({ ...current, [id]: event.target.value }))}
            >
              <option value="">Not sure</option>
              {SCORE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        ))}
      </div>
      <fieldset className="choice-group">
        <legend>Was there a quiet place to take a break?</legend>
        <div className="choice-row">
          {[['yes', 'Yes'], ['no', 'No'], ['not-sure', 'Not sure']].map(([value, label]) => (
            <label className="choice" key={value}>
              <input
                type="radio"
                name={`quiet-${place.id}`}
                value={value}
                checked={quietSpace === value}
                onChange={() => setQuietSpace(value)}
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <label>
        Anything else? (optional)
        <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={280} rows={3} />
        <span className="field-help">Please don’t include names.</span>
      </label>
      {error && <p className="error-message" role="alert">{error}</p>}
      <div className="button-row">
        <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save report'}</button>
        <button className="button-link-secondary" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

function PlaceCard({ place, options, onReported }) {
  const [reporting, setReporting] = useState(false)
  const [message, setMessage] = useState('')
  const quietReports = place.quietSpace.yes + place.quietSpace.no

  return (
    <article className="content-card place-card">
      <div className="place-heading">
        <div>
          <h3>{place.name}</h3>
          <p className="place-type">{place.placeType}</p>
        </div>
        <span className={`source-badge ${place.origin}`}>
          {place.origin === 'example' ? 'Example place (not real)' : 'Added by a family'}
        </span>
      </div>

      {place.reportCount > 0 ? (
        <p className="place-summary">
          <strong>Calm score {place.calmScore.toFixed(1)} of 5</strong>
          {' · '}<span className="source-badge family">Reported by families</span>
          {' '}{reportWord(place.reportCount)}, latest {formatDate(place.latestReportAt)}
        </p>
      ) : (
        <p className="place-summary">
          <span className="source-badge unknown">Unknown</span> No reports yet.
        </p>
      )}
      {place.reportCount > 0 && place.reportCount < options.fewReports && (
        <p className="field-help">Only {reportWord(place.reportCount)} so far.</p>
      )}
      {place.outdated && (
        <p className="info-note">These reports are over a year old.</p>
      )}

      <dl className="place-categories">
        {place.categories.map((category) => (
          <div key={category.id}>
            <dt>{category.label}</dt>
            <dd>
              {category.reports > 0
                ? <><strong>{category.summary}</strong> · average {category.average.toFixed(1)} of 5 · {reportWord(category.reports)}</>
                : <span className="unknown-text">Unknown</span>}
            </dd>
          </div>
        ))}
        <div>
          <dt>Quiet place for a break</dt>
          <dd>
            {quietReports > 0
              ? <><strong>{place.quietSpace.yes} of {quietReports}</strong> {quietReports === 1 ? 'family' : 'families'} found one</>
              : <span className="unknown-text">Unknown</span>}
          </dd>
        </div>
      </dl>

      {place.notes.length > 0 && (
        <section className="place-notes" aria-label={`Family observations about ${place.name}`}>
          <h4>What families said</h4>
          <ul>
            {place.notes.map((note) => (
              <li key={`${note.reportedAt}-${note.text}`}>
                “{note.text}” <span className="field-help">{formatDate(note.reportedAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="done-note" role="status">{message}</p>
      {reporting ? (
        <ReportForm
          place={place}
          categories={options.categories}
          onCancel={() => setReporting(false)}
          onSaved={(result) => {
            onReported(result.places)
            setReporting(false)
            setMessage(`✓ ${result.message}`)
          }}
        />
      ) : (
        <button
          className="button-link-secondary"
          type="button"
          onClick={() => {
            setMessage('')
            setReporting(true)
          }}
        >
          Add a report
        </button>
      )}
    </article>
  )
}

export default PlaceCard
