import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bot, Key, Eye, EyeOff, CheckCircle2, AlertCircle,
  Sparkles, Download, Loader2, RefreshCw, Info,
  ChevronDown, ChevronUp,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { db } from '../lib/db'
import { Flashcard } from '../lib/types'
import { getApiKey, saveApiKey, hasApiKey, enrichCard } from '../lib/aiAgent'
import { generateAnkiTSV, downloadFile, filterCards } from '../lib/ankiExport'
import { LANGUAGE_NAMES } from '../lib/googleTranslateParser'

// ─── Page principale ──────────────────────────────────────────────────────────

export default function Agent() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 p-4 pb-28">
      <div className="max-w-2xl mx-auto space-y-6">

        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-indigo-600/20 rounded-xl">
              <Bot size={22} className="text-indigo-400" />
            </div>
            <h1 className="text-2xl font-bold text-white">Agent IA</h1>
          </div>
          <p className="text-slate-400 text-sm">
            Enrichissez vos cartes avec des exemples générés par Claude, puis exportez vers Anki.
          </p>
        </motion.div>

        {/* 1 — Clé API */}
        <Section icon={<Key size={18} />} title="Clé API Claude" delay={0.05}>
          <ApiKeySection />
        </Section>

        {/* 2 — Enrichissement IA */}
        <Section icon={<Sparkles size={18} />} title="Enrichissement par IA" delay={0.1}>
          <EnrichSection />
        </Section>

        {/* 3 — Export Anki */}
        <Section icon={<Download size={18} />} title="Exporter vers Anki" delay={0.15}>
          <AnkiExportSection />
        </Section>

      </div>
    </div>
  )
}

// ─── Wrapper de section ───────────────────────────────────────────────────────

