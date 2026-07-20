import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

const RANK_LABELS = ['🥇', '🥈', '🥉']
const RANK_CLASSES = ['top-1', 'top-2', 'top-3']

function timeAgo(isoStr) {
  const diff = Math.floor((Date.now() - new Date(isoStr)) / 1000)
  if (diff < 60)  return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function Leaderboard() {
  const [scores, setScores]       = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError]         = useState(null)
  const [newIds, setNewIds]       = useState(new Set())
  const newIdTimers               = useRef({})

  // Fetch top 50 scores
  const fetchScores = async () => {
    try {
      const { data, error } = await supabase
        .from('scores')
        .select('*')
        .order('score', { ascending: false })
        .limit(50)
      if (error) throw error
      setScores(data || [])
    } catch (err) {
      console.error('Fetch error:', err)
      setError('Unable to load scores. Check your connection.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchScores()

    // Realtime subscription
    const channel = supabase
      .channel('scores-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'scores' }, payload => {
        const newScore = payload.new
        setScores(prev => {
          const updated = [newScore, ...prev]
            .sort((a, b) => b.score - a.score)
            .slice(0, 50)
          return updated
        })
        // Highlight new entry
        setNewIds(prev => new Set([...prev, newScore.id]))
        if (newIdTimers.current[newScore.id]) clearTimeout(newIdTimers.current[newScore.id])
        newIdTimers.current[newScore.id] = setTimeout(() => {
          setNewIds(prev => { const s = new Set(prev); s.delete(newScore.id); return s })
        }, 3000)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      Object.values(newIdTimers.current).forEach(clearTimeout)
    }
  }, [])

  return (
    <div className="leaderboard-page">
      <div className="leaderboard-header">
        <h1 className="leaderboard-title">
          <span className="gradient-text">Leaderboard</span>
        </h1>
        <p className="leaderboard-subtitle">Top wave champions · Global all-time</p>
        <div style={{ marginTop: 'var(--space-3)', display: 'flex', justifyContent: 'center', gap: 'var(--space-3)' }}>
          <span className="realtime-badge">
            <span className="realtime-dot" />
            Live
          </span>
        </div>
      </div>

      {isLoading && (
        <div className="lb-loading">
          <div className="spinner" />
          <span>Loading scores…</span>
        </div>
      )}

      {error && (
        <div className="lb-empty">
          <span className="emoji">⚠️</span>
          <p style={{ color: 'var(--red)' }}>{error}</p>
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
                style={{ animationDelay: `${idx * 40}ms` }}
              >
                <div className={`lb-rank ${idx === 0 ? 'gold' : idx === 1 ? 'silver' : idx === 2 ? 'bronze' : ''}`}>
                  {isTop3 ? RANK_LABELS[idx] : `#${idx + 1}`}
                </div>

                <div className="lb-avatar">
                  {entry.player_name.charAt(0).toUpperCase()}
                </div>

                <div className="lb-name">{entry.player_name}</div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <span className="lb-score">{entry.score}</span>
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
