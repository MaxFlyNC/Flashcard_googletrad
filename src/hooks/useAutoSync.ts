import { useEffect, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'
import { syncFromServer, checkApiHealth } from '../lib/serverSync'

const SYNC_INTERVAL_MS = 15 * 60 * 1000   // 15 minutes
const LAST_SYNC_KEY    = 'last_server_sync'

/**
 * Hook qui synchronise automatiquement les flashcards depuis l'API backend
 * (peuplée par le workflow n8n quotidien).
 *
 * Déclencheurs :
 *  - Au démarrage de l'app (si dernière sync > 15 min)
 *  - Au retour sur l'onglet (visibilitychange)
 *  - Toutes les 15 minutes en arrière-plan
 */
export function useAutoSync() {
  const inProgress = useRef(false)

  const doSync = useCallback(async () => {
    if (inProgress.current) return
    inProgress.current = true

    try {
      const online = await checkApiHealth()
      if (!online) return

      const result = await syncFromServer()

      if (result.imported > 0) {
        toast(`✨ ${result.imported} nouvelle${result.imported > 1 ? 's' : ''} carte${result.imported > 1 ? 's' : ''} disponible${result.imported > 1 ? 's' : ''}`, {
          duration: 4000,
          style: {
            background: '#1e1e2e',
            color: '#fff',
            border: '1px solid rgba(99,102,241,0.3)',
            borderRadius: '12px',
            fontSize: '14px',
          },
        })
      }

      localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString())
    } catch {
      // Échec silencieux — pas d'alerte si l'API est hors ligne
    } finally {
      inProgress.current = false
    }
  }, [])

  const shouldSync = useCallback(() => {
    const last = localStorage.getItem(LAST_SYNC_KEY)
    if (!last) return true
    return Date.now() - new Date(last).getTime() > SYNC_INTERVAL_MS
  }, [])

  // Sync au démarrage
  useEffect(() => {
    if (shouldSync()) doSync()
  }, [doSync, shouldSync])

  // Sync quand l'utilisateur revient sur l'onglet
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && shouldSync()) doSync()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [doSync, shouldSync])

  // Sync périodique (toutes les 15 min)
  useEffect(() => {
    const timer = setInterval(doSync, SYNC_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [doSync])
}
