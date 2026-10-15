import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { readFileAsDataUrl, requestJson, splitEntries } from '../api.js'

const MAX_PHOTO_BYTES = 2 * 1024 * 1024
const ACCEPTED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']

function StoryFormPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    destination: '',
    placeType: 'Dentist',
    nickname: '',
    readingLevel: 'Early reader',
    triggers: '',
    copingTools: '',
  })
  const [photos, setPhotos] = useState([])
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
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

  async function submitStory(event) {
    event.preventDefault()
    setError('')
    setGenerating(true)
    try {
      const photoData = await Promise.all(photos.map(readFileAsDataUrl))
      const story = await requestJson('/api/stories', {
        method: 'POST',
        signal: AbortSignal.timeout(25_000),
        body: JSON.stringify({
          ...form,
          triggers: splitEntries(form.triggers),
          copingTools: splitEntries(form.copingTools),
          photos: photoData,
        }),
      })
      navigate(`/stories/${story.id}`)
    } catch (submitError) {
      setError(submitError.name === 'TimeoutError'
        ? 'Story creation took too long. Please try again.'
        : submitError.message)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <section className="page-section">
      <p className="eyebrow">Create a visit story</p>
      <h1>Tell us about the trip</h1>
      <p>Use a few words for each trigger or coping tool. Separate items with commas or new lines.</p>
      <form className="form-panel" onSubmit={submitStory}>
        <label>
          Where are you going?
          <input
            name="destination"
            value={form.destination}
            onChange={updateField}
            maxLength={100}
            placeholder="For example, the dentist"
            required
          />
        </label>
        <label>
          What kind of place is it?
          <select name="placeType" value={form.placeType} onChange={updateField}>
            <option>Dentist</option>
            <option>Hair salon</option>
            <option>Grocery store</option>
            <option>Theme park</option>
            <option>Restaurant</option>
            <option>Other place</option>
          </select>
        </label>
        <label>
          Child&apos;s nickname
          <input
            name="nickname"
            value={form.nickname}
            onChange={updateField}
            maxLength={40}
            placeholder="A name your child likes"
            required
          />
        </label>
        <label>
          Reading level
          <select name="readingLevel" value={form.readingLevel} onChange={updateField}>
            <option>Early reader</option>
            <option>Beginning reader</option>
            <option>Independent reader</option>
          </select>
        </label>
        <label>
          Things that may feel hard (optional)
          <textarea
            name="triggers"
            value={form.triggers}
            onChange={updateField}
            placeholder={'Loud sounds\nWaiting in line\nBright lights'}
            rows={4}
          />
          <span className="field-help">Up to 21 items; each one is paired with a coping tool in the story.</span>
        </label>
        <label>
          Coping tools (at least one)
          <textarea
            name="copingTools"
            value={form.copingTools}
            onChange={updateField}
            placeholder={'Headphones\nA favorite toy\nAsking for a quiet break'}
            rows={4}
            required
          />
        </label>
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
          {generating ? 'Making your story…' : 'Create and save story'}
        </button>
      </form>
    </section>
  )
}

export default StoryFormPage
