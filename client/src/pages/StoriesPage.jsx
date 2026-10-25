import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import StoryCard from '../components/StoryCard.jsx'
import { requestJson } from '../api.js'

function StoriesPage() {
  const [stories, setStories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    requestJson('/api/stories')
      .then(setStories)
      .catch((loadError) => setError(loadError.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <section className="page-section">
      <p className="eyebrow">Your plans</p>
      <h1>Saved plans</h1>
      {loading && <p>Loading your saved plans…</p>}
      {error && <p className="error-message" role="alert">{error}</p>}
      {!loading && !error && stories.length === 0 && (
        <div className="empty-state">
          <h2>No plans yet</h2>
          <p>Plans you make will show up here.</p>
          <Link className="button-link" to="/create-story">Plan your first visit</Link>
        </div>
      )}
      {stories.length > 0 && (
        <div className="card-list">
          {stories.map((story) => (
            <StoryCard
              key={story.id}
              id={story.id}
              title={story.title}
              placeType={story.placeType}
              createdAt={story.createdAt}
              checklistProgress={story.checklistProgress}
              hasReflection={story.hasReflection}
            />
          ))}
        </div>
      )}
    </section>
  )
}

export default StoriesPage
