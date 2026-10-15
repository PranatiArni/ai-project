import { Link } from 'react-router-dom'

function HomePage() {
  return (
    <section className="welcome-panel">
      <p className="eyebrow">A little preparation can make a new place feel easier</p>
      <h1>Ready Together</h1>
      <p>
        Make a short story about an upcoming visit, practice the steps, and find
        places other families have rated.
      </p>
      <div className="button-row">
        <Link className="button-link" to="/create-story">Create a trip story</Link>
        <Link className="button-link button-link-secondary" to="/stories">See saved stories</Link>
      </div>
      <p className="note">
        Stories are built from your details and coping tools. No account or
        external AI service is needed.
      </p>
    </section>
  )
}

export default HomePage
