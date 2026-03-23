import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion'
import { ArrowLeft, RotateCcw, Volume2, ChevronRight, Zap, Trophy, Target } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { db, getDueCards, getOrCreateProgress, updateProgress } from '../lib/db'
import { applyReview, calculateXP, levelFromXP, xpForLevel, xpProgress, ratingLabel } from '../lib/srs'
import { Flashcard, SM2Rating } from '../lib/types'
import { ACHIEVEMENTS } from '../lib/achievements'
import { langName } from '../lib/googleTranslateParser'

type Phase = 'loading' | 'empty' | 'front' | 'back' | 'rating' | 'done'

interface SessionStats {
  reviewed: number
  correct: number
  xpEarned: number
  startTime: number
}

export default function Study() {
  const navigate = useNavigate()
  const [queue, setQueue] = useState<Flashcard[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [phase, setPhase] = useState<Phase>('loading')
  const [flipped, setFlipped] = useState(false)
  const [sessionStats, setSessionStats] = useState<SessionStats>({ reviewed: 0, correct: 0, xpEarned: 0, startTime: Date.now() })
  const [showXPPop, setShowXPPop] = useState<number | null>(null)
  const [levelUp, setLevelUp] = useState(false)

  // Swipe handling
  const swipeX = useMotionValue(0)
  const cardRotate = useTransform(swipeX, [-150, 0, 150], [-15, 0, 15])
  const cardOpacity = useTransform(swipeX, [-200, -50, 0, 50, 200], [0.5, 1, 1, 1, 0.5])
  const dragRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadQueue()
  }, [])

  async function loadQueue() {
    const cards = await getDueCards(30)
    if (cards.length === 0) {
      setPhase('empty')
      return
    }
    setQueue(cards)
    setCurrentIdx(0)
    setPhase('front')
  }

  const currentCard = queue[currentIdx]

  const flipCard = () => {
    if (phase !== 'front') return
    setFlipped(true)
    setPhase('back')
    setTimeout(() => setPhase('rating'), 400)
  }

  const handleRating = useCallback(async (rating: SM2Rating) => {
    if (!currentCard) return
    const progress = await getOrCreateProgress()

    const isCorrect = rating >= 3
    const isNewCard = currentCard.repetitions === 0
    const xp = calculateXP(rating, progress.streak, isNewCard)
    const newTotalXP = progress.totalXP + xp
    const oldLevel = progress.level
    const newLevel = levelFromXP(newTotalXP)

    // Update card
    const updated = applyReview(currentCard, rating)
    await db.flashcards.update(currentCard.id!, {
      easeFactor: updated.easeFactor,
      interval: updated.interval,
      repetitions: updated.repetitions,
      nextReview: updated.nextReview,
      lastReview: updated.lastReview,
      lastScore: updated.lastScore,
    })

    // Update session stats
    const newSessionStats = {
      reviewed: sessionStats.reviewed + 1,
      correct: sessionStats.correct + (isCorrect ? 1 : 0),
      xpEarned: sessionStats.xpEarned + xp,
      startTime: sessionStats.startTime,
    }
    setSessionStats(newSessionStats)

    // Show XP pop
    setShowXPPop(xp)
    setTimeout(() => setShowXPPop(null), 1200)

    // Check level up
    if (newLevel > oldLevel) {
      setLevelUp(true)
      setTimeout(() => setLevelUp(false), 3000)
    }

    // Update progress
    const newTotalReviewed = progress.totalCardsReviewed + 1
    const newTotalCorrect = progress.totalCorrect + (isCorrect ? 1 : 0)

    // Check achievements
    const progressForCheck = {
      ...progress,
      totalXP: newTotalXP,
      level: newLevel,
      totalCardsReviewed: newTotalReviewed,
      totalCorrect: newTotalCorrect,
    }
    const totalCards = await db.flashcards.count()
    const newAchievements: string[] = []
    for (const ach of ACHIEVEMENTS) {
      if (!progress.achievements.includes(ach.id) && ach.condition(progressForCheck, { totalCards })) {
        newAchievements.push(ach.id)
        toast.success(`🏆 ${ach.name} — +${ach.xpReward} XP`, { duration: 3000 })
      }
    }

    await updateProgress({
      totalXP: newTotalXP + newAchievements.reduce((sum, id) => sum + (ACHIEVEMENTS.find(a => a.id === id)?.xpReward ?? 0), 0),
      level: newLevel,
      totalCardsReviewed: newTotalReviewed,
      totalCorrect: newTotalCorrect,
      achievements: [...progress.achievements, ...newAchievements],
    })

    // Next card
    setFlipped(false)
    swipeX.set(0)
    const next = currentIdx + 1
    if (next >= queue.length) {
      // Save session
      await db.sessions.add({
        date: new Date(),
        cardsReviewed: newSessionStats.reviewed,
        correctCount: newSessionStats.correct,
        xpEarned: newSessionStats.xpEarned,
        durationSeconds: Math.round((Date.now() - newSessionStats.startTime) / 1000),
      })
      setPhase('done')
    } else {
      setCurrentIdx(next)
      setPhase('front')
    }
  }, [currentCard, currentIdx, queue, sessionStats, swipeX])

  // TTS
  const speak = (text: string, lang: string) => {
    const utt = new SpeechSynthesisUtterance(text)
    utt.lang = lang
    speechSynthesis.speak(utt)
  }

  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (phase === 'empty') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-white mb-2">Aucune carte à réviser !</h2>
          <p className="text-slate-400 mb-6">Toutes vos cartes sont à jour. Revenez plus tard ou importez de nouvelles cartes.</p>
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => navigate('/import')}
            className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold">
            Importer des cartes
          </motion.button>
        </motion.div>
      </div>
    )
  }

  if (phase === 'done') {
    const accuracy = sessionStats.reviewed > 0
      ? Math.round((sessionStats.correct / sessionStats.reviewed) * 100)
      : 0
    const duration = Math.round((Date.now() - sessionStats.startTime) / 1000)

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="text-center max-w-sm w-full">
          <div className="text-6xl mb-4 animate-bounce">🏆</div>
          <h2 className="text-2xl font-bold text-white mb-1">Session terminée !</h2>
          <p className="text-slate-400 mb-6">Excellent travail !</p>

          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { label: 'Révisées', value: sessionStats.reviewed, icon: '📚' },
              { label: 'Précision', value: `${accuracy}%`, icon: '🎯' },
              { label: 'XP gagnés', value: `+${sessionStats.xpEarned}`, icon: '⚡' },
            ].map(stat => (
              <div key={stat.label} className="bg-slate-800/60 rounded-xl p-3">
                <div className="text-2xl mb-1">{stat.icon}</div>
                <div className="text-white font-bold text-lg">{stat.value}</div>
                <div className="text-slate-400 text-xs">{stat.label}</div>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => navigate('/')}
              className="flex-1 py-3 bg-slate-700 text-white rounded-xl font-medium">
              Accueil
            </motion.button>
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => { loadQueue(); setSessionStats({ reviewed: 0, correct: 0, xpEarned: 0, startTime: Date.now() }) }}
              className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2">
              <RotateCcw size={16} /> Encore
            </motion.button>
          </div>
        </motion.div>
      </div>
    )
  }

  const progress = ((currentIdx) / queue.length) * 100

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 flex flex-col" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 pt-safe">
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate('/')}
          className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-800/60">
          <ArrowLeft size={20} className="text-slate-300" />
        </motion.button>

        <div className="flex-1 mx-4">
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>{currentIdx}/{queue.length} cartes</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
              initial={false}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
        </div>

        <div className="flex items-center gap-1 bg-amber-500/20 rounded-xl px-3 py-1.5">
          <Zap size={14} className="text-amber-400" />
          <span className="text-amber-300 text-sm font-semibold">{sessionStats.xpEarned}</span>
        </div>
      </div>

      {/* XP Pop */}
      <AnimatePresence>
        {showXPPop !== null && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -40 }}
            className="absolute top-20 right-4 bg-amber-500 text-white font-bold text-lg rounded-full px-4 py-2 z-50 shadow-lg"
          >
            +{showXPPop} XP
          </motion.div>
        )}
      </AnimatePresence>

      {/* Level Up */}
      <AnimatePresence>
        {levelUp && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.5 }}
            className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
          >
            <div className="text-center bg-gradient-to-br from-amber-400 to-orange-500 rounded-3xl px-8 py-6 shadow-2xl">
              <div className="text-5xl mb-2">⬆️</div>
              <p className="text-white font-black text-2xl">NIVEAU SUPÉRIEUR !</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Card Area */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-6">
        <AnimatePresence mode="wait">
          {currentCard && (
            <motion.div
              key={currentCard.id}
              initial={{ opacity: 0, x: 50, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -50, scale: 0.95 }}
              transition={{ duration: 0.25 }}
              className="w-full max-w-md"
            >
              {/* Card */}
              <motion.div
                ref={dragRef}
                style={{ x: swipeX, rotate: cardRotate, opacity: cardOpacity, minHeight: 280 }}
                drag={phase === 'front' ? 'x' : false}
                dragConstraints={{ left: -20, right: 20 }}
                onDragEnd={(_, info) => {
                  if (info.offset.x > 100) flipCard()
                  else if (info.offset.x < -100) flipCard()
                  else animate(swipeX, 0)
                }}
                onClick={phase === 'front' ? flipCard : undefined}
                className="relative bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/50 rounded-3xl shadow-2xl overflow-hidden cursor-pointer select-none"
              >
                {/* Card glow */}
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/10 to-purple-600/10 pointer-events-none" />

                {/* Lang badges */}
                <div className="flex justify-between items-center p-5 pb-0">
                  <span className="text-xs text-slate-500 bg-slate-800/80 px-2 py-1 rounded-full">
                    {langName(currentCard.sourceLang)}
                  </span>
                  {!flipped && (
                    <span className="text-xs text-indigo-400/70 italic">Appuyez pour révéler</span>
                  )}
                  {flipped && (
                    <span className="text-xs text-slate-500 bg-slate-800/80 px-2 py-1 rounded-full">
                      {langName(currentCard.targetLang)}
                    </span>
                  )}
                </div>

                {/* Card content */}
                <div className="flex flex-col items-center justify-center px-6 py-8 min-h-52">
                  <AnimatePresence mode="wait">
                    {!flipped ? (
                      <motion.div key="front" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center">
                        <p className="text-white text-3xl font-bold leading-tight">{currentCard.front}</p>
                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          onClick={e => { e.stopPropagation(); speak(currentCard.front, currentCard.sourceLang) }}
                          className="mt-4 p-2 rounded-full bg-slate-700/50 text-slate-400 hover:text-white"
                        >
                          <Volume2 size={18} />
                        </motion.button>
                      </motion.div>
                    ) : (
                      <motion.div key="back" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center w-full">
                        <p className="text-slate-500 text-sm mb-2">{currentCard.front}</p>
                        <div className="w-12 h-0.5 bg-indigo-500/30 mx-auto mb-3" />
                        <p className="text-indigo-300 text-3xl font-bold leading-tight">{currentCard.back}</p>
                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          onClick={e => { e.stopPropagation(); speak(currentCard.back, currentCard.targetLang) }}
                          className="mt-4 p-2 rounded-full bg-slate-700/50 text-slate-400 hover:text-white"
                        >
                          <Volume2 size={18} />
                        </motion.button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Card meta */}
                <div className="flex justify-between items-center px-5 py-3 border-t border-slate-700/30">
                  <span className="text-xs text-slate-600">
                    {currentCard.repetitions > 0 ? `Revu ${currentCard.repetitions}×` : 'Nouvelle carte'}
                  </span>
                  <span className="text-xs text-slate-600">
                    {currentIdx + 1} / {queue.length}
                  </span>
                </div>
              </motion.div>

              {/* Flip hint */}
              {phase === 'front' && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center text-slate-500 text-sm mt-4">
                  Appuyez ou glissez pour retourner
                </motion.p>
              )}

              {/* Rating buttons */}
              <AnimatePresence>
                {phase === 'rating' && (
                  <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mt-5 space-y-3"
                  >
                    <p className="text-center text-slate-400 text-sm font-medium">Comment ça s'est passé ?</p>
                    <div className="grid grid-cols-2 gap-2">
                      {([
                        [0, '💀', 'Oublié', 'from-red-900/50 border-red-800/50 hover:from-red-800/60'],
                        [1, '❌', 'Raté', 'from-red-800/40 border-red-700/40 hover:from-red-700/50'],
                        [3, '😅', 'Difficile', 'from-orange-800/40 border-orange-700/40 hover:from-orange-700/50'],
                        [4, '✅', 'Bien', 'from-green-800/40 border-green-700/40 hover:from-green-700/50'],
                        [5, '🌟', 'Parfait', 'from-emerald-800/50 border-emerald-700/50 hover:from-emerald-700/60'],
                      ] as [SM2Rating, string, string, string][]).map(([rating, emoji, label, cls]) => (
                        <motion.button
                          key={rating}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleRating(rating)}
                          className={`bg-gradient-to-br ${cls} border rounded-xl py-3 px-4 flex items-center justify-center gap-2 transition-all`}
                        >
                          <span className="text-xl">{emoji}</span>
                          <span className="text-white text-sm font-medium">{label}</span>
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
