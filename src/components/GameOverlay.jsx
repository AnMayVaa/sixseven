import { useEffect, useRef, useState } from 'react'

const GAME_DURATION = 30

export default function GameOverlay({ reps, timeLeft, playerName }) {
  const prevReps   = useRef(reps)
  const [bump, setBump] = useState(false)

  // Bump animation on new rep
  useEffect(() => {
    if (reps > prevReps.current) {
      prevReps.current = reps
      setBump(true)
      const t = setTimeout(() => setBump(false), 200)
      return () => clearTimeout(t)
    }
  }, [reps])

  const pct     = (timeLeft / GAME_DURATION) * 100
  const warning = timeLeft <= 10

  return (
    <div className="game-overlay">
      {/* Timer bar */}
      <div className="timer-bar-container">
        <div
          className={`timer-bar-fill ${warning ? 'warning' : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Stats */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-label">Reps</div>
          <div className={`stat-value rep-count ${bump ? 'bump' : ''}`}>
            {reps}
          </div>
        </div>

        <div className="stat-card" style={{ flex: '0 0 auto', minWidth: 100 }}>
          <div className="stat-label">Time</div>
          <div className={`stat-value timer ${warning ? 'warning' : ''}`}>
            {timeLeft}s
          </div>
        </div>
      </div>

      <p className="player-tag">
        Playing as <span>{playerName}</span>
      </p>
    </div>
  )
}
