import { Link, Route, Routes } from 'react-router-dom'
import CalmBreakPage from './pages/CalmBreakPage.jsx'
import HomePage from './pages/HomePage.jsx'
import PlacesPage from './pages/PlacesPage.jsx'
import ReadTogetherPage from './pages/ReadTogetherPage.jsx'
import StoriesPage from './pages/StoriesPage.jsx'
import StoryFormPage from './pages/StoryFormPage.jsx'
import StoryPage from './pages/StoryPage.jsx'
import VisitJourneyPage from './pages/VisitJourneyPage.jsx'
import './App.css'

function NotFoundPage() {
  return (
    <section className="page-section empty-state">
      <h1>Page not found</h1>
      <p>That page is not here. You can return to the home page.</p>
      <Link className="button-link" to="/">Return home</Link>
    </section>
  )
}

function App() {
  return (
    <div className="app-shell">
      <header className="site-header">
        <Link className="brand" to="/">Ready Together</Link>
        <nav aria-label="Main navigation">
          <Link to="/">Home</Link>
          <Link to="/stories">Stories</Link>
          <Link to="/create-story">Create a story</Link>
          <Link to="/places">Calm places</Link>
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/stories" element={<StoriesPage />} />
          <Route path="/stories/:storyId" element={<StoryPage />} />
          <Route path="/stories/:storyId/read" element={<ReadTogetherPage />} />
          <Route path="/create-story" element={<StoryFormPage />} />
          <Route path="/trip" element={<StoriesPage />} />
          <Route path="/trip/:storyId" element={<VisitJourneyPage />} />
          <Route path="/calm-break" element={<CalmBreakPage />} />
          <Route path="/calm-break/:storyId" element={<CalmBreakPage />} />
          <Route path="/places" element={<PlacesPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      <footer>
        <p>Take your time. Every small step counts.</p>
      </footer>
    </div>
  )
}

export default App
