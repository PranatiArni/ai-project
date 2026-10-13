import { useState } from 'react'
import { Link, Route, Routes } from 'react-router-dom'
import samplePlaces from './data/samplePlaces.json'
import PlaceCard from './components/PlaceCard.jsx'
import StoryCard from './components/StoryCard.jsx'

const sampleStories = [
  { id: 1, title: 'My First Dentist Visit', destination: 'the dentist' },
  { id: 2, title: 'A Calm Trip to the Store', destination: 'the grocery store' },
  { id: 3, title: 'Getting a Haircut', destination: 'the hair salon' },
]

const preparationSteps = [
  { id: 1, label: 'Read my story about where I am going' },
  { id: 2, label: 'Pack something that helps me feel comfortable' },
  { id: 3, label: 'Get ready to leave with my grown-up' },
]

function HomePage() {
  return (
    <>
      <h1>Welcome</h1>
      <p>Prepare for a new place one step at a time.</p>
    </>
  )
}

function StoriesPage() {
  return (
    <>
      <h1>Stories</h1>
      <p>Here are a few sample trip stories:</p>
      {sampleStories.map((story) => (
        <StoryCard
          key={story.id}
          title={story.title}
          destination={story.destination}
        />
      ))}
    </>
  )
}

function CreateStoryPage() {
  return (
    <>
      <h1>Create a story</h1>
      <p>Story details and generation will be added here.</p>
    </>
  )
}

function TripChecklistPage() {
  const [completedSteps, setCompletedSteps] = useState([])

  function toggleStepComplete(stepId) {
    setCompletedSteps((currentSteps) => {
      if (currentSteps.includes(stepId)) {
        return currentSteps.filter((completedStepId) => completedStepId !== stepId)
      }

      return [...currentSteps, stepId]
    })
  }

  return (
    <>
      <h1>Trip checklist</h1>
      <p>Tap a button when you finish a preparation step.</p>
      <ul>
        {preparationSteps.map((step) => {
          const isComplete = completedSteps.includes(step.id)

          return (
            <li key={step.id}>
              <p>{step.label}</p>
              {isComplete ? (
                <div aria-live="polite">
                  <p>Step complete!</p>
                  <Link to="/calm-break">Take a calm break</Link>
                  <button
                    type="button"
                    onClick={() => toggleStepComplete(step.id)}
                  >
                    Mark not complete
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => toggleStepComplete(step.id)}
                >
                  Mark complete
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </>
  )
}

function PlacesPage() {
  return (
    <>
      <h1>Calm places</h1>
      <p>Here are a few sample places and their calm scores:</p>
      {samplePlaces.map((place) => (
        <PlaceCard
          key={place.id}
          name={place.name}
          placeType={place.placeType}
          calmScore={place.calmScore}
        />
      ))}
    </>
  )
}

function CalmBreakPage() {
  return (
    <>
      <h1>Calm break</h1>
      <p>Breathing exercises and calming activities will go here.</p>
    </>
  )
}

function NotFoundPage() {
  return (
    <>
      <h1>Page not found</h1>
      <p>This page does not exist.</p>
      <Link to="/">Return home</Link>
    </>
  )
}

function App() {
  return (
    <>
      <header>
        <nav aria-label="Main navigation">
          <ul>
            <li><Link to="/">Home</Link></li>
            <li><Link to="/stories">Stories</Link></li>
            <li><Link to="/create-story">Create a story</Link></li>
            <li><Link to="/trip">Trip checklist</Link></li>
            <li><Link to="/calm-break">Calm break</Link></li>
            <li><Link to="/places">Calm places</Link></li>
          </ul>
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/stories" element={<StoriesPage />} />
          <Route path="/create-story" element={<CreateStoryPage />} />
          <Route path="/trip" element={<TripChecklistPage />} />
          <Route path="/calm-break" element={<CalmBreakPage />} />
          <Route path="/places" element={<PlacesPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
    </>
  )
}

export default App
