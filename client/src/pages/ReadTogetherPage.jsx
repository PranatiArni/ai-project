import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import StoryReader from '../components/StoryReader.jsx'
import { requestJson } from '../api.js'

// A quiet view with only the story, one part at a time, in larger text.
function ReadTogetherPage() {
  const { storyId } = useParams()
  const [story, setStory] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    requestJson(`/api/stories/${storyId}`)
      .then(setStory)
      .catch((loadError) => setError(loadError.message))
      .finally(() => setLoading(false))
  }, [storyId])

  if (loading) return <p className="page-section">Loading the story…</p>
  if (error) {
    return (
      <section className="page-section">
        <p className="error-message" role="alert">{error}</p>
        <Link to="/stories">Back to saved plans</Link>
      </section>
    )
  }

  return (
    <section className="page-section read-together">
      <p><Link to={`/stories/${story.id}`}>Back to the plan</Link></p>
      <h1>{story.title}</h1>
      <StoryReader
        story={story}
        focused
        endActions={<Link className="button-link" to={`/stories/${story.id}`}>Back to the plan</Link>}
      />
    </section>
  )
}

export default ReadTogetherPage
