import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AnimatePresence, motion } from 'framer-motion'
import { lazy, Suspense } from 'react'
import Navigation from './components/Navigation'
import Home from './pages/Home'
import { useAutoSync } from './hooks/useAutoSync'

// ── Lazy-loaded pages (chargées uniquement à la première visite) ──────────────
const Study        = lazy(() => import('./pages/Study'))
const Import       = lazy(() => import('./pages/Import'))
const Stats        = lazy(() => import('./pages/Stats'))
const Achievements = lazy(() => import('./pages/Achievements'))
const Agent        = lazy(() => import('./pages/Agent'))

// ── Spinner affiché pendant le chargement d'une page lazy ─────────────────────
function PageLoader() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 flex items-center justify-center"
    >
      <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </motion.div>
  )
}

function AppRoutes() {
  const location = useLocation()
  const hideNav = location.pathname === '/study'

  // Synchronisation automatique en arrière-plan (n8n → API → app)
  useAutoSync()

  return (
    <>
      <Suspense fallback={<PageLoader />}>
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/"            element={<Home />} />
            <Route path="/study"       element={<Study />} />
            <Route path="/import"      element={<Import />} />
            <Route path="/stats"       element={<Stats />} />
            <Route path="/achievements" element={<Achievements />} />
            <Route path="/agent"       element={<Agent />} />
          </Routes>
        </AnimatePresence>
      </Suspense>
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
