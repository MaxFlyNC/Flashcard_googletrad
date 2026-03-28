'use strict'

const express  = require('express')
const cors     = require('cors')
const path     = require('path')
const fs       = require('fs')
const crypto   = require('crypto')
const Database = require('better-sqlite3')

// ── Base de données SQLite ────────────────────────────────────────────────────
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'flashcards.db')
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')

db.exec(`
  CREATE TABLE IF NOT EXISTS flashcards (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    front         TEXT    NOT NULL,
    back          TEXT    NOT NULL,
    source_lang   TEXT    NOT NULL DEFAULT 'en',
    target_lang   TEXT    NOT NULL DEFAULT 'fr',
    context       TEXT,
    tags          TEXT,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    imported_from TEXT    NOT NULL DEFAULT 'n8n',
    UNIQUE(front, back)
  );

  CREATE TABLE IF NOT EXISTS sync_log (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    synced_at TEXT NOT NULL DEFAULT (datetime('now')),
    count     INTEGER NOT NULL DEFAULT 0,
    source    TEXT
  );
`)

// ── Application Express ───────────────────────────────────────────────────────
const app       = express()
const API_TOKEN = process.env.API_TOKEN   // undefined = auth désactivée (dev)

app.use(cors({ origin: '*' }))
app.use(express.json({ limit: '20mb' }))

// ── Logs ──────────────────────────────────────────────────────────────────────
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`)
  next()
})

// ── Health check — pas d'auth, pas de cache ───────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.set('Cache-Control', 'no-cache, no-store')
  const count = db.prepare('SELECT COUNT(*) as n FROM flashcards').get().n
  res.json({ status: 'ok', cards: count })
})

// ── Middleware Bearer token (toutes les routes sauf /health) ──────────────────
app.use('/api/', (req, res, next) => {
  if (req.path === '/health') return next()
  if (!API_TOKEN) return next()   // token non configuré → pas d'auth (dev)

  const auth  = req.headers['authorization'] || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''

  if (token !== API_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized — Bearer token requis' })
  }
  next()
})

// ─────────────────────────────────────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────────────────────────────────────

// ── GET /api/flashcards ───────────────────────────────────────────────────────
app.get('/api/flashcards', (req, res) => {
  const { since, lang } = req.query
  let query  = 'SELECT * FROM flashcards'
  const params = []

  if (since) { query += ' WHERE created_at > ?'; params.push(since) }
  if (lang)  {
    query += params.length ? ' AND' : ' WHERE'
    query += ' target_lang = ?'; params.push(lang)
  }
  query += ' ORDER BY created_at DESC'

  const cards = db.prepare(query).all(...params)

  // ETag basé sur le nombre de cartes + id max pour invalidation légère
  const etag = `"${cards.length}-${cards[0]?.id ?? 0}"`
  if (req.headers['if-none-match'] === etag) {
    return res.status(304).end()
  }

  res.set('Cache-Control', 'public, max-age=300')   // 5 min de cache
  res.set('ETag', etag)
  res.json({ cards, total: cards.length })
})

// ── POST /api/flashcards ──────────────────────────────────────────────────────
app.post('/api/flashcards', (req, res) => {
  const { front, back, sourceLang, targetLang, context, importedFrom } = req.body
  if (!front?.trim() || !back?.trim())
    return res.status(400).json({ error: 'front et back sont obligatoires' })

  const result = db.prepare(`
    INSERT OR IGNORE INTO flashcards (front, back, source_lang, target_lang, context, imported_from)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    front.trim(), back.trim(),
    sourceLang || 'en', targetLang || 'fr',
    context || null, importedFrom || 'n8n'
  )

  res.status(result.changes > 0 ? 201 : 200).json({
    inserted: result.changes > 0,
    id: result.lastInsertRowid,
  })
})

// ── POST /api/flashcards/bulk ─────────────────────────────────────────────────
app.post('/api/flashcards/bulk', (req, res) => {
  const { cards, source } = req.body
  if (!Array.isArray(cards) || cards.length === 0)
    return res.status(400).json({ error: 'cards doit être un tableau non vide' })

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO flashcards (front, back, source_lang, target_lang, context, imported_from)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  let imported = 0, skipped = 0
  db.transaction((list) => {
    for (const card of list) {
      if (!card.front?.trim() || !card.back?.trim()) { skipped++; continue }
      const r = stmt.run(
        card.front.trim(), card.back.trim(),
        card.sourceLang || 'en', card.targetLang || 'fr',
        card.context || null, card.importedFrom || source || 'n8n'
      )
      r.changes > 0 ? imported++ : skipped++
    }
  })(cards)

  db.prepare('INSERT INTO sync_log (count, source) VALUES (?, ?)').run(imported, source || 'n8n')
  console.log(`[BULK] Importé: ${imported}, Ignoré: ${skipped}`)
  res.json({ imported, skipped, total: cards.length })
})

// ── GET /api/sync-log ─────────────────────────────────────────────────────────
app.get('/api/sync-log', (_req, res) => {
  res.set('Cache-Control', 'no-cache')
  const logs = db.prepare('SELECT * FROM sync_log ORDER BY synced_at DESC LIMIT 20').all()
  res.json(logs)
})

// ── GET /api/export ───────────────────────────────────────────────────────────
// Téléchargement du fichier SQLite (utilisé par le workflow n8n de backup)
app.get('/api/export', (req, res) => {
  if (!fs.existsSync(DB_PATH))
    return res.status(404).json({ error: 'Base de données introuvable' })

  const filename = `flashcards-backup-${new Date().toISOString().slice(0, 10)}.db`
  res.set('Content-Disposition', `attachment; filename="${filename}"`)
  res.set('Content-Type', 'application/octet-stream')
  res.set('Cache-Control', 'no-store')
  res.sendFile(DB_PATH)
})

// ─────────────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000
app.listen(PORT, '0.0.0.0', () => {
  console.log(`FlashCardTrad API  →  http://0.0.0.0:${PORT}`)
  console.log(`Base de données    →  ${DB_PATH}`)
  console.log(`Auth token         →  ${API_TOKEN ? 'activé' : 'désactivé (dev)'}`)
})
