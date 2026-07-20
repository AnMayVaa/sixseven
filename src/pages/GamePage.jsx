import { useEffect, useCallback, useRef } from 'react'
import CameraView from '../components/CameraView'
import NameEntry from '../components/NameEntry'
import { useHandDetector } from '../hooks/useHandDetector'
import { useGame, PHASE } from '../hooks/useGame'

// Frames of missing hands needed to cancel countdown
const CANCEL_FRAMES = 8

export default function GamePage({ onShowLeaderboard }) {
  const game = useGame()
  const {
    phase, playerName, reps, timeLeft, countdown,
    isSaving, saveError,
    confirmName, startCountdown, cancelCountdown,
    addRep, saveScore, playAgain, reset,
  } = game

  const isPlaying = phase === PHASE.PLAYING
  const noHandFramesRef = useRef(0)

  const detector = useHandDetector({
    onRep:    addRep,
    onStable: startCountdown,  // auto-fires after ~1.5s of hand presence
    active:   isPlaying,
    phase,
  })

  const {
    videoRef, canvasRef,
    isLoading, cameraError,
    _handCount: handCount,
    stableProgress,
    startCamera, stopCamera, resetTrackers,
  } = detector

  // ── Open camera once name is confirmed, keep it open for the full session ──
  const cameraOpenRef = useRef(false)
  useEffect(() => {
    if (phase !== PHASE.ENTER_NAME && !cameraOpenRef.current) {
      cameraOpenRef.current = true
      startCamera()
    }
    if (phase === PHASE.ENTER_NAME) {
      cameraOpenRef.current = false
      stopCamera()
    }
  }, [phase])

  // ── Cancel countdown if both hands disappear ──
  useEffect(() => {
    if (phase !== PHASE.COUNTDOWN) {
      noHandFramesRef.current = 0
      return
    }
    if (handCount === 0) {
      noHandFramesRef.current++
      if (noHandFramesRef.current >= CANCEL_FRAMES) {
        noHandFramesRef.current = 0
        cancelCountdown()
      }
    } else {
      noHandFramesRef.current = 0
    }
  }, [phase, handCount])

  // ── Save score when result phase begins ──
  useEffect(() => {
    if (phase === PHASE.RESULT) {
      saveScore(playerName, reps)
    }
  }, [phase])

  // ── Reset wave trackers on each new READY ──
  useEffect(() => {
    if (phase === PHASE.READY) {
      resetTrackers()
    }
  }, [phase])

  // ── Play Again → back to READY (camera stays open) ──
  const handlePlayAgain = useCallback(() => {
    resetTrackers()
    playAgain() // sets phase → READY, camera stays open
  }, [playAgain, resetTrackers])

  // ── Change Name → full reset ──
  const handleChangeName = useCallback(() => {
    stopCamera()
    reset()
  }, [reset, stopCamera])

  // ── Enter name screen ──
  if (phase === PHASE.ENTER_NAME) {
    return (
      <div className="tab-content">
        <NameEntry onConfirm={confirmName} />
      </div>
    )
  }

  // ── Game screen ──
  return (
    <div className="tab-content">
      <div className="game-page">

        {/* Mini header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', maxWidth: 640,
        }}>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 900 }}>
            <span className="gradient-text">6·7</span>
          </h2>
          <button
            id="btn-change-name-top"
            className="btn btn-ghost"
            onClick={handleChangeName}
          >
            ← Change name
          </button>
        </div>

        <CameraView
          videoRef={videoRef}
          canvasRef={canvasRef}
          isLoading={isLoading}
          cameraError={cameraError}
          handCount={handCount}
          stableProgress={stableProgress}
          phase={phase}
          countdown={countdown}
          reps={reps}
          timeLeft={timeLeft}
          playerName={playerName}
          isSaving={isSaving}
          saveError={saveError}
          onPlayAgain={handlePlayAgain}
          onShowLeaderboard={onShowLeaderboard}
        />

      </div>
    </div>
  )
}
