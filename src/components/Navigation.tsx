import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Home, BookOpen, BarChart2, Upload, Trophy } from 'lucide-react'

const NAV_ITEMS = [
  { path: '/', icon: Home, label: 'Accueil' },
  { path: '/study', icon: BookOpen, label: 'Réviser' },
  { path: '/import', icon: Upload, label: 'Importer' },
  { path: '/stats', icon: BarChart2, label: 'Stats' },
  { path: '/achievements', icon: Trophy, label: 'Trophées' },
]

export default function Navigation() {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="bg-slate-900/95 backdrop-blur-xl border-t border-slate-700/50 px-2 pt-2 pb-1">
        <div className="flex items-center justify-around max-w-lg mx-auto">
          {NAV_ITEMS.map(item => {
            const active = location.pathname === item.path
            return (
              <motion.button
                key={item.path}
                whileTap={{ scale: 0.9 }}
                onClick={() => navigate(item.path)}
                className="relative flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-xl min-w-14"
              >
                {active && (
                  <motion.div
                    layoutId="nav-pill"
                    className="absolute inset-0 bg-indigo-600/20 rounded-xl"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <item.icon
                  size={22}
                  className={`relative z-10 transition-colors duration-200 ${active ? 'text-indigo-400' : 'text-slate-500'}`}
                />
                <span className={`relative z-10 text-xs transition-colors duration-200 ${active ? 'text-indigo-400 font-medium' : 'text-slate-500'}`}>
                  {item.label}
                </span>
              </motion.button>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
