import { useState } from 'react'
import { requestJson } from '../api.js'

const MAX_SENTENCES = 6

// Lets a caregiver change the wording of each story part, one sentence per line.
function StoryEditor({ story, onSaved, onCancel }) {
  const [drafts, setDrafts] = useState(() => story.sections.map((section) => section.sentences.join('\n')))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function updateDraft(index, value) {
    setDrafts((current) => current.map((draft, draftIndex) => (draftIndex === index ? value : draft)))
  }

  async function save(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const updated = await requestJson(`/api/stories/${story.id}/sections`, {
        method: 'PUT',
        body: JSON.stringify({
          sections: story.sections.map((section, index) => ({
            id: section.id,
            sentences: drafts[index].split('\n'),
          })),
        }),
      })
      onSaved(updated)
    } catch (saveError) {
      setError(`Your changes were not saved. ${saveError.message}`)
      setSaving(false)
    }
  }

  return (
    <form className="story-editor" onSubmit={save}>
      <p className="field-help">
        One sentence per line, up to {MAX_SENTENCES} per part.
      </p>
      {story.sections.map((section, index) => (
        <label key={section.id}>
          {section.title}
          <textarea
            value={drafts[index]}
            onChange={(event) => updateDraft(index, event.target.value)}
            rows={Math.max(3, drafts[index].split('\n').length + 1)}
          />
        </label>
      ))}
      {error && <p className="error-message" role="alert">{error}</p>}
      <div className="button-row">
        <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        <button className="button-link-secondary" type="button" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </form>
  )
}

export default StoryEditor
