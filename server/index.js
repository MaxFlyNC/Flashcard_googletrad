'use strict'

const express = require('express')
const cors    = require('cors')
const path    = require('path')
const Database = require('better-sqlite3')

// ── Base de données SQLite ────────────────────────────────────────────────────
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'flashcards.db')

// Créer le dossier data si nécessaire
const fs = require('fs')
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')  // Meilleure performance en écriture

db.exec(`
  CREATE TABLE IF NOT EXISTS flashcards (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    front        TEXT    NOT NULL,
    back         TEXT    NOT NULL,
    source_lang  TEXT    NOT NULL DEFAULT 'en',
    target_lang  TEXT    NOT NULL DEFAULT 'fr',
    context      TEXT,
    tags         TEXT,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    imported_from TEXT   NOT NULL DEFAULT 'n8n',
    UNIQUE(front, back)
  );

  CREATE TABLE IF NOT EXISTS sync_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    synced_at  TEXT NOT NULL DEFAULT (datetime('now')),
    count      INTEGER NOT NULL DEFAULT 0,
    source     TEXT
  );
`)

// ── Application Express ───────────────────────────────────────────────────────
const app = express()

app.use(cors({ origin: '*' }))
app.use(express.json({ limit: '20mb' }))

// ── Logs simples ──────────────────────────────────────────────────────────────
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`)
  next()
})

// ─────────────────────────────────────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────────────────────────────────────

// Health check (utilisé par Docker et n8n)
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', cards: db.prepare('SELECT COUNT(*) as n FROM flashcards').get().n })
})

// ── GET /api/flashcards ───────────────────────────────────────────────────────
// Retourne toutes les cartes (utilisé par le bouton "Sync" du frontend)
app.get('/api/flashcards', (req, res) => {
  const { since, lang } = req.query
  let query = 'SELECT * FROM flashcards'
  const params = []

  if (since) {
    query += ' WHERE created_at > ?'
    params.push(since)
  }
  if (lang) {
    query += params.length ? ' AND' : ' WHERE'
    query += ' target_lang = ?'
    params.push(lang)
  }

  query += ' ORDER BY created_at DESC'

  const cards = db.prepare(query).all(...params)
  res.json({ cards, total: cards.length })
})

// ── POST /api/flashcards ──────────────────────────────────────────────────────
// Ajoute une seule carte (pour tests)
app.post('/api/flashcards', (req, res) => {
  const { front, back, sourceLang, targetLang, context, importedFrom } = req.body

  if (!front?.trim() || !back?.trim()) {
    return res.status(400).json({ error: 'front et back sont obligatoires' })
  }

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO flashcards (front, back, source_lang, target_lang, context, imported_from)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  const result = stmt.run(
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
// Import en masse — appelé par n8n à la fin du workflow d'enrichissement
app.post('/api/flashcards/bulk', (req, res) => {
  const { cards, source } = req.body

  if (!Array.isArray(cards) || cards.length === 0) {
    return res.status(400).json({ error: 'cards doit être un tableau non vide' })
  }

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO flashcards (front, back, source_lang, target_lang, context, imported_from)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  let imported = 0
  let skipped  = 0

  const insertAll = db.transaction((list) => {
    for (const card of list) {
      if (!card.front?.trim() || !card.back?.trim()) { skipped++; continue }
      const r = stmt.run(
        card.front.trim(), card.back.trim(),
        card.sourceLang || 'en', card.targetLang || 'fr',
        card.context    || null, card.importedFrom || source || 'n8n'
      )
      r.changes > 0 ? imported++ : skipped++
    }
  })

  insertAll(cards)

  // Enregistrer dans le log de sync
  db.prepare('INSERT INTO sync_log (count, source) VALUES (?, ?)').run(imported, source || 'n8n')

  console.log(`[BULK] Importé: ${imported}, Ignoré (doublons): ${skipped}`)
  res.json({ imported, skipped, total: cards.length })
})

// ── GET /api/sync-log ─────────────────────────────────────────────────────────
app.get('/api/sync-log', (_req, res) => {
  const logs = db.prepare('SELECT * FROM sync_log ORDER BY synced_at DESC LIMIT 20').all()
  res.json(logs)
})

// ─────────────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000
app.listen(PORT, '0.0.0.0', () => {
  console.log(`FlashCardTrad API  →  http://0.0.0.0:${PORT}`)
  console.log(`Base de données    →  ${DB_PATH}`)
})
