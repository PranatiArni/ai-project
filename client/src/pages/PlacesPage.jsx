import { useEffect, useState } from 'react'
import PlaceCard from '../components/PlaceCard.jsx'
import { requestJson } from '../api.js'

function AddPlaceForm({ placeTypes, onAdded, onCancel }) {
  const [name, setName] = useState('')
  const [placeType, setPlaceType] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const result = await requestJson('/api/places', {
        method: 'POST',
        body: JSON.stringify({ name, placeType }),
      })
      onAdded(result)
    } catch (saveError) {
      setError(saveError.message)
      setSaving(false)
    }
  }

  return (
    <form className="form-panel add-place-form" onSubmit={submit}>
      <label>
        Place name
        <input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={80} required />
      </label>
      <label>
        Kind of place
        <select value={placeType} onChange={(event) => setPlaceType(event.target.value)} required>
          <option value="" disabled>Choose a kind of place</option>
          {placeTypes.map((type) => <option key={type}>{type}</option>)}
        </select>
      </label>
      {error && <p className="error-message" role="alert">{error}</p>}
      <div className="button-row">
        <button type="submit" disabled={saving}>{saving ? 'Adding…' : 'Add place'}</button>
        <button className="button-link-secondary" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

function PlacesPage() {
  const [places, setPlaces] = useState([])
  const [options, setOptions] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    Promise.all([requestJson('/api/places'), requestJson('/api/place-options')])
      .then(([placeList, placeOptions]) => {
        setPlaces(placeList)
        setOptions(placeOptions)
      })
      .catch((loadError) => setError(loadError.message))
      .finally(() => setLoading(false))
  }, [])

  const familyPlaces = places.filter((place) => place.origin === 'family')
  const examplePlaces = places.filter((place) => place.origin === 'example')

  return (
    <section className="page-section places-page">
      <p className="eyebrow">Places</p>
      <h1>Places</h1>
      <p>
        See what other families noticed at a place, and share what you noticed.
      </p>

      <section className="trust-panel" aria-labelledby="trust-heading">
        <h2 id="trust-heading">About these reports</h2>
        <dl>
          <div>
            <dt><span className="source-badge family">Reported by families</span></dt>
            <dd>Shared by other families. Nobody checks them.</dd>
          </div>
          <div>
            <dt><span className="source-badge unknown">Unknown</span></dt>
            <dd>Nobody has reported on it yet.</dd>
          </div>
          <div>
            <dt><span className="source-badge example">Example place</span></dt>
            <dd>Made-up places so you can try it out.</dd>
          </div>
        </dl>
        <p className="field-help">
          Check anything important, like hours or accommodations, with the place itself. Ratings go from 1 (calm) to 5 (very hard). For the calm score, higher is calmer.
        </p>
      </section>

      {loading && <p>Loading places…</p>}
      {error && <p className="error-message" role="alert">{error}</p>}
      <p className="done-note" role="status">{message}</p>

      {!loading && !error && (
        <>
          <section aria-labelledby="family-places-heading">
            <div className="section-heading-row">
              <h2 id="family-places-heading">Places families added</h2>
              {!adding && (
                <button
                  type="button"
                  onClick={() => {
                    setMessage('')
                    setAdding(true)
                  }}
                >
                  Add a place
                </button>
              )}
            </div>
            {adding && (
              <AddPlaceForm
                placeTypes={options.placeTypes}
                onCancel={() => setAdding(false)}
                onAdded={(result) => {
                  setPlaces(result.places)
                  setAdding(false)
                  setMessage(`✓ ${result.place.name} was added.`)
                }}
              />
            )}
            {familyPlaces.length === 0 ? (
              <div className="empty-state">
                <p>No places yet. Add one your family has been to.</p>
              </div>
            ) : (
              <div className="card-list">
                {familyPlaces.map((place) => (
                  <PlaceCard key={place.id} place={place} options={options} onReported={setPlaces} />
                ))}
              </div>
            )}
          </section>

          <section aria-labelledby="example-places-heading">
            <h2 id="example-places-heading">Example places</h2>
            <p className="field-help">
              Not real places. Add a report to see how it works.
            </p>
            <div className="card-list">
              {examplePlaces.map((place) => (
                <PlaceCard key={place.id} place={place} options={options} onReported={setPlaces} />
              ))}
            </div>
          </section>
        </>
      )}
    </section>
  )
}

export default PlacesPage
