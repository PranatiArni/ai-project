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
      <p className="eyebrow">Your library</p>
      <h1>Saved stories</h1>
      {loading && <p>Loading your saved stories…</p>}
      {error && <p className="error-message" role="alert">{error}</p>}
      {!loading && !error && stories.length === 0 && (
        <div className="empty-state">
          <h2>No stories yet</h2>
          <p>Create a story for an upcoming trip. It will be saved here.</p>
          <Link className="button-link" to="/create-story">Create your first story</Link>
        </div>
      )}
      {stories.length > 0 && (
        <div className="card-list">
          {stories.map((story) => (
            <StoryCard
              key={story.id}
              id={story.id}
              title={story.title}
              destination={story.destination}
              createdAt={story.createdAt}
            />
          ))}
        </div>
      )}
    </section>
  )
}

export default StoriesPage
