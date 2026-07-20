import { useEffect, useRef, useState } from 'react'

// Generate confetti particles
function generateConfetti(count = 60) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    color: ['#7c3aed', '#06b6d4', '#f59e0b', '#a855f7', '#22d3ee', '#fff'][Math.floor(Math.random() * 6)],
    size: Math.random() * 8 + 4,
    delay: Math.random() * 1.5,
    duration: Math.random() * 1.5 + 1.5,
    rotation: Math.random() * 360,
  }))
}

export default function ResultScreen({ score, playerName, isSaving, saveError, onPlayAgain, onShowLeaderboard }) {
  const confetti = useRef(generateConfetti()).current
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setShown(true), 100)
    return () => clearTimeout(t)
  }, [])

  const getRating = (s) => {
    if (s >= 80) return { emoji: '🔥', label: 'Legendary!' }
    if (s >= 60) return { emoji: '⚡', label: 'Incredible!' }
    if (s >= 40) return { emoji: '💪', label: 'Amazing!' }
    if (s >= 20) return { emoji: '👏', label: 'Nice work!' }
    return { emoji: '🙌', label: 'Keep going!' }
  }
  const { emoji, label } = getRating(score)

  return (
    <div className="result-screen">
      {/* Confetti */}
      <div className="result-confetti" aria-hidden="true">
        {shown && confetti.map(p => (
          <div
            key={p.id}
            style={{
              position: 'absolute',
              left: `${p.x}%`,
              top: '-10px',
              width: p.size,
              height: p.size * 0.6,
              background: p.color,
              borderRadius: 2,
              animation: `confettiFall ${p.duration}s ${p.delay}s ease-in forwards`,
              transform: `rotate(${p.rotation}deg)`,
            }}
          />
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)', position: 'relative', zIndex: 1 }}>
        <p className="result-score-label">Score</p>
        <p className="result-score-number">{score}</p>
        <p className="result-score-unit">reps in 30 seconds</p>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--space-1)',
          padding: 'var(--space-3) var(--space-5)',
          background: 'var(--glass)',
          border: '1px solid var(--glass-border)',
          borderRadius: 'var(--radius-lg)',
        }}>
          <span style={{ fontSize: '1.8rem' }}>{emoji}</span>
          <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--purple-light)' }}>{label}</span>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Well done, <span className="result-name">{playerName}</span>!
          </span>
        </div>

        {isSaving && (
          <p className="result-saving">
            <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
            Saving to leaderboard…
          </p>
        )}
        {saveError && (
          <p style={{ fontSize: '0.8rem', color: 'var(--red)', textAlign: 'center', maxWidth: 260 }}>
            {saveError}
          </p>
        )}
        {!isSaving && !saveError && (
          <p style={{ fontSize: '0.8rem', color: 'var(--green)' }}>✓ Saved to leaderboard</p>
        )}
      </div>

      <div className="result-actions" style={{ position: 'relative', zIndex: 1 }}>
        <button id="btn-play-again" className="btn btn-primary" onClick={onPlayAgain} style={{ width: '100%' }}>
          Play Again 🔥
        </button>
        <button id="btn-leaderboard" className="btn btn-secondary" onClick={onShowLeaderboard} style={{ width: '100%' }}>
          🏆 Leaderboard
        </button>
      </div>
    </div>
  )
}
