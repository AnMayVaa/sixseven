import { useEffect, useCallback } from 'react'
import CameraView from '../components/CameraView'
import NameEntry from '../components/NameEntry'
import { useHandDetector } from '../hooks/useHandDetector'
import { useGame, PHASE } from '../hooks/useGame'

export default function GamePage() {
  const game = useGame()
  const {
    phase, playerName, reps, timeLeft, countdown,
    isSaving, saveError,
    confirmName, startCountdown, addRep, saveScore, playAgain, reset,
  } = game

  const isActive = phase === PHASE.PLAYING

  const detector = useHandDetector({
    onRep: addRep,
    active: isActive,
  })
  const { videoRef, canvasRef, isLoading, cameraError, handsDetected, startCamera, stopCamera, resetTrackers } = detector

  // Start camera once name is confirmed
  useEffect(() => {
    if (phase !== PHASE.ENTER_NAME) {
      startCamera()
    }
    return () => {
      if (phase === PHASE.ENTER_NAME) stopCamera()
    }
  }, [phase === PHASE.ENTER_NAME])

  // Save score when result phase begins
  useEffect(() => {
    if (phase === PHASE.RESULT) {
      saveScore(playerName, reps)
    }
  }, [phase])

  // Reset wave trackers on new game
  useEffect(() => {
    if (phase === PHASE.READY) {
      resetTrackers()
    }
  }, [phase])

  const handlePlayAgain = useCallback(() => {
    resetTrackers()
    playAgain()
  }, [playAgain, resetTrackers])

  const handleChangeName = useCallback(() => {
    stopCamera()
    reset()
  }, [reset, stopCamera])

  if (phase === PHASE.ENTER_NAME) {
    return (
      <div className="tab-content">
        <NameEntry onConfirm={confirmName} />
      </div>
    )
  }

  return (
    <div className="tab-content">
      <div className="game-page">
        {/* Mini logo header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: 640 }}>
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
          handsDetected={handsDetected}
          phase={phase}
          countdown={countdown}
          reps={reps}
          timeLeft={timeLeft}
          playerName={playerName}
          isSaving={isSaving}
          saveError={saveError}
          onReady={startCountdown}
          onPlayAgain={handlePlayAgain}
          onChangeName={handleChangeName}
        />
      </div>
    </div>
  )
}
