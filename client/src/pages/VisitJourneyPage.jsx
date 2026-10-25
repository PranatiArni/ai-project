import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import ChecklistItem from '../components/ChecklistItem.jsx'
import StoryPicture from '../components/StoryPicture.jsx'
import { requestJson } from '../api.js'
import { useChecklist } from '../useChecklist.js'

// Stories saved before personalization have a checklist but no journey.
function ChecklistOnly({ story, checklist }) {
  return (
    <section className="page-section">
      <p className="eyebrow">The day of the visit</p>
      <h1>{story.destination} checklist</h1>
      {checklist.error && <p className="error-message" role="alert">{checklist.error}</p>}
      <ul className="plan-checklist journey-checklist">
        {story.checklist.map((item) => (
          <ChecklistItem key={item.id} item={item} onToggle={checklist.toggle} savingId={checklist.savingId} />
        ))}
      </ul>
      <div className="button-row">
        <Link className="button-link button-link-secondary" to={`/calm-break/${story.id}`}>Take a break</Link>
        <Link to={`/stories/${story.id}`}>Back to the story</Link>
      </div>
    </section>
  )
}

function VisitJourneyPage() {
  const { storyId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const [story, setStory] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [savingStep, setSavingStep] = useState(false)
  const [stepError, setStepError] = useState('')
  const checklist = useChecklist(story, setStory)
  const headingRef = useRef(null)
  const hasNavigated = useRef(false)
  const stepParam = searchParams.get('step')

  useEffect(() => {
    requestJson(`/api/stories/${storyId}`)
      .then(setStory)
      .catch((error) => setLoadError(error.message))
      .finally(() => setLoading(false))
  }, [storyId])

  // Move keyboard and screen-reader focus to the step the caregiver chose.
  useEffect(() => {
    if (hasNavigated.current) headingRef.current?.focus()
  }, [stepParam])

  if (loading) return <p className="page-section">Loading the visit journey…</p>
  if (loadError) {
    return (
      <section className="page-section">
        <p className="error-message" role="alert">{loadError}</p>
        <Link to="/stories">Back to saved plans</Link>
      </section>
    )
  }
  if (!story.journey) return <ChecklistOnly story={story} checklist={checklist} />

  const steps = story.journey
  // An unknown or missing ?step= starts at the first step.
  const index = Math.max(0, steps.findIndex((step) => step.id === stepParam))
  const step = steps[index]
  const doneCount = steps.filter((journeyStep) => journeyStep.completed).length
  const stepItems = step.checklistIds
    .map((id) => story.checklist.find((item) => item.id === id))
    .filter(Boolean)

  function goTo(stepId) {
    hasNavigated.current = true
    setStepError('')
    setSearchParams({ step: stepId }, { replace: true })
  }

  async function toggleStepDone() {
    const previousJourney = story.journey
    const completed = !step.completed
    setStory((current) => ({
      ...current,
      journey: current.journey.map((journeyStep) => (
        journeyStep.id === step.id ? { ...journeyStep, completed } : journeyStep
      )),
    }))
    setSavingStep(true)
    setStepError('')
    try {
      const result = await requestJson(`/api/stories/${story.id}/journey`, {
        method: 'PATCH',
        body: JSON.stringify({ stepId: step.id, completed }),
      })
      setStory((current) => ({ ...current, journey: result.journey }))
    } catch (saveError) {
      setStory((current) => ({ ...current, journey: previousJourney }))
      setStepError(`That change was not saved. ${saveError.message}`)
    } finally {
      setSavingStep(false)
    }
  }

  return (
    <section className="page-section journey-page">
      <p className="eyebrow">On the day</p>
      <h1>{story.title}</h1>
      <p className="plan-meta">
        {doneCount} of {steps.length} done. It’s fine to skip steps.
      </p>

      <nav aria-label="Visit steps">
        <ol className="journey-stepper">
          {steps.map((journeyStep, stepIndex) => (
            <li key={journeyStep.id}>
              <button
                type="button"
                className={journeyStep.completed ? 'done' : undefined}
                aria-current={stepIndex === index ? 'step' : undefined}
                onClick={() => goTo(journeyStep.id)}
              >
                <span className="stepper-number" aria-hidden="true">
                  {journeyStep.completed ? '✓' : stepIndex + 1}
                </span>
                <span>
                  {journeyStep.title}
                  {journeyStep.completed && <span className="visually-hidden"> (done)</span>}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <article className="journey-step">
        <div className="reader-part has-picture">
          <StoryPicture sectionId={step.pictureSection} visitType={story.visitType} />
          <div className="reader-words">
            <p className="reader-progress">Step {index + 1} of {steps.length}</p>
            <h2 ref={headingRef} tabIndex={-1}>{step.title}</h2>
            {step.sentences.map((sentence) => <p key={sentence}>{sentence}</p>)}
          </div>
        </div>

        {stepItems.length > 0 && (
          <section className="journey-box" aria-labelledby="step-todo-heading">
            <h3 id="step-todo-heading">To do</h3>
            {checklist.error && <p className="error-message" role="alert">{checklist.error}</p>}
            <ul className="plan-checklist">
              {stepItems.map((item) => (
                <ChecklistItem key={item.id} item={item} onToggle={checklist.toggle} savingId={checklist.savingId} />
              ))}
            </ul>
          </section>
        )}

        {step.copingIdeas.length > 0 && (
          <section className="journey-box" aria-labelledby="step-coping-heading">
            <h3 id="step-coping-heading">If something feels hard</h3>
            <ul className="coping-list">
              {step.copingIdeas.map((idea) => (
                <li key={idea.id}>
                  <StoryPicture sectionId={idea.id} className="support-picture" />
                  <span><strong>{idea.title}.</strong> {idea.text}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="info-note">
          <strong>If this isn’t working: </strong>{step.alternative}
        </p>

        <div className="button-row journey-actions">
          <button type="button" onClick={toggleStepDone} disabled={savingStep}>
            {savingStep ? 'Saving…' : step.completed ? 'Undo' : 'Mark as done'}
          </button>
          <Link
            className="button-link button-link-secondary"
            to={`/calm-break/${story.id}?step=${encodeURIComponent(step.id)}`}
          >
            Take a break
          </Link>
          {index === steps.length - 1 && (
            <Link className="button-link button-link-secondary" to={`/stories/${story.id}?reflect=1`}>
              Note what helped
            </Link>
          )}
        </div>
        {stepError && <p className="error-message" role="alert">{stepError}</p>}
        <p className="done-note" role="status">
          {step.completed ? '✓ Done' : ''}
        </p>

        <div className="reader-nav">
          <button
            className="button-link-secondary"
            type="button"
            onClick={() => goTo(steps[index - 1].id)}
            disabled={index === 0}
          >
            <span aria-hidden="true">←</span> Back
          </button>
          {index + 1 < steps.length ? (
            <button type="button" onClick={() => goTo(steps[index + 1].id)}>
              Next <span aria-hidden="true">→</span>
            </button>
          ) : (
            <Link className="button-link" to={`/stories/${story.id}`}>Back to the plan</Link>
          )}
        </div>
      </article>

      {doneCount === steps.length && (
        <p className="success-note">
          All four steps are done. Nice work.
        </p>
      )}
      <p className="plan-footer-link"><Link to={`/stories/${story.id}`}>Back to the plan</Link></p>
    </section>
  )
}

export default VisitJourneyPage
