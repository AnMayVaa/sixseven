import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const RANK_LABELS = ['🥇', '🥈', '🥉']
const RANK_CLASSES = ['top-1', 'top-2', 'top-3']
const NEW_HIGHLIGHT_MS = 3500
const LIMIT = 50

function timeAgo(isoStr) {
  const diff = Math.floor((Date.now() - new Date(isoStr)) / 1000)
  if (diff < 60)    return 'just now'
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function Leaderboard() {
  const [scores, setScores]         = useState([])
  const [isLoading, setIsLoading]   = useState(true)
  const [error, setError]           = useState(null)
  const [newIds, setNewIds]         = useState(new Set())
  const [realtimeStatus, setRealtimeStatus] = useState('connecting') // 'connecting' | 'live' | 'error'
  const newIdTimers                 = useRef({})
  const channelRef                  = useRef(null)

  // ── Fetch scores ──────────────────────────────────────────────
  const fetchScores = useCallback(async () => {
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('scores')
        .select('id, player_name, score, created_at')
        .order('score', { ascending: false })
        .limit(LIMIT)
      if (err) throw err
      setScores(data ?? [])
    } catch (err) {
      console.error('Fetch error:', err)
      setError('Unable to load scores.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // ── Highlight a new row briefly ───────────────────────────────
  const highlightNew = useCallback((id) => {
    setNewIds(prev => new Set([...prev, id]))
    if (newIdTimers.current[id]) clearTimeout(newIdTimers.current[id])
    newIdTimers.current[id] = setTimeout(() => {
      setNewIds(prev => { const s = new Set(prev); s.delete(id); return s })
      delete newIdTimers.current[id]
    }, NEW_HIGHLIGHT_MS)
  }, [])

  // ── Setup realtime subscription ───────────────────────────────
  const setupRealtime = useCallback(() => {
    // Clean up any existing channel first
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }

    const channel = supabase
      .channel('leaderboard-live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'scores' },
        (payload) => {
          const row = payload.new
          setScores(prev => {
            // Insert & re-sort, keeping top LIMIT
            const merged = [row, ...prev.filter(s => s.id !== row.id)]
              .sort((a, b) => b.score - a.score)
              .slice(0, LIMIT)
            return merged
          })
          highlightNew(row.id)
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'scores' },
        () => {
          // Re-fetch on any update for accuracy
          fetchScores()
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setRealtimeStatus('live')
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setRealtimeStatus('error')
        } else {
          setRealtimeStatus('connecting')
        }
      })

    channelRef.current = channel
  }, [fetchScores, highlightNew])

  useEffect(() => {
    fetchScores()
    setupRealtime()

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
      Object.values(newIdTimers.current).forEach(clearTimeout)
    }
  }, [])

  // ── Status badge ─────────────────────────────────────────────
  const statusBadge = {
    live:       { dot: 'var(--green)',  label: 'Live',        dotClass: 'pulse' },
    connecting: { dot: 'var(--amber)',  label: 'Connecting…', dotClass: ''      },
    error:      { dot: 'var(--red)',    label: 'Reconnecting',dotClass: ''      },
  }[realtimeStatus]

  return (
    <div className="leaderboard-page">
      <div className="leaderboard-header">
        <h1 className="leaderboard-title">
          <span className="gradient-text">Leaderboard</span>
        </h1>
        <p className="leaderboard-subtitle">Top wave champions · Global all-time</p>
        <div style={{ marginTop: 'var(--space-3)', display: 'flex', justifyContent: 'center', gap: 'var(--space-3)', alignItems: 'center' }}>
          <span className="realtime-badge" style={{ borderColor: `${statusBadge.dot}55` }}>
            <span
              className="realtime-dot"
              style={{
                background: statusBadge.dot,
                animation: realtimeStatus === 'live' ? 'pulse 1.5s ease-in-out infinite' : 'none',
              }}
            />
            {statusBadge.label}
          </span>
          <button
            id="btn-refresh-lb"
            className="btn btn-ghost"
            onClick={fetchScores}
            style={{ fontSize: '0.8rem', padding: '4px 10px' }}
            title="Refresh"
          >
            ↻
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="lb-loading">
          <div className="spinner" />
          <span>Loading scores…</span>
        </div>
      )}

      {error && !isLoading && (
        <div className="lb-empty">
          <span className="emoji">⚠️</span>
          <p style={{ color: 'var(--red)' }}>{error}</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 'var(--space-2)' }}>
            Make sure the <code>scores</code> table exists in Supabase
          </p>
          <button className="btn btn-secondary" onClick={fetchScores} style={{ marginTop: 'var(--space-4)' }}>
            Retry
          </button>
        </div>
      )}

      {!isLoading && !error && scores.length === 0 && (
        <div className="lb-empty">
          <span className="emoji">🏆</span>
          <p>No scores yet — be the first!</p>
        </div>
      )}

      {!isLoading && !error && scores.length > 0 && (
        <div className="leaderboard-list">
          {scores.map((entry, idx) => {
            const isTop3 = idx < 3
            const isNew  = newIds.has(entry.id)
            return (
              <div
                key={entry.id}
                className={`lb-row ${isTop3 ? RANK_CLASSES[idx] : ''} ${isNew ? 'new-entry' : ''}`}
                style={{ animationDelay: `${idx * 30}ms` }}
              >
                <div className={`lb-rank ${idx === 0 ? 'gold' : idx === 1 ? 'silver' : idx === 2 ? 'bronze' : ''}`}>
                  {isTop3 ? RANK_LABELS[idx] : `#${idx + 1}`}
                </div>

                <div className="lb-avatar">
                  {entry.player_name.charAt(0).toUpperCase()}
                </div>

                <div className="lb-name">{entry.player_name}</div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <span className={`lb-score ${isNew ? 'new-score-pop' : ''}`}>{entry.score}</span>
                  <span className="lb-unit">reps</span>
                </div>

                <div className="lb-date">{timeAgo(entry.created_at)}</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
