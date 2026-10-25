import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import ChecklistItem from '../components/ChecklistItem.jsx'
import ReflectionSection from '../components/ReflectionSection.jsx'
import StoryEditor from '../components/StoryEditor.jsx'
import StoryPicture from '../components/StoryPicture.jsx'
import StoryReader, { EVERY_PLAN_REASON } from '../components/StoryReader.jsx'
import { requestJson } from '../api.js'
import { useChecklist } from '../useChecklist.js'

const PHASES = [
  { id: 'before', label: 'Before the visit' },
  { id: 'during', label: 'During the visit' },
  { id: 'after', label: 'Afterward' },
]


// Describes the choices a plan was built from, using the labels the form showed.
function describeProfile(profile, options) {
  if (!profile || !options) return null
  const levelLabel = (id) => options.concernLevels.find((level) => level.id === id)?.label.toLowerCase()
  const areas = options.sensoryAreas
    .filter((area) => profile[area.id] && profile[area.id] !== 'not-a-concern')
    .map((area) => `${area.label} (${levelLabel(profile[area.id])})`)
  const supports = [
    ...options.supports.filter((support) => profile.supports.includes(support.id)).map((support) => support.label),
    ...profile.customSupports,
  ]
  const detail = options.detailLevels.find((level) => level.id === profile.detailLevel)?.label.split(' — ')[0]
  return { areas, supports, detail }
}

