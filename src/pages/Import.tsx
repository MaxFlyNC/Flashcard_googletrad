import { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, FileJson, Plus, Trash2, CheckCircle2, BookOpen, Info, ScanLine, Loader2, Languages } from 'lucide-react'
import toast from 'react-hot-toast'
import { parseGoogleTakeout, parsePlainText, langName, LANGUAGE_NAMES } from '../lib/googleTranslateParser'
import { importCards, db } from '../lib/db'
import { Flashcard } from '../lib/types'
import { getInitialCardState } from '../lib/srs'
import { translateText } from '../lib/translate'

type Tab = 'takeout' | 'text' | 'manual' | 'scan'

export default function Import() {
  const [tab, setTab] = useState<Tab>('takeout')
  const [dragging, setDragging] = useState(false)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null)

  // Text import
  const [textInput, setTextInput] = useState('')
  const [textSrcLang, setTextSrcLang] = useState('en')
  const [textTgtLang, setTextTgtLang] = useState('fr')

  // Manual entry
  const [manualFront, setManualFront] = useState('')
  const [manualBack, setManualBack] = useState('')
  const [manualSrc, setManualSrc] = useState('en')
  const [manualTgt, setManualTgt] = useState('fr')

  // ─── JSON Takeout ─────────────────────────────────────────────────────────

  const handleFile = useCallback(async (file: File) => {
    setImporting(true)
    setResult(null)
    try {
      const text = await file.text()
      const json = JSON.parse(text)
      const cards = parseGoogleTakeout(json)
      if (cards.length === 0) {
        toast.error('Aucune traduction trouvée dans ce fichier.')
        setImporting(false)
        return
      }
      const res = await importCards(cards)
      setResult(res)
      toast.success(`${res.imported} cartes importées !`)
    } catch {
      toast.error('Fichier invalide. Vérifiez le format JSON.')
    }
    setImporting(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  // ─── Text Import ──────────────────────────────────────────────────────────

  const handleTextImport = async () => {
    setImporting(true)
    setResult(null)
    const cards = parsePlainText(textInput).map(c => ({
      ...c,
      sourceLang: textSrcLang,
      targetLang: textTgtLang,
    }))
    if (cards.length === 0) {
      toast.error('Aucune paire trouvée. Format: "mot = traduction" ou tabulation.')
      setImporting(false)
      return
    }
    const res = await importCards(cards)
    setResult(res)
    toast.success(`${res.imported} cartes importées !`)
    setImporting(false)
  }

  // ─── Manual Add ───────────────────────────────────────────────────────────

  const handleManualAdd = async () => {
    if (!manualFront.trim() || !manualBack.trim()) {
      toast.error('Remplissez les deux champs')
      return
    }
    const card: Flashcard = {
      front: manualFront.trim(),
      back: manualBack.trim(),
      sourceLang: manualSrc,
      targetLang: manualTgt,
      createdAt: new Date(),
      importedFrom: 'manual',
      ...getInitialCardState(),
    }
    await db.flashcards.add(card)
    toast.success('Carte ajoutée !')
    setManualFront('')
    setManualBack('')
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'takeout', label: 'Google Takeout', icon: <FileJson size={16} /> },
    { id: 'text', label: 'Texte / CSV', icon: <BookOpen size={16} /> },
    { id: 'manual', label: 'Manuel', icon: <Plus size={16} /> },
    { id: 'scan', label: 'Scanner', icon: <ScanLine size={16} /> },
  ]

  const langOptions = Object.entries(LANGUAGE_NAMES).filter(([k]) => k !== 'auto')

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 p-4 pb-28">
      <div className="max-w-2xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-1">Importer des cartes</h1>
          <p className="text-slate-400 text-sm">Ajoutez votre vocabulaire depuis Google Traduction ou manuellement</p>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-800/60 rounded-xl p-1 mb-6">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setResult(null) }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                tab === t.id
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {t.icon}
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">

          {/* ── Google Takeout ──────────────────────────────────────────── */}
          {tab === 'takeout' && (
            <motion.div key="takeout" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">

              {/* How-to */}
              <div className="bg-indigo-900/30 border border-indigo-500/30 rounded-xl p-4 flex gap-3">
                <Info size={18} className="text-indigo-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-indigo-200 space-y-1">
                  <p className="font-medium">Comment exporter votre historique Google Traduction :</p>
                  <ol className="list-decimal list-inside space-y-0.5 text-indigo-300">
                    <li>Allez sur <span className="font-mono bg-indigo-900/50 px-1 rounded">takeout.google.com</span></li>
                    <li>Sélectionnez uniquement <strong>Google Traduction</strong></li>
                    <li>Téléchargez et décompressez l'archive</li>
                    <li>Importez le fichier <span className="font-mono bg-indigo-900/50 px-1 rounded">.json</span> ci-dessous</li>
                  </ol>
                </div>
              </div>

              {/* Drop Zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                className={`relative border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-200 cursor-pointer
                  ${dragging ? 'border-indigo-400 bg-indigo-900/30' : 'border-slate-600 hover:border-slate-400 bg-slate-800/30'}`}
              >
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileInput}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <motion.div animate={dragging ? { scale: 1.1 } : { scale: 1 }}>
                  <Upload size={40} className={`mx-auto mb-3 ${dragging ? 'text-indigo-400' : 'text-slate-500'}`} />
                  <p className="text-white font-medium">Glissez votre fichier JSON ici</p>
                  <p className="text-slate-400 text-sm mt-1">ou cliquez pour choisir un fichier</p>
                </motion.div>
              </div>

              {importing && (
                <div className="text-center py-4">
                  <div className="inline-block w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-slate-400 mt-2 text-sm">Import en cours…</p>
                </div>
              )}
            </motion.div>
          )}

          {/* ── Text / CSV ──────────────────────────────────────────────── */}
          {tab === 'text' && (
            <motion.div key="text" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">
              <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4 text-sm text-slate-300">
                <p className="font-medium mb-1">Formats acceptés :</p>
                <p className="font-mono text-xs text-slate-400">hello = bonjour</p>
                <p className="font-mono text-xs text-slate-400">dog[tab]chien</p>
                <p className="font-mono text-xs text-slate-400">cat - chat</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[['De', textSrcLang, setTextSrcLang], ['Vers', textTgtLang, setTextTgtLang]].map(([label, val, setter]) => (
                  <div key={String(label)}>
                    <label className="text-xs text-slate-400 mb-1 block">{String(label)}</label>
                    <select
                      value={String(val)}
                      onChange={e => (setter as (v: string) => void)(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                    >
                      {langOptions.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                ))}
              </div>

              <textarea
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                placeholder={"hello = bonjour\ndog = chien\ncat = chat"}
                rows={10}
                className="w-full bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-3 text-white text-sm font-mono placeholder-slate-600 focus:outline-none focus:border-indigo-500 resize-none"
              />

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleTextImport}
                disabled={importing || !textInput.trim()}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors"
              >
                {importing ? 'Import…' : 'Importer'}
              </motion.button>
            </motion.div>
          )}

          {/* ── Scanner (Scanmarker Air) ─────────────────────────────── */}
          {tab === 'scan' && (
            <motion.div key="scan" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
              <ScanTab />
            </motion.div>
          )}

          {/* ── Manual ──────────────────────────────────────────────────── */}
          {tab === 'manual' && (
            <motion.div key="manual" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[['Langue source', manualSrc, setManualSrc], ['Langue cible', manualTgt, setManualTgt]].map(([label, val, setter]) => (
                  <div key={String(label)}>
                    <label className="text-xs text-slate-400 mb-1 block">{String(label)}</label>
                    <select
                      value={String(val)}
                      onChange={e => (setter as (v: string) => void)(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                    >
                      {langOptions.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                ))}
              </div>

              <div>
                <label className="text-xs text-slate-400 mb-1 block">Mot / phrase ({langName(manualSrc)})</label>
                <input
                  value={manualFront}
                  onChange={e => setManualFront(e.target.value)}
                  placeholder="Ex: hello"
                  className="w-full bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Traduction ({langName(manualTgt)})</label>
                <input
                  value={manualBack}
                  onChange={e => setManualBack(e.target.value)}
                  placeholder="Ex: bonjour"
                  onKeyDown={e => e.key === 'Enter' && handleManualAdd()}
                  className="w-full bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleManualAdd}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <Plus size={18} />
                Ajouter la carte
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Result */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-6 bg-emerald-900/30 border border-emerald-500/30 rounded-xl p-4"
            >
              <div className="flex items-center gap-3">
                <CheckCircle2 className="text-emerald-400" size={24} />
                <div>
                  <p className="text-white font-semibold">Import réussi !</p>
                  <p className="text-emerald-300 text-sm">
                    {result.imported} nouvelles cartes
                    {result.skipped > 0 && ` · ${result.skipped} doublons ignorés`}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Manage section */}
        <ManageCards />
      </div>
    </div>
  )
}

// ─── Scanner Tab ────────────────────────────────────────────────────────────

function ScanTab() {
  const [srcLang, setSrcLang] = useState('en')
  const [tgtLang, setTgtLang] = useState('fr')
  const [scanInput, setScanInput] = useState('')
  const [translating, setTranslating] = useState(false)
  const [scannedCards, setScannedCards] = useState<{ front: string; back: string }[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const langOptions = Object.entries(LANGUAGE_NAMES).filter(([k]) => k !== 'auto')

  // Auto-focus on mount so Scanmarker sends directly here
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleScan = async (text: string) => {
    const word = text.trim()
    if (!word) return

    setScanInput('')
    setTranslating(true)

    try {
      const { translatedText, detectedSourceLang } = await translateText(word, srcLang, tgtLang)

      const card: Flashcard = {
        front: word,
        back: translatedText,
        sourceLang: detectedSourceLang || srcLang,
        targetLang: tgtLang,
        createdAt: new Date(),
        importedFrom: 'manual',
        ...getInitialCardState(),
      }

      await db.flashcards.add(card)
      setScannedCards(prev => [{ front: word, back: translatedText }, ...prev.slice(0, 9)])
      toast.success(`"${word}" → "${translatedText}"`)
    } catch {
      toast.error('Traduction impossible. Vérifiez votre connexion.')
    }

    setTranslating(false)
    // Re-focus for next scan
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleScan(scanInput)
    }
  }

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="bg-violet-900/30 border border-violet-500/30 rounded-xl p-4 flex gap-3">
        <ScanLine size={18} className="text-violet-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-violet-200 space-y-1">
          <p className="font-medium">Mode Scanmarker Air</p>
          <p className="text-violet-300 text-xs">
            Scannez un mot avec votre stylo — il est envoyé automatiquement ici.
            La traduction et la flashcard sont créées instantanément.
          </p>
        </div>
      </div>

      {/* Language selectors */}
      <div className="grid grid-cols-2 gap-3">
        {([['Langue source', srcLang, setSrcLang], ['Langue cible', tgtLang, setTgtLang]] as const).map(([label, val, setter]) => (
          <div key={String(label)}>
            <label className="text-xs text-slate-400 mb-1 block">{String(label)}</label>
            <select
              value={String(val)}
              onChange={e => (setter as (v: string) => void)(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
            >
              {langOptions.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        ))}
      </div>

      {/* Scan input */}
      <div className="relative">
        <div className="absolute inset-0 rounded-xl bg-violet-500/10 animate-pulse pointer-events-none" />
        <div className="relative flex items-center gap-3 bg-slate-800/60 border-2 border-violet-500/50 rounded-xl px-4 py-3 focus-within:border-violet-400 transition-colors">
          {translating ? (
            <Loader2 size={18} className="text-violet-400 animate-spin flex-shrink-0" />
          ) : (
            <Languages size={18} className="text-violet-400 flex-shrink-0" />
          )}
          <input
            ref={inputRef}
            value={scanInput}
            onChange={e => setScanInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={translating ? 'Traduction…' : 'Prêt à scanner — ou tapez et appuyez sur Entrée'}
            disabled={translating}
            className="flex-1 bg-transparent text-white placeholder-slate-500 focus:outline-none text-sm"
          />
        </div>
      </div>

      <p className="text-center text-xs text-slate-500">
        Appuyez sur <kbd className="bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded text-xs">Entrée</kbd> pour valider
      </p>

      {/* Scanned cards feed */}
      {scannedCards.length > 0 && (
        <div className="space-y-2 mt-2">
          <p className="text-xs text-slate-400 font-medium">Cartes créées cette session</p>
          <AnimatePresence initial={false}>
            {scannedCards.map((c, i) => (
              <motion.div
                key={`${c.front}-${i}`}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 bg-slate-800/40 border border-slate-700/40 rounded-xl px-4 py-3"
              >
                <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0" />
                <div className="flex-1 min-w-0 flex gap-2 items-center">
                  <span className="text-white text-sm truncate">{c.front}</span>
                  <span className="text-slate-500 text-xs">→</span>
                  <span className="text-indigo-300 text-sm truncate">{c.back}</span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

// ─── Manage Cards ────────────────────────────────────────────────────────────

function ManageCards() {
  const [cards, setCards] = useState<Flashcard[]>([])
  const [loaded, setLoaded] = useState(false)

  const load = async () => {
    const all = await db.flashcards.orderBy('createdAt').reverse().limit(20).toArray()
    setCards(all)
    setLoaded(true)
  }

  const remove = async (id: number) => {
    await db.flashcards.delete(id)
    setCards(prev => prev.filter(c => c.id !== id))
    toast.success('Carte supprimée')
  }

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-white font-semibold">Cartes récentes</h2>
        <button onClick={load} className="text-indigo-400 text-sm hover:text-indigo-300">
          {loaded ? 'Rafraîchir' : 'Afficher'}
        </button>
      </div>
      {loaded && (
        <div className="space-y-2">
          {cards.length === 0 && (
            <p className="text-slate-500 text-sm text-center py-4">Aucune carte importée</p>
          )}
          {cards.map(card => (
            <motion.div
              key={card.id}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-3 bg-slate-800/40 border border-slate-700/40 rounded-xl px-4 py-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm truncate">{card.front}</p>
                <p className="text-slate-400 text-xs truncate">{card.back}</p>
              </div>
              <button onClick={() => remove(card.id!)} className="text-slate-600 hover:text-red-400 transition-colors">
                <Trash2 size={16} />
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
