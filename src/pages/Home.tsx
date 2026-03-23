import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Zap, Flame, Target, BookOpen, ChevronRight, Star, TrendingUp, Clock } from 'lucide-react'
import { db, getOrCreateProgress, getDueCards, updateProgress } from '../lib/db'
import { UserProgress, Flashcard } from '../lib/types'
import { levelFromXP, xpProgress, xpForLevel } from '../lib/srs'
import { isToday, isTomorrow, formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'

const LEVEL_NAMES: Record<number, string> = {
  1: 'Débutant', 2: 'Apprenant', 3: 'Curieux', 4: 'Studieux', 5: 'Appliqué',
  6: 'Avancé', 7: 'Expert', 8: 'Maître', 9: 'Grand Maître', 10: 'Érudit',
}
function levelName(level: number): string {
  return LEVEL_NAMES[level] ?? (level <= 15 ? 'Savant' : level <= 20 ? 'Sage' : 'Légende')
}

export default function Home() {
  const navigate = useNavigate()
  const [progress, setProgress] = useState<UserProgress | null>(null)
  const [dueCount, setDueCount] = useState(0)
  const [totalCards, setTotalCards] = useState(0)
  const [todayReviewed, setTodayReviewed] = useState(0)
  const [recentCards, setRecentCards] = useState<Flashcard[]>([])

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const prog = await getOrCreateProgress()

    // Update streak
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (prog.lastStudyDate) {
      const last = new Date(prog.lastStudyDate)
      last.setHours(0, 0, 0, 0)
      const diffDays = Math.round((today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24))
      if (diffDays === 1) {
        // Yesterday – continue streak
      } else if (diffDays > 1) {
        // Streak broken
        if (prog.streak > 0) {
          await updateProgress({ streak: 0 })
          prog.streak = 0
        }
      }
    }

    setProgress(prog)

    const due = await getDueCards()
    setDueCount(due.length)

    const total = await db.flashcards.count()
    setTotalCards(total)

    // Today's sessions
    const sessions = await db.sessions.toArray()
    const todaySessions = sessions.filter(s => isToday(new Date(s.date)))
    setTodayReviewed(todaySessions.reduce((sum, s) => sum + s.cardsReviewed, 0))

    // Recent cards
    const recent = await db.flashcards.orderBy('createdAt').reverse().limit(5).toArray()
    setRecentCards(recent)
  }

  if (!progress) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const xpInfo = xpProgress(progress.totalXP)
  const dailyGoalPercent = Math.min((todayReviewed / progress.dailyGoal) * 100, 100)
  const goalReached = todayReviewed >= progress.dailyGoal

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 pb-28 overflow-auto">
      {/* Hero header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-900/60 to-purple-900/60 px-5 pt-12 pb-8">
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-10 w-32 h-32 bg-purple-600/10 rounded-full blur-2xl pointer-events-none" />

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {/* Greeting */}
          <p className="text-slate-400 text-sm mb-1">Bonjour 👋</p>
          <h1 className="text-2xl font-bold text-white mb-4">Prêt à réviser ?</h1>

          {/* Level + XP */}
          <div className="bg-white/5 backdrop-blur rounded-2xl p-4 border border-white/10">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center text-sm font-bold text-white shadow-lg">
                    {progress.level}
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">{levelName(progress.level)}</p>
                    <p className="text-slate-400 text-xs">Niveau {progress.level}</p>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 text-amber-400">
                  <Zap size={14} />
                  <span className="font-bold text-sm">{progress.totalXP.toLocaleString()} XP</span>
                </div>
                <p className="text-slate-400 text-xs">{xpInfo.current}/{xpInfo.needed} pour niveau {progress.level + 1}</p>
              </div>
            </div>
            <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${xpInfo.percent}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
          </div>
        </motion.div>
      </div>

      <div className="px-4 py-5 space-y-4">
        {/* Main CTA */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate('/study')}
          disabled={dueCount === 0}
          className={`w-full rounded-2xl p-5 flex items-center gap-4 shadow-xl transition-all duration-200 ${
            dueCount > 0
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-indigo-600/30'
              : 'bg-slate-800/60 opacity-60 cursor-not-allowed'
          }`}
        >
          <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
            <BookOpen size={28} className="text-white" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-white font-bold text-lg">
              {dueCount > 0 ? `Réviser maintenant` : 'Tout à jour !'}
            </p>
            <p className="text-white/70 text-sm">
              {dueCount > 0 ? `${dueCount} carte${dueCount > 1 ? 's' : ''} à revoir` : 'Aucune carte due'}
            </p>
          </div>
          {dueCount > 0 && (
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <ChevronRight size={20} className="text-white" />
            </div>
          )}
        </motion.button>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-3 gap-3"
        >
          <StatCard icon={<Flame size={20} className="text-orange-400" />} value={progress.streak} label="Jours" color="orange" />
          <StatCard icon={<Target size={20} className="text-indigo-400" />} value={totalCards} label="Cartes" color="indigo" />
          <StatCard icon={<Star size={20} className="text-amber-400" />} value={progress.achievements.length} label="Badges" color="amber" />
        </motion.div>

        {/* Daily goal */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-slate-800/50 border border-slate-700/40 rounded-2xl p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Target size={16} className="text-indigo-400" />
              <span className="text-white text-sm font-semibold">Objectif du jour</span>
            </div>
            <span className={`text-sm font-bold ${goalReached ? 'text-emerald-400' : 'text-slate-400'}`}>
              {todayReviewed}/{progress.dailyGoal}
              {goalReached && ' ✅'}
            </span>
          </div>
          <div className="h-2.5 bg-slate-700 rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${goalReached ? 'bg-gradient-to-r from-emerald-500 to-green-400' : 'bg-gradient-to-r from-indigo-500 to-purple-500'}`}
              initial={{ width: 0 }}
              animate={{ width: `${dailyGoalPercent}%` }}
              transition={{ duration: 0.8 }}
            />
          </div>
          {goalReached && (
            <p className="text-emerald-400 text-xs mt-2">🎉 Objectif atteint ! Continuez sur votre lancée.</p>
          )}
        </motion.div>

        {/* Streak banner */}
        {progress.streak >= 2 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gradient-to-r from-orange-900/40 to-red-900/30 border border-orange-500/30 rounded-2xl p-4 flex items-center gap-3"
          >
            <span className="text-3xl">🔥</span>
            <div>
              <p className="text-white font-bold">{progress.streak} jours d'affilée !</p>
              <p className="text-orange-300 text-sm">Continuez pour battre votre record de {progress.longestStreak} jours</p>
            </div>
          </motion.div>
        )}

        {/* Next reviews */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-slate-800/50 border border-slate-700/40 rounded-2xl p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-slate-400" />
              <span className="text-white text-sm font-semibold">Cartes récentes</span>
            </div>
            <button onClick={() => navigate('/import')} className="text-indigo-400 text-xs hover:text-indigo-300">
              + Ajouter
            </button>
          </div>

          {recentCards.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-slate-500 text-sm">Aucune carte encore</p>
              <button onClick={() => navigate('/import')} className="text-indigo-400 text-sm mt-2 hover:text-indigo-300">
                Importer depuis Google Traduction →
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {recentCards.map(card => (
                <div key={card.id} className="flex items-center gap-3 bg-slate-800/50 rounded-xl px-3 py-2.5">
                  <div className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm truncate">{card.front}</p>
                    <p className="text-slate-400 text-xs truncate">{card.back}</p>
                  </div>
                  <span className={`text-xs flex-shrink-0 ${card.nextReview <= new Date() ? 'text-orange-400' : 'text-slate-500'}`}>
                    {card.nextReview <= new Date()
                      ? 'À revoir'
                      : isToday(card.nextReview)
                      ? 'Aujourd\'hui'
                      : isTomorrow(card.nextReview)
                      ? 'Demain'
                      : `dans ${card.interval}j`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Quick actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="grid grid-cols-2 gap-3"
        >
          <QuickAction icon="📊" label="Statistiques" onClick={() => navigate('/stats')} />
          <QuickAction icon="🏆" label="Achievements" onClick={() => navigate('/achievements')} />
        </motion.div>
      </div>
    </div>
  )
}

function StatCard({ icon, value, label, color }: { icon: React.ReactNode; value: number; label: string; color: string }) {
  const colorMap: Record<string, string> = {
    orange: 'bg-orange-500/10 border-orange-500/20',
    indigo: 'bg-indigo-500/10 border-indigo-500/20',
    amber: 'bg-amber-500/10 border-amber-500/20',
  }
  return (
    <div className={`rounded-2xl p-3 border ${colorMap[color]}`}>
      <div className="mb-1">{icon}</div>
      <p className="text-white font-bold text-xl">{value.toLocaleString()}</p>
      <p className="text-slate-400 text-xs">{label}</p>
    </div>
  )
}

function QuickAction({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="bg-slate-800/50 border border-slate-700/40 rounded-2xl p-4 flex items-center gap-3 hover:bg-slate-800/80 transition-colors"
    >
      <span className="text-2xl">{icon}</span>
      <span className="text-white text-sm font-medium">{label}</span>
    </motion.button>
  )
}
