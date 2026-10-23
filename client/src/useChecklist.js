import { useState } from 'react'
import { requestJson } from './api.js'

// Ticks checklist items on and off, saving each change to the server.
// The change shows immediately and is undone if the save fails. Only one item
// saves at a time because the server receives the whole checklist.
export function useChecklist(story, setStory) {
  const [savingId, setSavingId] = useState('')
  const [error, setError] = useState('')

  async function toggle(itemId) {
    const previousChecklist = story.checklist
    const nextChecklist = previousChecklist.map((item) => (
      item.id === itemId ? { ...item, completed: !item.completed } : item
    ))
    setStory((current) => ({ ...current, checklist: nextChecklist }))
    setSavingId(itemId)
    setError('')
    try {
      const result = await requestJson(`/api/stories/${story.id}/checklist`, {
        method: 'PATCH',
        body: JSON.stringify({
          checklist: nextChecklist.map(({ id, completed }) => ({ id, completed })),
        }),
      })
      setStory((current) => ({ ...current, checklist: result.checklist }))
    } catch (saveError) {
      setStory((current) => ({ ...current, checklist: previousChecklist }))
      setError(`That change was not saved. ${saveError.message}`)
    } finally {
      setSavingId('')
    }
  }

  return { toggle, savingId, error }
}
