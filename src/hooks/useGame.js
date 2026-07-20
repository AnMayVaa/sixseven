import { useState, useRef, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export const PHASE = {
  ENTER_NAME: 'ENTER_NAME',
  READY:      'READY',      // waiting for hands → auto countdown
  COUNTDOWN:  'COUNTDOWN',  // 3-2-1-GO, cancel if hands lost
  PLAYING:    'PLAYING',
  RESULT:     'RESULT',
}

const GAME_DURATION_SEC = 30

export function useGame() {
  const [phase, setPhase]         = useState(PHASE.ENTER_NAME)
  const [playerName, setPlayerName] = useState('')
  const [reps, setReps]           = useState(0)
  const [timeLeft, setTimeLeft]   = useState(GAME_DURATION_SEC)
  const [countdown, setCountdown] = useState(3)
  const [isSaving, setIsSaving]   = useState(false)
  const [saveError, setSaveError] = useState(null)

  const repsRef      = useRef(0)
  const timerRef     = useRef(null)
  const cdRef        = useRef(null)
  const phaseRef     = useRef(PHASE.ENTER_NAME)

  useEffect(() => { phaseRef.current = phase }, [phase])

  const clearTimers = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (cdRef.current)    clearInterval(cdRef.current)
  }, [])

  // Step 1 → Step 2
  const confirmName = useCallback((name) => {
    setPlayerName(name.trim())
    setPhase(PHASE.READY)
  }, [])

  // Called by GamePage when stable hand presence detected (~1.5s)
  const startCountdown = useCallback(() => {
    if (phaseRef.current !== PHASE.READY) return
    setReps(0)
    repsRef.current = 0
    setTimeLeft(GAME_DURATION_SEC)
    setCountdown(3)
    setPhase(PHASE.COUNTDOWN)

    let count = 3
    cdRef.current = setInterval(() => {
      count--
      if (count > 0) {
        setCountdown(count)
      } else {
        clearInterval(cdRef.current)
        setCountdown(0) // 0 = "GO!"
        setTimeout(() => {
          if (phaseRef.current === PHASE.COUNTDOWN) {
            setPhase(PHASE.PLAYING)
            startGameTimer()
          }
        }, 900)
      }
    }, 1000)
  }, [])

  // Cancel countdown if hands lost — go back to READY
  const cancelCountdown = useCallback(() => {
    if (phaseRef.current !== PHASE.COUNTDOWN) return
    clearInterval(cdRef.current)
    setPhase(PHASE.READY)
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

  const addRep = useCallback(() => {
    if (phaseRef.current !== PHASE.PLAYING) return
    repsRef.current += 1
    setReps(repsRef.current)
  }, [])

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
      setSaveError('Failed to save score.')
    } finally {
      setIsSaving(false)
    }
  }, [])

  const playAgain = useCallback(() => {
    clearTimers()
    setReps(0)
    repsRef.current = 0
    setTimeLeft(GAME_DURATION_SEC)
    setSaveError(null)
    setPhase(PHASE.READY)
  }, [clearTimers])

  const reset = useCallback(() => {
    clearTimers()
    setReps(0)
    repsRef.current = 0
    setTimeLeft(GAME_DURATION_SEC)
    setPlayerName('')
    setSaveError(null)
    setPhase(PHASE.ENTER_NAME)
  }, [clearTimers])

  useEffect(() => () => clearTimers(), [clearTimers])

  return {
    phase, playerName, reps, timeLeft, countdown,
    isSaving, saveError,
    confirmName, startCountdown, cancelCountdown,
    addRep, saveScore, playAgain, reset,
  }
}
