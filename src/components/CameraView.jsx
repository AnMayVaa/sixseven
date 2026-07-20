import Countdown from './Countdown'
import GameOverlay from './GameOverlay'
import ResultScreen from './ResultScreen'
import { PHASE } from '../hooks/useGame'

export default function CameraView({
  videoRef, canvasRef,
  isLoading, cameraError,
  handCount, stableProgress,
  phase, countdown,
  reps, timeLeft, playerName,
  isSaving, saveError,
  onPlayAgain, onShowLeaderboard,
}) {
  const isPlaying    = phase === PHASE.PLAYING
  const isCountdown  = phase === PHASE.COUNTDOWN
  const isResult     = phase === PHASE.RESULT
  const isReady      = phase === PHASE.READY
  const handsPresent = handCount > 0

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', alignItems: 'center' }}>

      {/* Camera container */}
      <div className={`camera-container ${handsPresent ? 'hands-detected' : ''} ${isPlaying ? 'playing' : ''}`}>

        {/* Loading */}
        {isLoading && (
          <div className="camera-loading">
            <div className="spinner" />
            <span>Loading hand detection…</span>
          </div>
        )}

        {/* Camera error */}
        {cameraError && (
          <div className="camera-loading">
            <span style={{ fontSize: '2rem' }}>⚠️</span>
            <span style={{ color: 'var(--red)', textAlign: 'center', padding: '0 20px' }}>{cameraError}</span>
          </div>
        )}

        {/* Video + canvas */}
        <video
          ref={videoRef}
          className="camera-video"
          playsInline muted
          style={{ display: isLoading || cameraError ? 'none' : 'block' }}
        />
        <canvas
          ref={canvasRef}
          className="camera-canvas"
          style={{ display: isLoading || cameraError ? 'none' : 'block' }}
        />

        {/* READY: "show hands" instruction overlay */}
        {isReady && !isLoading && !cameraError && (
          <ReadyOverlay handCount={handCount} stableProgress={stableProgress} />
        )}

        {/* COUNTDOWN: 3-2-1-GO! */}
        {isCountdown && <Countdown value={countdown} />}

        {/* RESULT */}
        {isResult && (
          <ResultScreen
            score={reps}
            playerName={playerName}
            isSaving={isSaving}
            saveError={saveError}
            onPlayAgain={onPlayAgain}
            onShowLeaderboard={onShowLeaderboard}
          />
        )}
      </div>

      {/* In-game HUD */}
      {isPlaying && (
        <GameOverlay reps={reps} timeLeft={timeLeft} playerName={playerName} />
      )}

      {/* Countdown player name tag */}
      {isCountdown && (
        <p className="player-tag">
          Get ready, <span style={{ color: 'var(--purple-light)', fontWeight: 700 }}>{playerName}</span>!
        </p>
      )}
    </div>
  )
}

// ── READY overlay ─────────────────────────────────────────────
function ReadyOverlay({ handCount, stableProgress }) {
  const pct    = Math.round(stableProgress * 100)
  const hasHands = handCount > 0

  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'flex-end',
      padding: 'var(--space-6)',
      background: hasHands
        ? 'linear-gradient(to top, rgba(6,6,8,0.85) 0%, transparent 60%)'
        : 'rgba(6,6,8,0.6)',
      zIndex: 5,
      borderRadius: 'var(--radius-xl)',
      pointerEvents: 'none',
    }}>

      {!hasHands ? (
        // No hands yet
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)', paddingBottom: 'var(--space-4)' }}>
          <div style={{ fontSize: '2.5rem', animation: 'float 2s ease-in-out infinite' }}>👐</div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', textAlign: 'center' }}>
            Show your open hands to the camera
          </p>
        </div>
      ) : (
        // Hands detected — show progress bar
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', alignItems: 'center' }}>
          <p style={{ fontSize: '0.9rem', color: 'var(--cyan-light)', fontWeight: 600, textAlign: 'center' }}>
            {pct < 100 ? `Hold still… ${pct}%` : '🔥 Starting!'}
          </p>
          {/* Progress bar */}
          <div style={{
            width: '80%', height: 6,
            background: 'rgba(255,255,255,0.1)',
            borderRadius: 'var(--radius-full)',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${pct}%`,
              background: 'var(--grad-primary)',
              borderRadius: 'var(--radius-full)',
              transition: 'width 0.1s linear',
              boxShadow: '0 0 10px rgba(6,182,212,0.6)',
            }} />
          </div>
        </div>
      )}
    </div>
  )
}