function StoryPage() {
  const { storyId } = useParams()
  const [searchParams] = useSearchParams()
  const [story, setStory] = useState(null)
  const [options, setOptions] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [savedMessage, setSavedMessage] = useState('')
  const checklist = useChecklist(story, setStory)

  useEffect(() => {
    requestJson(`/api/stories/${storyId}`)
      .then(setStory)
      .catch((loadError) => setError(loadError.message))
      .finally(() => setLoading(false))
    // Labels for the "made for your choices" summary; the page still works without them.
    requestJson('/api/plan-options').then(setOptions).catch(() => {})
  }, [storyId])

  if (loading) return <p className="page-section">Loading your plan…</p>
  if (error) {
    return (
      <section className="page-section">
        <p className="error-message" role="alert">{error}</p>
        <Link to="/stories">Back to saved plans</Link>
      </section>
    )
  }

  const choices = describeProfile(story.profile, options)
  const completed = story.checklist.filter((step) => step.completed).length
  const hasPhases = story.checklist.some((step) => step.phase)
  const checklistGroups = hasPhases
    ? PHASES.map((phase) => ({
      ...phase,
      steps: story.checklist.filter((step) => step.phase === phase.id),
    })).filter((group) => group.steps.length > 0)
    : [{ id: 'all', label: null, steps: story.checklist }]

  return (
    <article className="page-section plan-page">
      <header className="plan-header">
        <p className="eyebrow">
          {story.placeType}
          {story.nickname ? ` · Prepared for ${story.nickname}` : ''}
        </p>
        <h1>{story.title}</h1>
        <p className="plan-meta">
          Saved {new Date(story.createdAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
          {' · '}
          {completed} of {story.checklist.length} checklist steps done
        </p>
        <div className="button-row plan-actions">
          <Link className="button-link" to={`/trip/${story.id}`}>
            {story.journey ? 'Open the steps for the day' : 'Open the checklist'}
          </Link>
          <button className="button-link-secondary" type="button" onClick={() => window.print()}>
            Print plan
          </button>
        </div>
      </header>

      {story.generalInfoNotice && (
        <p className="info-note">
          <strong>Good to know: </strong> {story.generalInfoNotice}
        </p>
      )}

      {story.previousVisit && (
        <section className="previous-visit" aria-labelledby="previous-visit-heading">
          <h2 id="previous-visit-heading">From your last visit</h2>
          <p className="field-help">
            From{' '}
            <Link to={`/stories/${story.previousVisit.fromStoryId}`}>{story.previousVisit.title}</Link>,
            saved {new Date(story.previousVisit.reflectedAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}.
          </p>
          <dl className="reflection-summary">
            {story.previousVisit.changeNextTime && (
              <div>
                <dt>Change this time</dt>
                <dd className="pre-wrap">{story.previousVisit.changeNextTime}</dd>
              </div>
            )}
            {story.previousVisit.notesForNextVisit && (
              <div>
                <dt>Notes</dt>
                <dd className="pre-wrap">{story.previousVisit.notesForNextVisit}</dd>
              </div>
            )}
          </dl>
        </section>
      )}

      {choices && (
        <section className="choices-summary" aria-labelledby="choices-heading">
          <div className="story-panel-heading">
            <h2 id="choices-heading">Your answers</h2>
            <Link className="screen-only" to={`/stories/${story.id}/preferences`}>Change preferences</Link>
          </div>
          <dl>
            <div>
              <dt>Hard for your child</dt>
              <dd>{choices.areas.length > 0 ? choices.areas.join(', ') : 'Nothing marked'}</dd>
            </div>
            <div>
              <dt>Things that help</dt>
              <dd>{choices.supports.length > 0 ? choices.supports.join(', ') : 'None'}</dd>
            </div>
            {choices.detail && (
              <div>
                <dt>Story length</dt>
                <dd>{choices.detail}</dd>
              </div>
            )}
          </dl>
        </section>
      )}

      <div className="plan-layout">
        <section className="story-panel" aria-labelledby="story-heading">
          <div className="story-panel-heading">
            <h2 id="story-heading">The story</h2>
            {!editing && (
              <div className="story-panel-links">
                <Link to={`/stories/${story.id}/read`}>Open reading view</Link>
                {story.sections ? (
                  <button
                    className="button-link-secondary"
                    type="button"
                    onClick={() => {
                      setSavedMessage('')
                      setEditing(true)
                    }}
                  >
                    Edit wording
                  </button>
                ) : (
                  // Stories from before personalization can be rebuilt to get
                  // pictures, editing, and a visit journey.
                  <Link to={`/stories/${story.id}/preferences`}>Update this plan</Link>
                )}
              </div>
            )}
          </div>
          <p className="done-note screen-only" role="status">{savedMessage}</p>
          {editing ? (
            <StoryEditor
              story={story}
              onCancel={() => setEditing(false)}
              onSaved={(updated) => {
                setStory(updated)
                setEditing(false)
                setSavedMessage('✓ Saved.')
              }}
            />
          ) : (
            <>
              <p className="field-help screen-only">Read it together as many times as you like.</p>
              <StoryReader story={story} />
            </>
          )}
          {/* The whole story at once, shown only when printing. */}
          <ol className="story-steps story-print">
            {story.pages.map((page, pageIndex) => {
              // Pages are saved in the same order as sections (sectionsToPages on the server).
              const reason = story.sections?.[pageIndex]?.reason
              return (
                <li key={page.number}>
                  {story.sections?.[pageIndex] && (
                    <StoryPicture
                      sectionId={story.sections[pageIndex].id}
                      visitType={story.visitType}
                      className="story-picture print-picture"
                    />
                  )}
                  <h3>{page.title ?? `Page ${page.number}`}</h3>
                  {reason && reason !== EVERY_PLAN_REASON && (
                    <p className="step-reason">{reason}</p>
                  )}
                  {page.sentences.map((sentence, index) => (
                    <p key={`${page.number}-${index}`}>{sentence}</p>
                  ))}
                </li>
              )
            })}
          </ol>
        </section>

        <aside className="plan-aside">
          <section aria-labelledby="checklist-heading">
            <h2 id="checklist-heading">Checklist</h2>
            {checklist.error && <p className="error-message" role="alert">{checklist.error}</p>}
            {checklistGroups.map((group) => (
              <div key={group.id}>
                {group.label && <h3>{group.label}</h3>}
                <ul className="plan-checklist">
                  {group.steps.map((item) => (
                    <ChecklistItem key={item.id} item={item} onToggle={checklist.toggle} savingId={checklist.savingId} />
                  ))}
                </ul>
              </div>
            ))}
          </section>

          {story.questionsForVenue.length > 0 && (
            <section aria-labelledby="questions-heading">
              <h2 id="questions-heading">Questions to ask ahead of time</h2>
              <ul className="plain-list">
                {story.questionsForVenue.map((question) => <li key={question}>{question}</li>)}
              </ul>
            </section>
          )}

          {story.suggestions.length > 0 && (
            <section aria-labelledby="ideas-heading">
              <h2 id="ideas-heading">Other ideas</h2>
              <ul className="plain-list">
                {story.suggestions.map((suggestion) => <li key={suggestion.id}>{suggestion.text}</li>)}
              </ul>
              <p className="field-help">Only if they’d help.</p>
            </section>
          )}
        </aside>
      </div>

      <ReflectionSection story={story} onSaved={setStory} startOpen={searchParams.get('reflect') === '1'} />

      <p className="plan-footer-link"><Link to="/stories">Back to saved plans</Link></p>
    </article>
  )
}

export default StoryPage
