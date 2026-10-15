import { useState } from 'react'
import { requestJson } from '../api.js'

const ratingDimensions = [
  { name: 'noise', label: 'Noise' },
  { name: 'crowds', label: 'Crowds' },
  { name: 'waits', label: 'Waits' },
]

function PlaceCard({ place, onRated }) {
  const [ratings, setRatings] = useState({ noise: '1', crowds: '1', waits: '1' })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  function updateRating(event) {
    setRatings((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  async function submitRating(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const result = await requestJson(`/api/places/${place.id}/ratings`, {
        method: 'POST',
        body: JSON.stringify({
          noise: Number(ratings.noise),
          crowds: Number(ratings.crowds),
          waits: Number(ratings.waits),
        }),
      })
      onRated(result.places)
      setMessage(result.message)
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <article className="content-card place-card">
      <div className="place-heading">
        <div>
          <h2>{place.name}</h2>
          <p>{place.placeType}</p>
        </div>
        <p className="score">
          <strong>{place.calmScore.toFixed(1)}</strong>
          <span> / 5 calm</span>
        </p>
      </div>
      <p className="field-help">
        {place.ratingCount > 0
          ? `Based on ${place.ratingCount} family rating${place.ratingCount === 1 ? '' : 's'}.`
          : 'Sample score; no family ratings yet.'}
        {' '}For each rating, 1 is calm and 5 is very challenging.
      </p>
      <form className="rating-form" onSubmit={submitRating}>
        {ratingDimensions.map(({ name, label }) => (
          <label key={name}>
            {label}
            <select name={name} value={ratings[name]} onChange={updateRating}>
              <option value="1">1 — calm</option>
              <option value="2">2 — a little challenging</option>
              <option value="3">3 — medium</option>
              <option value="4">4 — challenging</option>
              <option value="5">5 — very challenging</option>
            </select>
          </label>
        ))}
        <button type="submit" disabled={saving}>
          {saving ? 'Saving rating…' : 'Submit rating'}
        </button>
      </form>
      {message && <p role="status">{message}</p>}
      {error && <p className="error-message" role="alert">{error}</p>}
    </article>
  )
}

export default PlaceCard
