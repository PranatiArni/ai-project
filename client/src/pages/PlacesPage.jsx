import { useEffect, useState } from 'react'
import PlaceCard from '../components/PlaceCard.jsx'
import { requestJson } from '../api.js'

function PlacesPage() {
  const [places, setPlaces] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    requestJson('/api/places')
      .then(setPlaces)
      .catch((loadError) => setError(loadError.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <section className="page-section">
      <p className="eyebrow">Family-rated places</p>
      <h1>Calm places</h1>
      <p>Lower noise, crowd, and wait ratings contribute to a higher calm score.</p>
      {loading && <p>Loading places…</p>}
      {error && <p className="error-message" role="alert">{error}</p>}
      {!loading && !error && places.length === 0 && (
        <div className="empty-state">
          <h2>No places to show yet</h2>
          <p>Places will appear here when they are added.</p>
        </div>
      )}
      <div className="card-list">
        {places.map((place) => (
          <PlaceCard key={place.id} place={place} onRated={setPlaces} />
        ))}
      </div>
    </section>
  )
}

export default PlacesPage
