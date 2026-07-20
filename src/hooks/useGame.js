import { useState, useRef, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// Game phases
export const PHASE = {
  ENTER_NAME:  'ENTER_NAME',
  READY:       'READY',
  COUNTDOWN:   'COUNTDOWN',
  PLAYING:     'PLAYING',
  RESULT:      'RESULT',
}

const GAME_DURATION_SEC = 30

export function useGame() {
  const [phase, setPhase]     = useState(PHASE.ENTER_NAME)
  const [playerName, setPlayerName] = useState('')
  const [reps, setReps]       = useState(0)
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION_SEC)
  const [countdown, setCountdown] = useState(3)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  const repsRef       = useRef(0)
  const timerRef      = useRef(null)
  const countdownRef  = useRef(null)
  const phaseRef      = useRef(PHASE.ENTER_NAME)

  // Keep phaseRef in sync
  useEffect(() => { phaseRef.current = phase }, [phase])

  const clearTimers = useCallback(() => {
    if (timerRef.current)    clearInterval(timerRef.current)
    if (countdownRef.current) clearInterval(countdownRef.current)
  }, [])

  // Called when player confirms name
  const confirmName = useCallback((name) => {
    setPlayerName(name.trim())
    setPhase(PHASE.READY)
  }, [])

  // Called when player hits "Ready"
  const startCountdown = useCallback(() => {
    setReps(0)
    repsRef.current = 0
    setTimeLeft(GAME_DURATION_SEC)
    setCountdown(3)
    setPhase(PHASE.COUNTDOWN)

    let count = 3
    countdownRef.current = setInterval(() => {
      count--
      if (count > 0) {
        setCountdown(count)
      } else {
        clearInterval(countdownRef.current)
        setCountdown(0) // 0 = "GO!"
        setTimeout(() => {
          setPhase(PHASE.PLAYING)
          startGameTimer()
        }, 900)
      }
    }, 1000)
  }, [])

  function startGameTimer() {
    let remaining = GAME_DURATION_SEC
    timerRef.current = setInterval(() => {
      remaining--
      setTimeLeft(remaining)
      if (remaining <= 0) {
        clearInterval(timerRef.current)
        setPhase(PHASE.RESULT)
      }
    }, 1000)
  }

  // Called by hand detector on each wave rep
  const addRep = useCallback(() => {
    if (phaseRef.current !== PHASE.PLAYING) return
    repsRef.current += 1
    setReps(repsRef.current)
  }, [])

  // Save score to Supabase
  const saveScore = useCallback(async (name, score) => {
    setIsSaving(true)
    setSaveError(null)
    try {
      const { error } = await supabase
        .from('scores')
        .insert({ player_name: name, score })
      if (error) throw error
    } catch (err) {
      console.error('Save error:', err)
      setSaveError('Failed to save score. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }, [])

  // Restart — keep name, go to READY
  const playAgain = useCallback(() => {
    clearTimers()
    setReps(0)
    repsRef.current = 0
    setTimeLeft(GAME_DURATION_SEC)
    setSaveError(null)
    setPhase(PHASE.READY)
  }, [clearTimers])

  // Full reset (change name)
  const reset = useCallback(() => {
    clearTimers()
    setReps(0)
    repsRef.current = 0
    setTimeLeft(GAME_DURATION_SEC)
    setPlayerName('')
    setSaveError(null)
    setPhase(PHASE.ENTER_NAME)
  }, [clearTimers])

  // Cleanup on unmount
  useEffect(() => () => clearTimers(), [clearTimers])

  return {
    phase,
    playerName,
    reps,
    timeLeft,
    countdown,
    isSaving,
    saveError,
    confirmName,
    startCountdown,
    addRep,
    saveScore,
    playAgain,
    reset,
  }
}
