import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Trophy, Lock, Zap } from 'lucide-react'
import { getOrCreateProgress } from '../lib/db'
import { UserProgress } from '../lib/types'
import { ACHIEVEMENTS, RARITY_COLORS, RARITY_LABELS } from '../lib/achievements'

export default function Achievements() {
  const [progress, setProgress] = useState<UserProgress | null>(null)

  useEffect(() => {
    getOrCreateProgress().then(setProgress)
  }, [])

  if (!progress) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const unlocked = progress.achievements
  const unlockedCount = unlocked.length
  const totalCount = ACHIEVEMENTS.length

  const grouped: Record<string, typeof ACHIEVEMENTS> = {
    legendary: ACHIEVEMENTS.filter(a => a.rarity === 'legendary'),
    epic: ACHIEVEMENTS.filter(a => a.rarity === 'epic'),
    rare: ACHIEVEMENTS.filter(a => a.rarity === 'rare'),
    common: ACHIEVEMENTS.filter(a => a.rarity === 'common'),
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 pb-28 overflow-auto">
      <div className="px-4 pt-12 pb-6 max-w-2xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-1">Achievements</h1>
          <p className="text-slate-400 text-sm">{unlockedCount}/{totalCount} débloqués</p>
        </motion.div>

        {/* Progress bar */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-slate-800/50 border border-slate-700/40 rounded-2xl p-4 mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Trophy size={18} className="text-amber-400" />
            <span className="text-white text-sm font-medium">Collection</span>
            <span className="ml-auto text-amber-400 font-bold text-sm">{Math.round((unlockedCount / totalCount) * 100)}%</span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${(unlockedCount / totalCount) * 100}%` }}
              transition={{ duration: 0.8 }}
            />
          </div>
        </motion.div>

        {/* Grouped achievements */}
        {Object.entries(grouped).map(([rarity, achs], groupIdx) => (
          <motion.div
            key={rarity}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: groupIdx * 0.1 }}
            className="mb-6"
          >
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
              {RARITY_LABELS[rarity]} ({achs.filter(a => unlocked.includes(a.id)).length}/{achs.length})
            </h2>
            <div className="grid grid-cols-1 gap-2">
              {achs.map((achievement, i) => {
                const isUnlocked = unlocked.includes(achievement.id)
                return (
                  <motion.div
                    key={achievement.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: groupIdx * 0.1 + i * 0.05 }}
                    className={`relative rounded-2xl border overflow-hidden transition-all duration-200 ${
                      isUnlocked
                        ? 'bg-slate-800/60 border-slate-600/40'
                        : 'bg-slate-900/40 border-slate-700/20 opacity-60'
                    }`}
                  >
                    {isUnlocked && (
                      <div className={`absolute inset-0 bg-gradient-to-r ${RARITY_COLORS[rarity]} opacity-10 pointer-events-none`} />
                    )}
                    <div className="flex items-center gap-4 px-4 py-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 ${
                        isUnlocked ? `bg-gradient-to-br ${RARITY_COLORS[achievement.rarity]}` : 'bg-slate-800'
                      }`}>
                        {isUnlocked ? achievement.icon : <Lock size={20} className="text-slate-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold text-sm ${isUnlocked ? 'text-white' : 'text-slate-500'}`}>
                          {achievement.name}
                        </p>
                        <p className={`text-xs mt-0.5 ${isUnlocked ? 'text-slate-300' : 'text-slate-600'}`}>
                          {achievement.description}
                        </p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        {isUnlocked ? (
                          <div className="flex items-center gap-1 text-amber-400">
                            <Zap size={12} />
                            <span className="text-xs font-bold">+{achievement.xpReward}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-600">+{achievement.xpReward} XP</span>
                        )}
                        <div className={`text-xs mt-1 font-medium ${isUnlocked ? rarityTextColor(achievement.rarity) : 'text-slate-700'}`}>
                          {RARITY_LABELS[achievement.rarity]}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

function rarityTextColor(rarity: string): string {
  const map: Record<string, string> = {
    common: 'text-slate-400',
    rare: 'text-blue-400',
    epic: 'text-purple-400',
    legendary: 'text-amber-400',
  }
  return map[rarity] ?? 'text-slate-400'
}
