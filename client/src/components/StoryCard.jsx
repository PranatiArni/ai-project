import { Link } from 'react-router-dom'

function StoryCard({ id, title, destination, createdAt }) {
  return (
    <article className="content-card">
      <h2>{title}</h2>
      <p>Destination: {destination}</p>
      {createdAt && <p className="field-help">Saved {new Date(createdAt).toLocaleString()}</p>}
      <Link to={`/stories/${id}`}>Read story</Link>
    </article>
  )
}

export default StoryCard
