import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { readFileAsDataUrl, requestJson, splitEntries } from '../api.js'

const MAX_PHOTO_BYTES = 2 * 1024 * 1024
const ACCEPTED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']

function defaultProfile(options) {
  return {
    ...Object.fromEntries(options.sensoryAreas.map((area) => [area.id, 'not-a-concern'])),
    detailLevel: 'standard',
    supports: [],
  }
}

function StoryFormPage() {
  const navigate = useNavigate()
  const [options, setOptions] = useState(null)
  const [optionsError, setOptionsError] = useState('')
  const [form, setForm] = useState({ destination: '', visitType: '', nickname: '' })
  const [profile, setProfile] = useState(null)
  const [otherSupports, setOtherSupports] = useState('')
  const [photos, setPhotos] = useState([])
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  function loadOptions() {
    requestJson('/api/plan-options')
      .then((data) => {
        setOptions(data)
        setProfile((current) => current ?? defaultProfile(data))
      })
      .catch((loadError) => setOptionsError(loadError.message))
  }

  useEffect(() => {
    loadOptions()
  }, [])

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
      const photoData = await Promise.all(photos.map(readFileAsDataUrl))
      const story = await requestJson('/api/stories', {
        method: 'POST',
        signal: AbortSignal.timeout(25_000),
        body: JSON.stringify({
          ...form,
          profile: { ...profile, customSupports },
          photos: photoData,
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
            loadOptions()
          }}
        >
          Try again
        </button>
      </section>
    )
  }
  if (!options || !profile) return <p className="page-section">Loading planning options…</p>

  return (
    <section className="page-section">
      <p className="eyebrow">Plan a visit</p>
      <h1>Tell us about the visit</h1>
      <p>
        Only the destination and kind of place are needed. Everything else is
        optional and can make the plan fit your family better.
      </p>
      <form className="form-panel" onSubmit={submitPlan}>
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
        {photos.length > 0 && (
          <p className="field-help">Selected: {photos.map((photo) => photo.name).join(', ')}</p>
        )}
        {error && <p className="error-message" role="alert">{error}</p>}
        <button className="primary-button" type="submit" disabled={generating}>
          {generating ? 'Saving your plan…' : 'Create and save plan'}
        </button>
        <p className="note">
          Plans are saved in this app&apos;s own database. No outside services
          receive your answers.
        </p>
      </form>
    </section>
  )
}

export default StoryFormPage
