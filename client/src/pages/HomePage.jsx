import { Link } from 'react-router-dom'

const steps = [
  'Tell us where you are going and anything that can feel hard, like sudden sounds or waiting.',
  'Read a short picture story together, one part at a time.',
  'On the day, follow the visit journey step by step. A break is always an option.',
  'Afterward, note what helped, so the next plan can start from what you learned.',
]

function HomePage() {
  return (
    <section className="welcome-panel">
      <p className="eyebrow">Preparing for new places, together</p>
      <h1>Ready Together</h1>
      <p>
        Help your child get ready for an unfamiliar place, such as the dentist,
        a haircut, or a busy store. Ready Together turns your answers into a
        short picture story, a checklist, and a plan for the day.
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
        Plans are built from your answers with clear, fixed rules, not AI. No
        account is needed, and nothing is sent to outside services. Ready
        Together is a planning tool, not medical or therapy advice.
      </p>
    </section>
  )
}

export default HomePage
