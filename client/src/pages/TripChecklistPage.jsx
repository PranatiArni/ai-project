import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { requestJson } from '../api.js'

function TripChecklistPage() {
  const { storyId } = useParams()
  const [searchParams] = useSearchParams()
  const highlightedStep = searchParams.get('step')
  const [story, setStory] = useState(null)
  const [loading, setLoading] = useState(true)
  const [savingStep, setSavingStep] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    requestJson(`/api/stories/${storyId}`)
      .then(setStory)
      .catch((loadError) => setError(loadError.message))
      .finally(() => setLoading(false))
  }, [storyId])

  async function toggleStep(stepId) {
    const previousChecklist = story.checklist
    const nextChecklist = previousChecklist.map((step) => (
      step.id === stepId ? { ...step, completed: !step.completed } : step
    ))
    setStory((current) => ({ ...current, checklist: nextChecklist }))
    setSavingStep(stepId)
    setError('')
    try {
      const result = await requestJson(`/api/stories/${story.id}/checklist`, {
        method: 'PATCH',
        body: JSON.stringify({ checklist: nextChecklist }),
      })
      setStory((current) => ({ ...current, checklist: result.checklist }))
    } catch (saveError) {
      setStory((current) => ({ ...current, checklist: previousChecklist }))
      setError(saveError.message)
    } finally {
      setSavingStep('')
    }
  }

  if (loading) return <p className="page-section">Loading trip checklist…</p>
  if (error && !story) {
    return <section className="page-section"><p className="error-message" role="alert">{error}</p></section>
  }
  if (!story) return null

  const completedCount = story.checklist.filter((step) => step.completed).length

  return (
    <section className="page-section">
      <p className="eyebrow">The day of the visit</p>
      <h1>{story.destination} checklist</h1>
      <p>{completedCount} of {story.checklist.length} steps complete</p>
      <progress value={completedCount} max={story.checklist.length}>
        {completedCount} of {story.checklist.length}
      </progress>
      {error && <p className="error-message" role="alert">{error}</p>}
      <ul className="checklist">
        {story.checklist.map((step) => (
          <li
            className={step.id === highlightedStep ? 'checklist-step highlighted' : 'checklist-step'}
            key={step.id}
          >
            <p>{step.label}</p>
            <div className="button-row">
              <button
                type="button"
                disabled={savingStep !== ''}
                onClick={() => toggleStep(step.id)}
              >
                {savingStep === step.id
                  ? 'Saving…'
                  : step.completed ? 'Mark not complete' : 'Mark complete'}
              </button>
              <Link to={`/calm-break/${story.id}?step=${encodeURIComponent(step.id)}`}>
                Calm break
              </Link>
            </div>
            {step.completed && <p role="status">Step complete!</p>}
          </li>
        ))}
      </ul>
      <Link to={`/stories/${story.id}`}>Back to the story</Link>
    </section>
  )
}

export default TripChecklistPage
