// Lists a reflection's "what helped" choices using that plan's own titles.
// Parts removed by a later rebuild are skipped.
export function helpedTitles(story) {
  const titles = new Map(story.reflectionChoices.helped.map((part) => [part.id, part.title]))
  return story.reflection.helped.map((id) => titles.get(id)).filter(Boolean)
}
