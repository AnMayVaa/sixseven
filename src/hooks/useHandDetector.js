import { useRef, useEffect, useCallback, useState } from 'react'
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'

// Fingertip landmark indices: thumb, index, middle, ring, pinky
const FINGERTIPS = [4, 8, 12, 16, 20]

// Average Y of all 5 fingertips — stays visible even when the open
// hand hides or lowers the wrist out of frame during fast waving
function fingertipCentroidY(landmarks) {
  return FINGERTIPS.reduce((sum, i) => sum + landmarks[i].y, 0) / FINGERTIPS.length
}

// Average X+Y centroid used as the draw anchor
function fingertipCentroid(landmarks) {
  const x = FINGERTIPS.reduce((s, i) => s + landmarks[i].x, 0) / FINGERTIPS.length
  const y = FINGERTIPS.reduce((s, i) => s + landmarks[i].y, 0) / FINGERTIPS.length
  return { x, y }
}

// Per-hand wave tracker
function createTracker() {
  return {
    yBuf: [],        // last N raw Y values for smoothing
    lastDir: null,   // 'up' | 'down'
    lastRepTime: 0,  // ms timestamp of last counted rep
    lastRepY: null,  // fingertip centroid Y when last rep was counted
  }
}

const BUF_SIZE      = 4      // frames averaged for smooth Y
const AMP_THRESH    = 0.035  // min Y travel from last rep to count a new one
const DEBOUNCE_MS   = 85     // min ms between reps per hand
const STABLE_FRAMES = 80     // frames of hands-present to auto-start (~1.5s @ 30fps)
const DECAY_RATE    = 2      // stable-counter decay per no-hand frame

export function useHandDetector({ onRep, onStable, active, phase }) {
  const videoRef       = useRef(null)
  const canvasRef      = useRef(null)
  const landmarkerRef  = useRef(null)
  const rafRef         = useRef(null)
  const streamRef      = useRef(null)
  const trackersRef    = useRef({ Left: createTracker(), Right: createTracker() })

  // Stable-hand counting for auto-start
  const stableCountRef = useRef(0)
  const stableFiredRef = useRef(false)

  // Live refs — no re-render on update
  const activeRef   = useRef(active)
  const phaseRef    = useRef(phase)
  const onRepRef    = useRef(onRep)
  const onStableRef = useRef(onStable)

  useEffect(() => { activeRef.current = active },   [active])
  useEffect(() => { phaseRef.current = phase },     [phase])
  useEffect(() => { onRepRef.current = onRep },     [onRep])
  useEffect(() => { onStableRef.current = onStable }, [onStable])

  const [isLoading, setIsLoading]           = useState(true)
  const [cameraError, setCameraError]       = useState(null)
  const [handCount, setHandCount]           = useState(0)
  const [stableProgress, setStableProgress] = useState(0) // 0..1

  // Reset stable counter on every phase change
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

      // Setup canvas
      const ctx = canvas.getContext('2d')
      canvas.width  = video.videoWidth  || 640
      canvas.height = video.videoHeight || 480
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const currentPhase = phaseRef.current

      // ── Auto-start: count stable frames in READY phase ──
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
          const prog = currentPhase === 'READY' ? stableCountRef.current / STABLE_FRAMES : -1
          drawHandDots(ctx, landmarks, canvas.width, canvas.height, handedness, prog)
          if (activeRef.current) {
            detectWave(landmarks, handedness, now)
          }
        })
      }
    }

    rafRef.current = requestAnimationFrame(detect)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [isLoading, cameraError])

  // ── Wave detection using fingertip centroid Y ──────────────
  function detectWave(landmarks, handedness, now) {
    const tracker = trackersRef.current[handedness] ?? trackersRef.current['Right']

    // Track average Y of fingertips — reliable with open hand at speed
    const rawY = fingertipCentroidY(landmarks)

    tracker.yBuf.push(rawY)
    if (tracker.yBuf.length > BUF_SIZE) tracker.yBuf.shift()
    if (tracker.yBuf.length < 2) return

    const avgY = tracker.yBuf.reduce((a, b) => a + b, 0) / tracker.yBuf.length
    const prev = tracker.yBuf[tracker.yBuf.length - 2]
    const dy   = avgY - prev
    const dir  = dy < 0 ? 'up' : dy > 0 ? 'down' : null
    if (!dir) return

    if (dir !== tracker.lastDir) {
      const travelOk = tracker.lastRepY === null || Math.abs(rawY - tracker.lastRepY) > AMP_THRESH
      const timeOk   = now - tracker.lastRepTime > DEBOUNCE_MS
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

  // ── Reset between games ─────────────────────────────────────
  const resetTrackers = useCallback(() => {
    trackersRef.current  = { Left: createTracker(), Right: createTracker() }
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

// ── Draw 5 fingertip dots + centroid glow + optional progress arc ──
function drawHandDots(ctx, landmarks, w, h, handedness, stableProgress) {
  const isCyan = handedness === 'Left'
  const color  = isCyan ? '#22d3ee' : '#c084fc'
  const glow   = isCyan ? 'rgba(34,211,238,0.3)' : 'rgba(192,132,252,0.3)'

  // Centroid of fingertips for progress arc anchor
  const c  = fingertipCentroid(landmarks)
  const cx = c.x * w
  const cy = c.y * h

  ctx.save()

  // ── 5 fingertip dots ──
  FINGERTIPS.forEach(idx => {
    const lm = landmarks[idx]
    const fx = lm.x * w
    const fy = lm.y * h

    // Glow halo
    ctx.beginPath()
    ctx.arc(fx, fy, 10, 0, Math.PI * 2)
    ctx.fillStyle = glow
    ctx.shadowBlur = 14
    ctx.shadowColor = color
    ctx.fill()

    // Core dot
    ctx.beginPath()
    ctx.arc(fx, fy, 6, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.shadowBlur = 8
    ctx.shadowColor = color
    ctx.fill()

    // White center
    ctx.beginPath()
    ctx.arc(fx, fy, 2.5, 0, Math.PI * 2)
    ctx.fillStyle = '#ffffff'
    ctx.shadowBlur = 0
    ctx.fill()
  })

  // ── Soft centroid glow (tracking reference) ──
  ctx.shadowBlur = 0
  ctx.globalAlpha = 0.12
  ctx.beginPath()
  ctx.arc(cx, cy, 30, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()
  ctx.globalAlpha = 1

  // ── Progress arc around fingertip centroid (READY only) ──
  if (stableProgress >= 0) {
    const r     = 42
    const start = -Math.PI / 2
    const end   = start + stableProgress * Math.PI * 2

    // Background track
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    ctx.lineWidth   = 3
    ctx.shadowBlur  = 0
    ctx.stroke()

    // Filled progress
    if (stableProgress > 0) {
      ctx.beginPath()
      ctx.arc(cx, cy, r, start, end)
      ctx.strokeStyle = color
      ctx.lineWidth   = 3.5
      ctx.shadowBlur  = 12
      ctx.shadowColor = color
      ctx.globalAlpha = 0.95
      ctx.stroke()
      ctx.globalAlpha = 1
    }
  }

  ctx.restore()
}
