import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { readFileAsDataUrl, requestJson, splitEntries } from '../api.js'
import { helpedTitles } from '../reflection.js'

const MAX_PHOTO_BYTES = 2 * 1024 * 1024
const ACCEPTED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']

function defaultProfile(options) {
  return {
    ...Object.fromEntries(options.sensoryAreas.map((area) => [area.id, 'not-a-concern'])),
    detailLevel: 'standard',
    supports: [],
  }
}

// Creates a new plan at /create-story. At /stories/:storyId/preferences it
// changes an existing plan's choices and rebuilds it instead.
function StoryFormPage() {
  const { storyId } = useParams()
  const navigate = useNavigate()
  const [options, setOptions] = useState(null)
  const [optionsError, setOptionsError] = useState('')
  const [existing, setExisting] = useState(null)
  const [form, setForm] = useState({ destination: '', visitType: '', nickname: '' })
  const [profile, setProfile] = useState(null)
  const [otherSupports, setOtherSupports] = useState('')
  const [photos, setPhotos] = useState([])
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  // Past visits with notes, offered only when creating a new plan.
  const [pastVisits, setPastVisits] = useState([])
  const [pastVisit, setPastVisit] = useState(null)
  const [pastVisitError, setPastVisitError] = useState('')
  const [carryNotes, setCarryNotes] = useState(false)
  const [copied, setCopied] = useState(false)

  // "Try again" adds one to this, which runs the loading effect again.
  const [loadAttempt, setLoadAttempt] = useState(0)

  useEffect(() => {
    Promise.all([
      requestJson('/api/plan-options'),
      storyId ? requestJson(`/api/stories/${storyId}`) : null,
      // The form still works if the list of past visits cannot be loaded.
      storyId ? [] : requestJson('/api/stories').catch(() => []),
    ])
      .then(([data, story, summaries]) => {
        setOptions(data)
        setPastVisits(summaries.filter((summary) => summary.hasReflection))
        if (story) {
          setExisting(story)
          setForm({
            destination: story.destination,
            visitType: story.visitType ?? '',
            nickname: story.nickname ?? '',
          })
          // Stories from before personalization have no saved profile.
          setProfile(story.profile ? { ...story.profile } : defaultProfile(data))
          setOtherSupports(story.profile?.customSupports.join(', ') ?? '')
        } else {
          setProfile((current) => current ?? defaultProfile(data))
        }
      })
      .catch((loadError) => setOptionsError(loadError.message))
  }, [storyId, loadAttempt])

  async function choosePastVisit(id) {
    setPastVisit(null)
    setPastVisitError('')
    setCarryNotes(false)
    setCopied(false)
    if (!id) return
    try {
      setPastVisit(await requestJson(`/api/stories/${id}`))
    } catch (loadError) {
      setPastVisitError(`That visit could not be loaded. ${loadError.message}`)
    }
  }

  function copyPastPreferences() {
    setProfile({ ...pastVisit.profile })
    setOtherSupports(pastVisit.profile.customSupports.join(', '))
    setCopied(true)
  }

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  function updateProfile(field, value) {
    setProfile((current) => ({ ...current, [field]: value }))
  }

  function toggleSupport(supportId) {
    setProfile((current) => ({
      ...current,
      supports: current.supports.includes(supportId)
        ? current.supports.filter((id) => id !== supportId)
        : [...current.supports, supportId],
    }))
  }

  function updatePhotos(event) {
    const selected = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (selected.length > 4) {
      setError('Choose up to four photos.')
      return
    }
    const invalidPhoto = selected.find((file) => (
      !ACCEPTED_PHOTO_TYPES.includes(file.type) || file.size > MAX_PHOTO_BYTES
    ))
    if (invalidPhoto) {
      setError('Photos must be JPEG, PNG, or WEBP files smaller than 2 MB each.')
      return
    }
    setError('')
    setPhotos(selected)
  }

  async function submitPlan(event) {
    event.preventDefault()
    setError('')
    const customSupports = splitEntries(otherSupports)
    if (customSupports.length > options.limits.maxCustomSupports) {
      setError(`Add no more than ${options.limits.maxCustomSupports} other supports.`)
      return
    }
    setGenerating(true)
    try {
      const details = { ...form, profile: { ...profile, customSupports } }
      // Rebuilding keeps the plan's saved photos, so none are sent.
      const story = existing
        ? await requestJson(`/api/stories/${existing.id}/plan`, {
          method: 'PUT',
          signal: AbortSignal.timeout(25_000),
          body: JSON.stringify(details),
        })
        : await requestJson('/api/stories', {
          method: 'POST',
          signal: AbortSignal.timeout(25_000),
          body: JSON.stringify({
            ...details,
            photos: await Promise.all(photos.map(readFileAsDataUrl)),
            carryNotesFrom: carryNotes && pastVisit ? pastVisit.id : undefined,
          }),
        })
      navigate(`/stories/${story.id}`)
    } catch (submitError) {
      setError(submitError.name === 'TimeoutError'
        ? 'Saving the plan took too long. Please try again.'
        : submitError.message)
    } finally {
      setGenerating(false)
    }
  }

  if (optionsError) {
    return (
      <section className="page-section">
        <h1>Plan a visit</h1>
        <p className="error-message" role="alert">
          The planning options could not be loaded. {optionsError}
        </p>
        <button
          type="button"
          onClick={() => {
            setOptionsError('')
            setLoadAttempt((attempt) => attempt + 1)
          }}
        >
          Try again
        </button>
      </section>
    )
  }
  if (!options || !profile) return <p className="page-section">Loading planning options…</p>

  const hasEdits = existing?.sections?.some((section) => section.edited)

  return (
    <section className="page-section">
      <p className="eyebrow">{existing ? existing.title : 'Plan a visit'}</p>
      <h1>{existing ? 'Change preferences' : 'Tell us about the visit'}</h1>
      {existing ? (
        <p>
          Saving rebuilds the story, journey, and checklist from these choices.
          Checklist ticks are kept for items that stay in the plan, and your
          photos are kept.
        </p>
      ) : (
        <p>
          Only the destination and kind of place are needed. Everything else is
          optional and can make the plan fit your family better.
        </p>
      )}
      {hasEdits && (
        <p className="info-note">
          <strong>Your wording edits will be replaced. </strong>
          You changed some of the story&apos;s wording. Rebuilding writes the story
          again from these choices, so those changes will not be kept.
        </p>
      )}
      <form className="form-panel" onSubmit={submitPlan}>
        {!existing && pastVisits.length > 0 && (
          <fieldset>
            <legend>Start from a past visit (optional)</legend>
            <p className="field-help">
              Look back at what you noted after an earlier visit. Nothing from it
              is used unless you choose it below.
            </p>
            <label>
              Past visit
              <select name="pastVisit" value={pastVisit?.id ?? ''} onChange={(event) => choosePastVisit(event.target.value)}>
                <option value="">Do not use a past visit</option>
                {pastVisits.map((visit) => (
                  <option key={visit.id} value={visit.id}>
                    {visit.title} ({new Date(visit.createdAt).toLocaleDateString()})
                  </option>
                ))}
              </select>
            </label>
            {pastVisitError && <p className="error-message" role="alert">{pastVisitError}</p>}
            {pastVisit && (
              <div className="past-visit-card">
                <dl className="reflection-summary">
                  <div>
                    <dt>What helped</dt>
                    <dd>{helpedTitles(pastVisit).join(', ') || 'Not noted'}</dd>
                  </div>
                  <div>
                    <dt>Supports used</dt>
                    <dd>{pastVisit.reflection.supportsUsed.join(', ') || 'Not noted'}</dd>
                  </div>
                  <div>
                    <dt>What to change next time</dt>
                    <dd className="pre-wrap">{pastVisit.reflection.changeNextTime || 'Not noted'}</dd>
                  </div>
                  <div>
                    <dt>Notes for a future visit</dt>
                    <dd className="pre-wrap">{pastVisit.reflection.notesForNextVisit || 'Not noted'}</dd>
                  </div>
                </dl>
                {pastVisit.profile && (
                  <div className="button-row">
                    <button className="button-link-secondary" type="button" onClick={copyPastPreferences}>
                      Copy that plan’s preferences
                    </button>
                  </div>
                )}
                <p className="done-note" role="status">
                  {copied ? '✓ Preferences copied. You can still change any of them below.' : ''}
                </p>
                <label className="choice">
                  <input
                    type="checkbox"
                    checked={carryNotes}
                    onChange={(event) => setCarryNotes(event.target.checked)}
                  />
                  Show my notes from that visit in the new plan
                </label>
              </div>
            )}
          </fieldset>
        )}
        <fieldset>
          <legend>The visit</legend>
          <label>
            Where are you going? (required)
            <input
              name="destination"
              value={form.destination}
              onChange={updateField}
              maxLength={100}
              placeholder="For example, Dr. Lee's office"
              aria-describedby="destination-help"
              required
            />
            <span className="field-help" id="destination-help">
              Write it the way you would say it out loud, such as “the dentist”
              or “Dr. Lee&apos;s office.” The story uses these exact words.
            </span>
          </label>
          <label>
            What kind of place is it? (required)
            <select name="visitType" value={form.visitType} onChange={updateField} required>
              <option value="" disabled>Choose a kind of place</option>
              {options.visitTypes.map((type) => (
                <option key={type.id} value={type.id}>{type.label}</option>
              ))}
            </select>
            <span className="field-help">
              The plan uses general information about this kind of place, not
              verified details about your destination.
            </span>
          </label>
          <label>
            A name your child likes (optional)
            <input
              name="nickname"
              value={form.nickname}
              onChange={updateField}
              maxLength={40}
              autoComplete="off"
            />
          </label>
        </fieldset>

        <fieldset>
          <legend>Sensory preferences (optional)</legend>
          <p className="field-help">
            Mark anything that can feel hard. Each choice adds matching story
            sections and checklist items. Leave the rest as “Not a concern.”
          </p>
          {options.sensoryAreas.map((area) => (
            <fieldset className="choice-group" key={area.id}>
              <legend>{area.label}</legend>
              <div className="choice-row">
                {options.concernLevels.map((level) => (
                  <label className="choice" key={level.id}>
                    <input
                      type="radio"
                      name={`area-${area.id}`}
                      value={level.id}
                      checked={profile[area.id] === level.id}
                      onChange={() => updateProfile(area.id, level.id)}
                    />
                    {level.label}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          <fieldset className="choice-group">
            <legend>How much detail should the story include?</legend>
            <div className="choice-row">
              {options.detailLevels.map((level) => (
                <label className="choice" key={level.id}>
                  <input
                    type="radio"
                    name="detailLevel"
                    value={level.id}
                    checked={profile.detailLevel === level.id}
                    onChange={() => updateProfile('detailLevel', level.id)}
                  />
                  {level.label}
                </label>
              ))}
            </div>
          </fieldset>
        </fieldset>

        <fieldset>
          <legend>Helpful supports (optional)</legend>
          <p className="field-help">
            Choose anything your family already uses. The story mentions them
            as options, and the checklist reminds you to pack them.
          </p>
          <div className="support-grid">
            {options.supports.map((support) => (
              <label className="choice" key={support.id}>
                <input
                  type="checkbox"
                  checked={profile.supports.includes(support.id)}
                  onChange={() => toggleSupport(support.id)}
                />
                {support.label}
              </label>
            ))}
          </div>
          <label>
            Other supports
            <input
              value={otherSupports}
              onChange={(event) => setOtherSupports(event.target.value)}
              placeholder="For example, a favorite book"
              aria-describedby="other-supports-help"
            />
            <span className="field-help" id="other-supports-help">
              Up to {options.limits.maxCustomSupports}, separated by commas.
            </span>
          </label>
        </fieldset>

        {!existing && (
          <label>
            Photos of the place (optional)
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={updatePhotos}
            />
            <span className="field-help">Choose up to four JPEG, PNG, or WEBP images, smaller than 2 MB each.</span>
          </label>
        )}
        {photos.length > 0 && (
          <p className="field-help">Selected: {photos.map((photo) => photo.name).join(', ')}</p>
        )}
        {error && <p className="error-message" role="alert">{error}</p>}
        <div className="button-row">
          <button className="primary-button" type="submit" disabled={generating}>
            {generating
              ? 'Saving your plan…'
              : existing ? 'Save and rebuild plan' : 'Create and save plan'}
          </button>
          {existing && <Link to={`/stories/${existing.id}`}>Cancel</Link>}
        </div>
        <p className="note">
          Plans are saved in this app&apos;s own database. No outside services
          receive your answers.
        </p>
      </form>
    </section>
  )
}

export default StoryFormPage