function Section({
  icon, title, children, delay = 0,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
  delay?: number
}) {
  const [open, setOpen] = useState(true)
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-slate-800/40 border border-slate-700/50 rounded-2xl overflow-hidden"
    >
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-700/20 transition-colors"
      >
        <div className="flex items-center gap-2 text-white font-semibold">
          <span className="text-indigo-400">{icon}</span>
          {title}
        </div>
        {open ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 pt-1 border-t border-slate-700/40 space-y-4">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Section 1 : Clé API ──────────────────────────────────────────────────────

function ApiKeySection() {
  const [key, setKey] = useState(getApiKey)
  const [show, setShow] = useState(false)
  const [saved, setSaved] = useState(hasApiKey)

  const handleSave = () => {
    saveApiKey(key)
    setSaved(Boolean(key.trim()))
    toast.success(key.trim() ? 'Clé sauvegardée localement' : 'Clé supprimée')
  }

  return (
    <div className="space-y-3">
      <div className="bg-blue-900/20 border border-blue-500/20 rounded-xl p-3 flex gap-2 text-xs text-blue-300">
        <Info size={14} className="flex-shrink-0 mt-0.5 text-blue-400" />
        <span>
          Obtenez votre clé gratuite sur{' '}
          <span className="font-mono bg-blue-900/40 px-1 rounded">console.anthropic.com</span>.
          Elle est stockée uniquement sur votre appareil, jamais envoyée ailleurs.
        </span>
      </div>

      <div className="relative flex gap-2">
        <input
          type={show ? 'text' : 'password'}
          value={key}
          onChange={e => setKey(e.target.value)}
          placeholder="sk-ant-api03-…"
          className="flex-1 bg-slate-900/60 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm font-mono placeholder-slate-600 focus:outline-none focus:border-indigo-500"
        />
        <button
          onClick={() => setShow(s => !s)}
          className="px-3 text-slate-400 hover:text-slate-200"
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>

      <div className="flex items-center gap-3">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleSave}
          className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          Sauvegarder
        </motion.button>
        {saved && (
          <div className="flex items-center gap-1.5 text-emerald-400 text-sm">
            <CheckCircle2 size={16} />
            <span>Active</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Section 2 : Enrichissement ───────────────────────────────────────────────

function EnrichSection() {
  const [cards, setCards] = useState<Flashcard[]>([])
  const [total, setTotal] = useState(0)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentWord, setCurrentWord] = useState('')
  const [errors, setErrors] = useState(0)
  const [done, setDone] = useState(false)

  const load = useCallback(async () => {
    const all = await db.flashcards.toArray()
    setTotal(all.length)
    setCards(all.filter(c => !c.context))
  }, [])

  useEffect(() => { load() }, [load])

  const runEnrichment = async () => {
    if (!hasApiKey()) {
      toast.error('Configurez votre clé API Claude d\'abord')
      return
    }
    if (cards.length === 0) {
      toast('Toutes les cartes ont déjà un exemple !', { icon: '✅' })
      return
    }

    setRunning(true)
    setProgress(0)
    setErrors(0)
    setDone(false)
    let errorCount = 0

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i]
      setCurrentWord(card.front)
      setProgress(Math.round((i / cards.length) * 100))

      try {
        const result = await enrichCard(card.front, card.back, card.sourceLang, card.targetLang)
        await db.flashcards.update(card.id!, { context: result.context })
        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 300))
      } catch (err) {
        errorCount++
        setErrors(errorCount)
        if (errorCount >= 3) {
          toast.error('Trop d\'erreurs, enrichissement interrompu')
          break
        }
      }
    }

    setProgress(100)
    setCurrentWord('')
    setRunning(false)
    setDone(true)
    await load()
    toast.success('Enrichissement terminé !')
  }

  const enriched = total - cards.length

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3 text-center">
        {[
          { label: 'Total', value: total, color: 'text-white' },
          { label: 'Enrichies', value: enriched, color: 'text-emerald-400' },
          { label: 'À traiter', value: cards.length, color: 'text-amber-400' },
        ].map(s => (
          <div key={s.label} className="bg-slate-900/40 rounded-xl py-3">
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="text-xs text-slate-400 bg-slate-900/30 rounded-xl p-3">
        L'IA génère une <strong className="text-slate-300">phrase d'exemple</strong> dans la langue source
        pour chaque carte. Cela aide à mémoriser le contexte d'utilisation du mot.
      </div>

      {running && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <Loader2 size={12} className="animate-spin" />
              {currentWord && `"${currentWord}"`}
            </span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-indigo-500 rounded-full"
              animate={{ width: `${progress}%` }}
              transition={{ ease: 'linear', duration: 0.3 }}
            />
          </div>
          {errors > 0 && (
            <p className="text-xs text-red-400 flex items-center gap-1">
              <AlertCircle size={12} /> {errors} erreur(s)
            </p>
          )}
        </div>
      )}

      {done && !running && (
        <div className="flex items-center gap-2 text-emerald-400 text-sm">
          <CheckCircle2 size={16} />
          <span>Enrichissement terminé !</span>
        </div>
      )}

      <div className="flex gap-2">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={runEnrichment}
          disabled={running || cards.length === 0}
          className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
        >
          {running ? (
            <><Loader2 size={16} className="animate-spin" /> En cours…</>
          ) : (
            <><Sparkles size={16} /> Enrichir {cards.length} carte{cards.length > 1 ? 's' : ''}</>
          )}
        </motion.button>
        <button
          onClick={load}
          disabled={running}
          className="px-3 py-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-slate-300 rounded-xl transition-colors"
          title="Rafraîchir"
        >
          <RefreshCw size={16} />
        </button>
      </div>
    </div>
  )
}

// ─── Section 3 : Export Anki ──────────────────────────────────────────────────

function AnkiExportSection() {
  const [cards, setCards] = useState<Flashcard[]>([])
  const [srcLang, setSrcLang] = useState('all')
  const [tgtLang, setTgtLang] = useState('all')
  const [deckName, setDeckName] = useState('FlashCardTrad')
  const [showInstructions, setShowInstructions] = useState(false)

  useEffect(() => {
    db.flashcards.toArray().then(setCards)
  }, [])

  const langOptions = Object.entries(LANGUAGE_NAMES).filter(([k]) => k !== 'auto')
  const filtered = filterCards(cards, {
    sourceLang: srcLang === 'all' ? undefined : srcLang,
    targetLang: tgtLang === 'all' ? undefined : tgtLang,
  })

  const handleExport = () => {
    if (filtered.length === 0) {
      toast.error('Aucune carte à exporter')
      return
    }
    const content = generateAnkiTSV(filtered, deckName)
    const date = new Date().toISOString().slice(0, 10)
    downloadFile(content, `${deckName}_${date}.txt`)
    toast.success(`${filtered.length} cartes exportées !`)
  }

  return (
    <div className="space-y-4">

      {/* Nom du deck */}
      <div>
        <label className="text-xs text-slate-400 mb-1 block">Nom du deck Anki</label>
        <input
          value={deckName}
          onChange={e => setDeckName(e.target.value)}
          className="w-full bg-slate-900/60 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500"
        />
      </div>

      {/* Filtres langues */}
      <div className="grid grid-cols-2 gap-3">
        {([
          ['Langue source', srcLang, setSrcLang],
          ['Langue cible', tgtLang, setTgtLang],
        ] as const).map(([label, val, setter]) => (
          <div key={String(label)}>
            <label className="text-xs text-slate-400 mb-1 block">{String(label)}</label>
            <select
              value={String(val)}
              onChange={e => (setter as (v: string) => void)(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
            >
              <option value="all">Toutes</option>
              {langOptions.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        ))}
      </div>

      {/* Compteur */}
      <div className="flex items-center justify-between bg-slate-900/40 rounded-xl px-4 py-3">
        <span className="text-slate-400 text-sm">Cartes à exporter</span>
        <span className="text-white font-bold">{filtered.length}</span>
      </div>

      {/* Bouton export */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={handleExport}
        disabled={filtered.length === 0}
        className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
      >
        <Download size={16} />
        Télécharger le fichier Anki (.txt)
      </motion.button>

      {/* Instructions d'import Anki */}
      <button
        onClick={() => setShowInstructions(s => !s)}
        className="w-full flex items-center justify-between text-sm text-slate-400 hover:text-slate-300 transition-colors py-1"
      >
        <span>Comment importer dans Anki ?</span>
        {showInstructions ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      <AnimatePresence>
        {showInstructions && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <ol className="text-xs text-slate-300 space-y-1.5 list-decimal list-inside bg-slate-900/30 rounded-xl p-4">
              <li>Ouvrez <strong>Anki Desktop</strong></li>
              <li>Menu <strong>Fichier → Importer</strong></li>
              <li>Sélectionnez le fichier <span className="font-mono bg-slate-800 px-1 rounded">.txt</span> téléchargé</li>
              <li>Type de note : <strong>Basique</strong></li>
              <li>Séparateur : <strong>Tabulation</strong> (détecté automatiquement)</li>
              <li>Cliquez sur <strong>Importer</strong></li>
            </ol>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}
