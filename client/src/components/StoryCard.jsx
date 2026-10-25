import { Link } from 'react-router-dom'

function StoryCard({ id, title, placeType, createdAt, checklistProgress, hasReflection }) {
  return (
    <article className="content-card">
      <h2>{title}</h2>
      <p className="place-type">{placeType}</p>
      <p className="field-help">
        Saved {new Date(createdAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
        {checklistProgress && ` · ${checklistProgress.completed} of ${checklistProgress.total} checklist steps done`}
        {hasReflection && ' · Has notes'}
      </p>
      <Link to={`/stories/${id}`}>Open plan</Link>
    </article>
  )
}

export default StoryCard
