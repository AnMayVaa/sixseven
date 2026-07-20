import { useEffect, useRef, forwardRef } from 'react'
import Countdown from './Countdown'
import GameOverlay from './GameOverlay'
import ResultScreen from './ResultScreen'
import { PHASE } from '../hooks/useGame'

function CameraView({
  videoRef,
  canvasRef,
  isLoading,
  cameraError,
  handsDetected,
  phase,
  countdown,
  reps,
  timeLeft,
  playerName,
  isSaving,
  saveError,
  onReady,
  onPlayAgain,
  onChangeName,
}, _ref) {

  const isPlaying   = phase === PHASE.PLAYING
  const isCountdown = phase === PHASE.COUNTDOWN
  const isResult    = phase === PHASE.RESULT
  const isReady     = phase === PHASE.READY

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', alignItems: 'center' }}>
      {/* Camera container */}
      <div className={`camera-container ${handsDetected ? 'hands-detected' : ''} ${isPlaying ? 'playing' : ''}`}>
        {isLoading && (
          <div className="camera-loading">
            <div className="spinner" />
            <span>Loading hand detection…</span>
          </div>
        )}
        {cameraError && (
          <div className="camera-loading">
            <span style={{ fontSize: '2rem' }}>⚠️</span>
            <span style={{ color: 'var(--red)', textAlign: 'center', padding: '0 20px' }}>{cameraError}</span>
          </div>
        )}

        <video
          ref={videoRef}
          className="camera-video"
          playsInline
          muted
          style={{ display: isLoading || cameraError ? 'none' : 'block' }}
        />
        <canvas
          ref={canvasRef}
          className="camera-canvas"
          style={{ display: isLoading || cameraError ? 'none' : 'block' }}
        />

        {/* Hands detected badge */}
        {!isLoading && !cameraError && (
          <div className="hands-badge">
            {handsDetected ? '✋ Hands Detected' : '👁 Looking…'}
          </div>
        )}

        {/* Countdown overlay */}
        {isCountdown && <Countdown value={countdown} />}

        {/* Result overlay */}
        {isResult && (
          <ResultScreen
            score={reps}
            playerName={playerName}
            isSaving={isSaving}
            saveError={saveError}
            onPlayAgain={onPlayAgain}
            onChangeName={onChangeName}
          />
        )}
      </div>

      {/* Game overlay (timer + counter) shown during playing */}
      {isPlaying && (
        <GameOverlay reps={reps} timeLeft={timeLeft} playerName={playerName} />
      )}

      {/* Ready section */}
      {isReady && !isLoading && !cameraError && (
        <div className="ready-section">
          <div className="hand-icon">🙌</div>
          <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
            Position both hands in front of the camera
          </p>
          <button
            id="btn-ready"
            className="btn btn-primary"
            onClick={onReady}
            disabled={!handsDetected}
            style={{ opacity: handsDetected ? 1 : 0.5 }}
          >
            {handsDetected ? "I'm Ready! 🔥" : "Show your hands first…"}
          </button>
          {!handsDetected && (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              The button activates once hands are detected
            </p>
          )}
        </div>
      )}

      {/* Player name tag during countdown */}
      {isCountdown && (
        <p className="player-tag">Get ready, <span style={{ color: 'var(--purple-light)', fontWeight: 700 }}>{playerName}</span>!</p>
      )}
    </div>
  )
}

export default CameraView
