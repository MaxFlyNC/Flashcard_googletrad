import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, Target, Zap, BookOpen, Clock, Award, Calendar } from 'lucide-react'
import { db, getOrCreateProgress } from '../lib/db'
import { UserProgress, ReviewSession, Flashcard } from '../lib/types'
import { format, subDays, isToday, startOfDay } from 'date-fns'
import { fr } from 'date-fns/locale'
import { xpProgress, levelFromXP } from '../lib/srs'

interface DayStats {
  date: string
  count: number
  xp: number
}

export default function Stats() {
  const [progress, setProgress] = useState<UserProgress | null>(null)
  const [sessions, setSessions] = useState<ReviewSession[]>([])
  const [totalCards, setTotalCards] = useState(0)
  const [matureCards, setMatureCards] = useState(0)
  const [weekData, setWeekData] = useState<DayStats[]>([])

  useEffect(() => {
    loadStats()
  }, [])

  async function loadStats() {
    const prog = await getOrCreateProgress()
    setProgress(prog)

    // Limit to last 100 sessions — sufficient for all displayed stats
    const allSessions = await db.sessions.orderBy('date').reverse().limit(100).toArray()
    setSessions(allSessions)

    // Use count() queries instead of loading all cards into memory
    const total  = await db.flashcards.count()
    const mature = await db.flashcards.filter(c => c.interval >= 21).count()
    setTotalCards(total)
    setMatureCards(mature)

    // Last 7 days
    const days: DayStats[] = []
    for (let i = 6; i >= 0; i--) {
      const day = subDays(new Date(), i)
      const dayStr = format(day, 'yyyy-MM-dd')
      const daySessions = allSessions.filter(s => format(new Date(s.date), 'yyyy-MM-dd') === dayStr)
      days.push({
        date: format(day, 'EEE', { locale: fr }),
        count: daySessions.reduce((sum, s) => sum + s.cardsReviewed, 0),
        xp: daySessions.reduce((sum, s) => sum + s.xpEarned, 0),
      })
    }
    setWeekData(days)
  }

  if (!progress) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const accuracy = progress.totalCardsReviewed > 0
    ? Math.round((progress.totalCorrect / progress.totalCardsReviewed) * 100)
    : 0

  const totalXPSessions = sessions.reduce((sum, s) => sum + s.xpEarned, 0)
  const avgPerSession = sessions.length > 0
    ? Math.round(sessions.reduce((sum, s) => sum + s.cardsReviewed, 0) / sessions.length)
    : 0

  const maxDay = Math.max(...weekData.map(d => d.count), 1)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 pb-28 overflow-auto">
      <div className="px-4 pt-12 pb-6 max-w-2xl mx-auto">
        <motion.h1 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-bold text-white mb-1">
          Statistiques
        </motion.h1>
        <p className="text-slate-400 text-sm mb-6">Votre progression détaillée</p>

        {/* Main stats grid */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 gap-3 mb-4">
          <BigStat icon={<BookOpen size={22} className="text-indigo-400" />} value={progress.totalCardsReviewed.toLocaleString()} label="Cartes révisées" sub="au total" color="indigo" />
          <BigStat icon={<Target size={22} className="text-emerald-400" />} value={`${accuracy}%`} label="Précision" sub={`${progress.totalCorrect} correctes`} color="emerald" />
          <BigStat icon={<Zap size={22} className="text-amber-400" />} value={progress.totalXP.toLocaleString()} label="XP totaux" sub={`Niveau ${progress.level}`} color="amber" />
          <BigStat icon={<Clock size={22} className="text-purple-400" />} value={sessions.length.toString()} label="Sessions" sub={`moy. ${avgPerSession} cartes`} color="purple" />
        </motion.div>

        {/* Card maturity */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-slate-800/50 border border-slate-700/40 rounded-2xl p-4 mb-4">
          <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
            <Calendar size={16} className="text-slate-400" />
            Maturité des cartes
          </h3>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Matures (≥21j)</span>
                <span>{matureCards}/{totalCards}</span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
                  style={{ width: totalCards > 0 ? `${(matureCards / totalCards) * 100}%` : '0%' }}
                />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3 text-center">
            {[
              { label: 'Nouvelles', count: 0, color: 'text-slate-400' },
              { label: 'En cours', count: 0, color: 'text-indigo-400' },
              { label: 'Maîtrisées', count: matureCards, color: 'text-emerald-400' },
            ].map(item => (
              <div key={item.label} className="bg-slate-800/60 rounded-xl p-2">
                <p className={`font-bold ${item.color}`}>{item.count}</p>
                <p className="text-slate-500 text-xs">{item.label}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Weekly chart */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-slate-800/50 border border-slate-700/40 rounded-2xl p-4 mb-4">
          <h3 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-slate-400" />
            7 derniers jours
          </h3>
          <div className="flex items-end gap-2 h-24">
            {weekData.map((day, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex flex-col justify-end" style={{ height: 72 }}>
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${(day.count / maxDay) * 100}%` }}
                    transition={{ delay: i * 0.05, duration: 0.4 }}
                    className={`w-full rounded-t-lg min-h-1 ${day.count > 0 ? 'bg-gradient-to-t from-indigo-600 to-indigo-400' : 'bg-slate-700'}`}
                  />
                </div>
                <span className="text-xs text-slate-400 capitalize">{day.date}</span>
                {day.count > 0 && <span className="text-xs text-indigo-400 font-medium">{day.count}</span>}
              </div>
            ))}
          </div>
        </motion.div>

        {/* Recent sessions */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <h3 className="text-white font-semibold mb-3">Sessions récentes</h3>
          {sessions.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-6">Aucune session encore</p>
          ) : (
            <div className="space-y-2">
              {sessions.slice(0, 10).map(session => {
                const acc = session.cardsReviewed > 0
                  ? Math.round((session.correctCount / session.cardsReviewed) * 100)
                  : 0
                return (
                  <div key={session.id} className="bg-slate-800/40 border border-slate-700/30 rounded-xl px-4 py-3 flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-white text-sm font-medium">{session.cardsReviewed} cartes révisées</p>
                      <p className="text-slate-400 text-xs">{format(new Date(session.date), 'dd MMM à HH:mm', { locale: fr })}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-amber-400 text-sm font-semibold">+{session.xpEarned} XP</p>
                      <p className="text-slate-400 text-xs">{acc}% correct</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}

function BigStat({ icon, value, label, sub, color }: { icon: React.ReactNode; value: string; label: string; sub: string; color: string }) {
  const bg: Record<string, string> = {
    indigo: 'bg-indigo-500/10 border-indigo-500/20',
    emerald: 'bg-emerald-500/10 border-emerald-500/20',
    amber: 'bg-amber-500/10 border-amber-500/20',
    purple: 'bg-purple-500/10 border-purple-500/20',
  }
  return (
    <div className={`${bg[color]} border rounded-2xl p-4`}>
      <div className="mb-2">{icon}</div>
      <p className="text-white font-bold text-2xl">{value}</p>
      <p className="text-white/80 text-sm font-medium">{label}</p>
      <p className="text-slate-400 text-xs mt-0.5">{sub}</p>
    </div>
  )
}
