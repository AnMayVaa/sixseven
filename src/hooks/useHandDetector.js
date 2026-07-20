import { useRef, useEffect, useCallback, useState } from 'react'
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'

// Per-hand wave tracker
function createTracker() {
  return {
    yBuf: [],          // last N raw Y values for smoothing
    lastDir: null,     // 'up' | 'down'
    lastRepTime: 0,    // timestamp of last counted rep
    lastRepY: null,    // Y position when last rep was counted
  }
}

const BUF_SIZE      = 4      // frames to average for smooth Y
const AMP_THRESH    = 0.035  // minimum Y travel from last rep to count new one
const DEBOUNCE_MS   = 85     // min ms between reps per hand
const STABLE_FRAMES = 80     // frames of continuous detection to auto-start (~1.5s at 30fps)
const DECAY_RATE    = 2      // frames to subtract when hands lost

export function useHandDetector({ onRep, onStable, active, phase }) {
  const videoRef        = useRef(null)
  const canvasRef       = useRef(null)
  const landmarkerRef   = useRef(null)
  const rafRef          = useRef(null)
  const streamRef       = useRef(null)
  const trackersRef     = useRef({ Left: createTracker(), Right: createTracker() })

  // Stable-hand counting for auto-start
  const stableCountRef    = useRef(0)
  const stableFiredRef    = useRef(false)

  // Keep refs current without causing re-renders
  const activeRef    = useRef(active)
  const phaseRef     = useRef(phase)
  const onRepRef     = useRef(onRep)
  const onStableRef  = useRef(onStable)

  useEffect(() => { activeRef.current = active },   [active])
  useEffect(() => { phaseRef.current = phase },     [phase])
  useEffect(() => { onRepRef.current = onRep },     [onRep])
  useEffect(() => { onStableRef.current = onStable }, [onStable])

  const [isLoading, setIsLoading]       = useState(true)
  const [cameraError, setCameraError]   = useState(null)
  const [handCount, setHandCount]       = useState(0)
  const [stableProgress, setStableProgress] = useState(0) // 0..1

  // Reset stable counter whenever phase changes
  useEffect(() => {
    stableCountRef.current = 0
    stableFiredRef.current = false
    setStableProgress(0)
  }, [phase])

  // ── Init MediaPipe ──────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    async function init() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        )
        const hl = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 2,
        })
        if (!cancelled) landmarkerRef.current = hl
      } catch (err) {
        if (!cancelled) {
          console.error('MediaPipe init:', err)
          setCameraError('Failed to load hand detection model.')
        }
      }
    }
    init()
    return () => { cancelled = true }
  }, [])

  // ── Camera ──────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setIsLoading(false)
    } catch {
      setCameraError('Camera access denied. Please allow camera and refresh.')
      setIsLoading(false)
    }
  }, [])

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }, [])

  // ── Detection loop ──────────────────────────────────────────
  useEffect(() => {
    if (isLoading || cameraError) return

    const detect = () => {
      rafRef.current = requestAnimationFrame(detect)
      const video  = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas || !landmarkerRef.current || video.readyState < 2) return

      const now     = performance.now()
      const results = landmarkerRef.current.detectForVideo(video, now)
      const count   = results.landmarks?.length ?? 0
      setHandCount(count)

      // Canvas setup
      const ctx = canvas.getContext('2d')
      canvas.width  = video.videoWidth  || 640
      canvas.height = video.videoHeight || 480
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const currentPhase = phaseRef.current

      // ── Auto-start stable counting (READY phase only) ──
      if (currentPhase === 'READY') {
        if (count > 0) {
          stableCountRef.current = Math.min(stableCountRef.current + 1, STABLE_FRAMES)
        } else {
          stableCountRef.current = Math.max(0, stableCountRef.current - DECAY_RATE)
        }
        const prog = stableCountRef.current / STABLE_FRAMES
        setStableProgress(prog)
        if (prog >= 1 && !stableFiredRef.current) {
          stableFiredRef.current = true
          onStableRef.current?.()
        }
      }

      // ── Draw dots + wave detection ──
      if (count > 0) {
        results.landmarks.forEach((landmarks, i) => {
          const handedness = results.handednesses[i]?.[0]?.categoryName ?? 'Right'

          // Draw progress ring during READY
          const prog = currentPhase === 'READY' ? stableCountRef.current / STABLE_FRAMES : -1
          drawHandDot(ctx, landmarks, canvas.width, canvas.height, handedness, prog)

          // Wave rep detection during PLAYING
          if (activeRef.current) {
            detectWave(landmarks, handedness, now)
          }
        })
      }
    }

    rafRef.current = requestAnimationFrame(detect)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [isLoading, cameraError])

  // ── Wave detection ──────────────────────────────────────────
  function detectWave(landmarks, handedness, now) {
    const tracker = trackersRef.current[handedness] ?? trackersRef.current['Right']
    const rawY    = landmarks[0].y // wrist Y

    // Push to buffer
    tracker.yBuf.push(rawY)
    if (tracker.yBuf.length > BUF_SIZE) tracker.yBuf.shift()
    if (tracker.yBuf.length < 2) return

    // Smoothed Y = average of buffer
    const avgY = tracker.yBuf.reduce((a, b) => a + b, 0) / tracker.yBuf.length
    const prev = tracker.yBuf[tracker.yBuf.length - 2]

    const dy  = avgY - prev
    const dir = dy < 0 ? 'up' : dy > 0 ? 'down' : null
    if (!dir) return

    // Count rep on direction change with amplitude + debounce guards
    if (dir !== tracker.lastDir) {
      const travelOk  = tracker.lastRepY === null || Math.abs(rawY - tracker.lastRepY) > AMP_THRESH
      const timeOk    = now - tracker.lastRepTime > DEBOUNCE_MS
      if (travelOk && timeOk) {
        tracker.lastDir     = dir
        tracker.lastRepTime = now
        tracker.lastRepY    = rawY
        onRepRef.current?.()
      }
    } else {
      tracker.lastDir = dir
    }
  }

  // ── Reset between games ──────────────────────────────────────
  const resetTrackers = useCallback(() => {
    trackersRef.current   = { Left: createTracker(), Right: createTracker() }
    stableCountRef.current = 0
    stableFiredRef.current = false
    setStableProgress(0)
  }, [])

  return {
    videoRef, canvasRef,
    isLoading, cameraError,
    stableProgress,
    startCamera, stopCamera, resetTrackers,
    _handCount: handCount,
  }
}

