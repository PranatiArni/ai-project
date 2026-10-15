import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'

const BREATH_CYCLE_SECONDS = 12

function CalmBreakPage() {
  const { storyId } = useParams()
  const [searchParams] = useSearchParams()
  const [isBreathing, setIsBreathing] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  useEffect(() => {
    if (!isBreathing) return undefined
    const timer = window.setInterval(() => {
      setElapsedSeconds((seconds) => seconds + 1)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [isBreathing])

  const cycleSecond = elapsedSeconds % BREATH_CYCLE_SECONDS
  const breathPhase = cycleSecond < 4
    ? 'Breathe in slowly'
    : cycleSecond < 6 ? 'Hold gently' : 'Breathe out slowly'
  const breathingClass = isBreathing
    ? cycleSecond < 6
      ? 'breathing-circle breathing-in'
      : 'breathing-circle breathing-out'
    : 'breathing-circle'
  const step = searchParams.get('step')
  const returnPath = storyId
    ? `/trip/${storyId}${step ? `?step=${encodeURIComponent(step)}` : ''}`
    : '/stories'

  return (
    <section className="calm-screen">
      <p className="eyebrow">A pause is always okay</p>
      <h1>Calm break</h1>
      <p>Let your shoulders soften. You can stop or start again whenever you want.</p>
      <div className={breathingClass}>
        <span aria-live="polite">{isBreathing ? breathPhase : 'Ready when you are'}</span>
      </div>
      <button
        className="primary-button"
        type="button"
        onClick={() => setIsBreathing((current) => !current)}
      >
        {isBreathing ? 'Pause breathing exercise' : 'Start breathing exercise'}
      </button>
      <ul className="calm-options">
        <li>Notice one thing you can see.</li>
        <li>Notice one thing that feels comfortable.</li>
        <li>Ask your grown-up for help if you want it.</li>
      </ul>
      <Link className="button-link" to={returnPath}>Return to my same checklist step</Link>
    </section>
  )
}

export default CalmBreakPage
