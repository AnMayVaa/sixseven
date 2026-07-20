import { useState } from 'react'

export default function NameEntry({ onConfirm }) {
  const [name, setName] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (name.trim().length < 1) return
    onConfirm(name.trim())
  }

  return (
    <div className="name-entry animate-fade-in-up">
      <div className="logo">
        <h1 className="logo-title">
          <span className="gradient-text">6</span>
          <span style={{ color: 'var(--text-muted)' }}>·</span>
          <span className="gradient-text">7</span>
        </h1>
        <p className="logo-sub">Hand Wave Speed Challenge</p>
      </div>

      <div className="glass-card" style={{ width: '100%', padding: 'var(--space-8)' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <label htmlFor="player-name">Your Name</label>
            <input
              id="player-name"
              className="input"
              type="text"
              placeholder="Enter your name…"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={24}
              autoFocus
              autoComplete="off"
            />
          </div>

          <button
            id="btn-start"
            type="submit"
            className="btn btn-primary"
            disabled={name.trim().length < 1}
            style={{ width: '100%' }}
          >
            Start Game 🙌
          </button>
        </form>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', textAlign: 'center', maxWidth: 340 }}>
        <div style={{ display: 'flex', gap: 'var(--space-4)', justifyContent: 'center' }}>
          {[
            { emoji: '👐', text: 'Open both hands' },
            { emoji: '🌊', text: 'Wave up & down' },
            { emoji: '⚡', text: 'Go as fast as you can!' },
          ].map(({ emoji, text }) => (
            <div key={text} style={{
              flex: 1,
              padding: 'var(--space-3)',
              background: 'var(--glass)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--glass-border)',
              fontSize: '0.8rem',
              color: 'var(--text-secondary)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-2)',
              alignItems: 'center',
            }}>
              <span style={{ fontSize: '1.5rem' }}>{emoji}</span>
              <span>{text}</span>
            </div>
          ))}
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Each hand wave up <em>or</em> down = 1 rep · 30 seconds · camera required
        </p>
      </div>
    </div>
  )
}
