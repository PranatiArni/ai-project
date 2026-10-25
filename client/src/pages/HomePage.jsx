import { Link } from 'react-router-dom'

const steps = [
  'Tell us where you’re going and what’s hard for your child.',
  'Read the picture story together.',
  'On the day, go through it step by step. Take a break whenever you need one.',
  'Afterward, write down what helped for next time.',
]

function HomePage() {
  return (
    <section className="welcome-panel">
      <p className="eyebrow">Getting ready for new places</p>
      <h1>Ready Together</h1>
      <p>
        Going to the dentist, getting a haircut, or heading to a busy store? Answer a few questions and get a picture story, a checklist, and a plan for the day, made for your child.
      </p>
      <div className="button-row">
        <Link className="button-link" to="/create-story">Plan a visit</Link>
        <Link className="button-link button-link-secondary" to="/stories">See saved plans</Link>
      </div>
      <h2 className="home-steps-heading">How it works</h2>
      <ol className="home-steps">
        {steps.map((step) => <li key={step}>{step}</li>)}
      </ol>
      <p className="note">
        No account needed, and your plans stay in the app. This isn’t medical advice.
      </p>
    </section>
  )
}

export default HomePage
