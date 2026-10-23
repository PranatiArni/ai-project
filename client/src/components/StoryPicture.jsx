// Simple line drawings for story parts and supports, in the style of picture
// schedule symbols. All are drawn on a 64 x 64 grid with the current text color.

const drawings = {
  // Story parts
  'getting-ready': (
    <>
      <rect x="16" y="20" width="32" height="36" rx="8" />
      <path d="M26 20v-4a6 6 0 0 1 12 0v4" />
      <rect x="22" y="36" width="20" height="12" rx="3" />
      <path d="M22 30h20" />
    </>
  ),
  arriving: (
    <>
      <rect x="20" y="8" width="24" height="48" rx="2" />
      <circle cx="38" cy="34" r="2" fill="currentColor" />
      <path d="M10 56h44" />
    </>
  ),
  sound: (
    <>
      <path d="M10 26h8l10-9v30l-10-9h-8z" />
      <path d="M36 25a9 9 0 0 1 0 14" />
      <path d="M42 19a17 17 0 0 1 0 26" />
      <path d="M48 13a25 25 0 0 1 0 38" />
    </>
  ),
  lighting: (
    <>
      <circle cx="32" cy="32" r="10" />
      <path d="M32 8v7M32 49v7M8 32h7M49 32h7M15 15l5 5M44 44l5 5M49 15l-5 5M15 49l5-5" />
    </>
  ),
  crowds: (
    <>
      <circle cx="18" cy="24" r="6" />
      <circle cx="46" cy="24" r="6" />
      <circle cx="32" cy="20" r="7" />
      <path d="M8 50a10 10 0 0 1 18-6M56 50a10 10 0 0 0-18-6" />
      <path d="M20 54a12 12 0 0 1 24 0" />
    </>
  ),
  waiting: (
    <>
      <circle cx="32" cy="32" r="22" />
      <path d="M32 18v14l9 6" />
    </>
  ),
  supports: (
    <>
      <rect x="12" y="24" width="40" height="30" rx="6" />
      <path d="M24 24v-5a8 8 0 0 1 16 0v5" />
      <path d="M32 46c-6-4-8-7-8-10a4 4 0 0 1 8-1 4 4 0 0 1 8 1c0 3-2 6-8 10z" />
    </>
  ),
  'taking-a-break': (
    <>
      <path d="M16 30V20a6 6 0 0 1 6-6h20a6 6 0 0 1 6 6v10" />
      <path d="M10 46V32a4 4 0 0 1 8 0v6h28v-6a4 4 0 0 1 8 0v14z" />
      <path d="M16 46v7M48 46v7" />
    </>
  ),
  leaving: (
    <>
      <path d="M10 30 32 12l22 18" />
      <path d="M16 26v28h32V26" />
      <rect x="27" y="38" width="10" height="16" />
    </>
  ),

  // "What might happen next", by kind of place
  dentist: (
    <path d="M22 12c-6 0-10 5-10 12 0 8 4 13 6 23 1 6 6 6 7 0l3-9c1-3 7-3 8 0l3 9c1 6 6 6 7 0 2-10 6-15 6-23 0-7-4-12-10-12-4 0-6 2-10 2s-6-2-10-2z" />
  ),
  doctor: (
    <>
      <path d="M18 10v14a10 10 0 0 0 20 0V10" />
      <path d="M28 34v6a10 10 0 0 0 20 0v-2" />
      <circle cx="48" cy="34" r="4" />
    </>
  ),
  'hair-salon': (
    <>
      <circle cx="20" cy="46" r="7" />
      <circle cx="44" cy="46" r="7" />
      <path d="M25 41 44 10M39 41 20 10" />
    </>
  ),
  'grocery-store': (
    <>
      <path d="M6 12h8l6 30h28l6-20H17" />
      <circle cx="24" cy="51" r="4" />
      <circle cx="44" cy="51" r="4" />
    </>
  ),
  restaurant: (
    <>
      <circle cx="32" cy="34" r="13" />
      <circle cx="32" cy="34" r="7" />
      <path d="M10 12v40M6 12v8a4 4 0 0 0 8 0v-8" />
      <path d="M54 52V12c-5 3-5 15 0 18" />
    </>
  ),
  'theme-park': (
    <>
      <circle cx="32" cy="28" r="18" />
      <path d="M32 10v36M14 28h36M19 15l26 26M45 15 19 41" />
      <path d="M26 46l-6 12M38 46l6 12M14 58h36" />
    </>
  ),
  library: (
    <>
      <path d="M32 18c-6-4-16-4-22-2v34c6-2 16-2 22 2 6-4 16-4 22-2V16c-6-2-16-2-22 2z" />
      <path d="M32 18v34" />
    </>
  ),
  other: (
    <>
      <path d="M32 56S14 39 14 26a18 18 0 0 1 36 0c0 13-18 30-18 30z" />
      <circle cx="32" cy="26" r="6" />
    </>
  ),

  // Supports
  headphones: (
    <>
      <path d="M14 38v-6a18 18 0 0 1 36 0v6" />
      <rect x="10" y="36" width="10" height="16" rx="4" />
      <rect x="44" y="36" width="10" height="16" rx="4" />
    </>
  ),
  sunglasses: (
    <>
      <rect x="8" y="26" width="20" height="14" rx="6" />
      <rect x="36" y="26" width="20" height="14" rx="6" />
      <path d="M28 31c3-3 5-3 8 0M8 30l-3-7M56 30l3-7" />
    </>
  ),
  'comfort-item': (
    <>
      <circle cx="32" cy="36" r="15" />
      <circle cx="20" cy="20" r="6" />
      <circle cx="44" cy="20" r="6" />
      <circle cx="27" cy="33" r="1.5" fill="currentColor" />
      <circle cx="37" cy="33" r="1.5" fill="currentColor" />
      <path d="M28 41c2 2 6 2 8 0" />
    </>
  ),
  fidget: (
    <>
      <circle cx="32" cy="18" r="7" />
      <circle cx="19" cy="41" r="7" />
      <circle cx="45" cy="41" r="7" />
      <circle cx="32" cy="33" r="4" />
    </>
  ),
  timer: (
    <>
      <path d="M18 8h28M18 56h28" />
      <path d="M22 8c0 12 9 16 9 24s-9 12-9 24" />
      <path d="M42 8c0 12-9 16-9 24s9 12 9 24" />
      <path d="M25 52l7-6 7 6z" fill="currentColor" />
    </>
  ),
  'visual-schedule': (
    <>
      <rect x="12" y="8" width="40" height="48" rx="4" />
      <rect x="18" y="16" width="8" height="8" rx="1" />
      <rect x="18" y="28" width="8" height="8" rx="1" />
      <rect x="18" y="40" width="8" height="8" rx="1" />
      <path d="M31 20h15M31 32h15M31 44h15" />
    </>
  ),
  'break-signal': (
    <>
      <rect x="14" y="10" width="36" height="44" rx="5" />
      <path d="M28 24v16M36 24v16" />
    </>
  ),
  snack: (
    <>
      <path d="M32 22c-12-6-21 4-19 15 2 11 10 19 19 15 9 4 17-4 19-15 2-11-7-21-19-15z" />
      <path d="M32 22c0-6 2-9 7-11" />
    </>
  ),
  custom: (
    <path d="m32 10 6 14 15 1-11 10 4 15-14-8-14 8 4-15-11-10 15-1z" />
  ),
}

// Picture for a story part. The visit type decides the "what might happen" picture.
function pictureForSection(sectionId, visitType) {
  if (sectionId === 'what-might-happen') return drawings[visitType] ? visitType : 'other'
  return drawings[sectionId] ? sectionId : null
}

// Pass `name` for a support picture, or `sectionId` (and `visitType`) for a
// story part. Decorative: the words beside each picture say the same thing, so
// screen readers skip the drawing.
function StoryPicture({ name, sectionId, visitType, className = 'story-picture' }) {
  const drawing = drawings[name ?? pictureForSection(sectionId, visitType)] ?? drawings.custom
  return (
    <span className={className} aria-hidden="true">
      <svg
        viewBox="0 0 64 64"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {drawing}
      </svg>
    </span>
  )
}

export default StoryPicture
