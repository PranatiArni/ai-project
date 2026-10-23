import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useSpeech } from '../useSpeech.js'
import StoryPicture from './StoryPicture.jsx'

export const EVERY_PLAN_REASON = 'Included in every plan'

// Shows a story one part at a time so there is less to read at once.
// The current part lives in the URL (?part=3, or ?part=end) so a refresh keeps
// the reader's place.
function StoryReader({ story, focused = false, endActions = null }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const speech = useSpeech()
  const headingRef = useRef(null)
  const hasNavigated = useRef(false)

  const total = story.pages.length
  const partParam = searchParams.get('part')
  const finished = partParam === 'end'
  const requested = Number.parseInt(partParam ?? '1', 10)
  const index = finished
    ? total - 1
    : Math.min(Math.max(Number.isNaN(requested) ? 1 : requested, 1), total) - 1
  const page = story.pages[index]
  const section = story.sections?.[index]
  const reason = section?.reason
  // Stories saved before personalization have no sections, so no pictures.
  const hasPicture = Boolean(section)
  const Heading = focused ? 'h2' : 'h3'

  // Move keyboard and screen-reader focus to the new part, but not on first load.
  useEffect(() => {
    if (hasNavigated.current) headingRef.current?.focus()
  }, [index, finished])

  function goTo(part) {
    speech.stop()
    hasNavigated.current = true
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      next.set('part', String(part))
      return next
    }, { replace: true })
  }

  if (finished) {
    return (
      <div className={focused ? 'story-reader focused' : 'story-reader'}>
        <div className="reader-part">
          <Heading ref={headingRef} tabIndex={-1}>That is the whole story</Heading>
          <p>You can read it again any time.</p>
        </div>
        <div className="reader-nav">
          <button className="button-link-secondary" type="button" onClick={() => goTo(1)}>
            Read again from the start
          </button>
          {endActions}
        </div>
      </div>
    )
  }

  return (
    <div className={focused ? 'story-reader focused' : 'story-reader'}>
      <p className="reader-progress">Part {index + 1} of {total}</p>
      <div className="reader-dots" aria-hidden="true">
        {story.pages.map((storyPage, dotIndex) => (
          <span
            key={storyPage.number}
            className={dotIndex === index ? 'current' : dotIndex < index ? 'seen' : undefined}
          />
        ))}
      </div>

      {speech.supported && (
        <div className="speech-controls">
          {speech.status === 'idle' && (
            <button
              className="button-link-secondary"
              type="button"
              onClick={() => speech.speak([page.title, ...page.sentences].filter(Boolean).join(' '))}
            >
              <StoryPicture sectionId="sound" className="button-icon" /> Read this part aloud
            </button>
          )}
          {speech.status === 'speaking' && (
            <button className="button-link-secondary" type="button" onClick={speech.pause}>Pause</button>
          )}
          {speech.status === 'paused' && (
            <button className="button-link-secondary" type="button" onClick={speech.resume}>Resume</button>
          )}
          {speech.status !== 'idle' && (
            <button className="button-link-secondary" type="button" onClick={speech.stop}>Stop</button>
          )}
          <span className="visually-hidden" role="status">
            {speech.status === 'speaking' ? 'Reading aloud' : speech.status === 'paused' ? 'Reading paused' : ''}
          </span>
        </div>
      )}

      <div className={hasPicture ? 'reader-part has-picture' : 'reader-part'}>
        {hasPicture && <StoryPicture sectionId={section.id} visitType={story.visitType} />}
        <div className="reader-words">
          <Heading ref={headingRef} tabIndex={-1}>{page.title ?? `Part ${index + 1}`}</Heading>
          {!focused && reason && reason !== EVERY_PLAN_REASON && (
            <p className="step-reason">{reason}</p>
          )}
          {!focused && section?.edited && <p className="step-reason edited">You edited this part</p>}
          {index === 0 && story.photos.length > 0 && (
            <div className="photo-gallery">
              {story.photos.map((photo, photoIndex) => (
                <img
                  key={`${story.id}-${photo.name}`}
                  src={photo.dataUrl}
                  alt={`Photo ${photoIndex + 1} of ${story.photos.length} of the place, added by your family`}
                />
              ))}
            </div>
          )}
          {page.sentences.map((sentence, sentenceIndex) => (
            <p key={`${page.number}-${sentenceIndex}`}>{sentence}</p>
          ))}
          {section?.items && (
            <ul className="support-pictures">
              {section.items.map((item) => (
                <li key={item.label}>
                  <StoryPicture name={item.supportId ?? 'custom'} className="support-picture" />
                  {item.label}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="reader-nav">
        <button
          className="button-link-secondary"
          type="button"
          onClick={() => goTo(index)}
          disabled={index === 0}
        >
          <span aria-hidden="true">←</span> Back
        </button>
        <button type="button" onClick={() => goTo(index + 1 < total ? index + 2 : 'end')}>
          {index + 1 < total ? 'Next' : 'Finish'} <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  )
}

export default StoryReader
