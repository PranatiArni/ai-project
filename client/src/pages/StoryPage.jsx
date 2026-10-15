import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { requestJson } from '../api.js'

function StoryPage() {
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

  if (loading) return <p className="page-section">Loading your story…</p>
  if (error) {
    return (
      <section className="page-section">
        <p className="error-message" role="alert">{error}</p>
        <Link to="/stories">Back to saved stories</Link>
      </section>
    )
  }

  return (
    <section className="page-section">
      <p className="eyebrow">A story for {story.nickname}</p>
      <h1>{story.title}</h1>
      <p>Made for a {story.readingLevel.toLowerCase()}.</p>
      {story.photos.length > 0 && (
        <div className="photo-gallery" aria-label="Trip photos">
          {story.photos.map((photo) => (
            <figure key={`${story.id}-${photo.name}`}>
              <img src={photo.dataUrl} alt={`${photo.name}, a photo for the trip story`} />
              <figcaption>{photo.name}</figcaption>
            </figure>
          ))}
        </div>
      )}
      <div className="story-pages">
        {story.pages.map((page) => (
          <article className="story-page" key={page.number}>
            <h2>Page {page.number} of {story.pages.length}</h2>
            {page.sentences.map((sentence, index) => (
              <p key={`${page.number}-${index}`}>{sentence}</p>
            ))}
          </article>
        ))}
      </div>
      <Link className="button-link" to={`/trip/${story.id}`}>Open day-of checklist</Link>
      <p><Link to="/stories">Back to saved stories</Link></p>
    </section>
  )
}

export default StoryPage
