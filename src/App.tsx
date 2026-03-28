import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AnimatePresence } from 'framer-motion'
import Navigation from './components/Navigation'
import Home from './pages/Home'
import Study from './pages/Study'
import Import from './pages/Import'
import Stats from './pages/Stats'
import Achievements from './pages/Achievements'
import Agent from './pages/Agent'
import { useAutoSync } from './hooks/useAutoSync'

function AppRoutes() {
  const location = useLocation()
  const hideNav = location.pathname === '/study'

  // Synchronisation automatique en arrière-plan (n8n → API → app)
  useAutoSync()

  return (
    <>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<Home />} />
          <Route path="/study" element={<Study />} />
          <Route path="/import" element={<Import />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/achievements" element={<Achievements />} />
          <Route path="/agent" element={<Agent />} />
        </Routes>
      </AnimatePresence>
      {!hideNav && <Navigation />}
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: '#1e1e2e',
            color: '#fff',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            borderRadius: '12px',
            fontSize: '14px',
          },
          success: {
            iconTheme: { primary: '#6366f1', secondary: '#fff' },
          },
        }}
      />
      <AppRoutes />
    </BrowserRouter>
  )
}