// ── Draw glowing dot + optional progress arc ─────────────────
function drawHandDot(ctx, landmarks, w, h, handedness, stableProgress) {
  const wrist = landmarks[0]
  const x = wrist.x * w
  const y = wrist.y * h

  const isCyan  = handedness === 'Left'
  const color   = isCyan ? '#22d3ee' : '#c084fc'
  const glow    = isCyan ? 'rgba(34,211,238,0.35)' : 'rgba(192,132,252,0.35)'

  ctx.save()

  // Outer glow halo
  ctx.beginPath()
  ctx.arc(x, y, 26, 0, Math.PI * 2)
  ctx.fillStyle = glow
  ctx.shadowBlur = 30
  ctx.shadowColor = color
  ctx.fill()

  // Mid ring
  ctx.beginPath()
  ctx.arc(x, y, 14, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.globalAlpha = 0.3
  ctx.fill()
  ctx.globalAlpha = 1

  // Core dot
  ctx.beginPath()
  ctx.arc(x, y, 9, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.shadowBlur = 12
  ctx.shadowColor = color
  ctx.fill()

  // White center
  ctx.beginPath()
  ctx.arc(x, y, 3.5, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
  ctx.shadowBlur = 0
  ctx.fill()

  // Progress arc (fills clockwise during READY)
  if (stableProgress >= 0) {
    const r     = 34
    const start = -Math.PI / 2
    const end   = start + stableProgress * Math.PI * 2
    ctx.beginPath()
    ctx.arc(x, y, r, start, end)
    ctx.strokeStyle = color
    ctx.lineWidth   = 3
    ctx.shadowBlur  = 10
    ctx.shadowColor = color
    ctx.globalAlpha = 0.9
    ctx.stroke()
    ctx.globalAlpha = 1

    // Background track
    ctx.beginPath()
    ctx.arc(x, y, r, end, start + Math.PI * 2)
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'
    ctx.lineWidth   = 3
    ctx.shadowBlur  = 0
    ctx.stroke()
  }

  ctx.restore()
}
