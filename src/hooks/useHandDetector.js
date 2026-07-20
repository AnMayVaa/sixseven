import { useRef, useEffect, useCallback, useState } from 'react'
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'

// Finger tip and PIP landmark indices
const FINGER_TIPS = [4, 8, 12, 16, 20]
const FINGER_PIPS = [3, 6, 10, 14, 18]

// Count extended fingers on one hand's landmarks
function countExtendedFingers(landmarks) {
  if (!landmarks || landmarks.length < 21) return 0
  let count = 0
  // Thumb: compare x-distance from wrist
  const thumbTip = landmarks[4]
  const thumbMcp = landmarks[2]
  const wrist = landmarks[0]
  const isRightHand = thumbTip.x < wrist.x // mirrored for selfie
  if (isRightHand) {
    if (thumbTip.x < thumbMcp.x) count++
  } else {
    if (thumbTip.x > thumbMcp.x) count++
  }
  // Other 4 fingers: tip.y < pip.y means extended (higher on screen = lower y in normalized)
  for (let i = 1; i < 5; i++) {
    if (landmarks[FINGER_TIPS[i]].y < landmarks[FINGER_PIPS[i]].y) count++
  }
  return count
}

// ── Wave (peak detection) state per hand ──
function createWaveTracker() {
  return {
    yHistory: [],          // recent Y values of wrist
    lastDirection: null,   // 'up' | 'down'
    lastPeakTime: 0,       // timestamp of last counted rep
    lastY: null,
  }
}

const WAVE_DEBOUNCE_MS = 180   // min ms between reps per hand
const WAVE_THRESHOLD   = 0.03  // min normalized-coord movement to count

export function useHandDetector({ onRep, active }) {
  const videoRef         = useRef(null)
  const canvasRef        = useRef(null)
  const landmarkerRef    = useRef(null)
  const rafRef           = useRef(null)
  const streamRef        = useRef(null)
  const waveTrackersRef  = useRef({ Left: createWaveTracker(), Right: createWaveTracker() })
  const activeRef        = useRef(active)
  const onRepRef         = useRef(onRep)

  const [isLoading, setIsLoading]         = useState(true)
  const [cameraError, setCameraError]     = useState(null)
  const [handsDetected, setHandsDetected] = useState(false)

  // Keep refs current
  useEffect(() => { activeRef.current = active }, [active])
  useEffect(() => { onRepRef.current = onRep },   [onRep])

  // Initialize MediaPipe HandLandmarker
  useEffect(() => {
    let cancelled = false
    async function init() {
      try {
        // Load mediapipe wasm
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        )
        const handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 2,
        })
        if (!cancelled) {
          landmarkerRef.current = handLandmarker
        }
      } catch (err) {
        if (!cancelled) {
          console.error('MediaPipe init error:', err)
          setCameraError('Failed to load hand detection model.')
        }
      }
    }
    init()
    return () => { cancelled = true }
  }, [])

  // Open camera
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
    } catch (err) {
      console.error('Camera error:', err)
      setCameraError('Camera access denied. Please allow camera and refresh.')
      setIsLoading(false)
    }
  }, [])

  // Stop camera
  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }, [])

  // Detection loop
  useEffect(() => {
    if (isLoading || cameraError || !videoRef.current) return

    let lastTimestamp = -1

    const detect = () => {
      rafRef.current = requestAnimationFrame(detect)
      const video  = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas || !landmarkerRef.current) return
      if (video.readyState < 2) return

      const now = performance.now()
      if (now === lastTimestamp) return
      lastTimestamp = now

      // Run detection
      const results = landmarkerRef.current.detectForVideo(video, now)
      const hasHands = results.landmarks && results.landmarks.length > 0
      setHandsDetected(hasHands)

      // Draw on canvas
      const ctx = canvas.getContext('2d')
      canvas.width  = video.videoWidth  || 640
      canvas.height = video.videoHeight || 480
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      if (hasHands) {
        results.landmarks.forEach((landmarks, handIdx) => {
          const handedness = results.handednesses[handIdx]?.[0]?.categoryName || 'Right'
          drawHandSkeleton(ctx, landmarks, canvas.width, canvas.height, handedness)

          // Wave detection — only during active game
          if (activeRef.current) {
            detectWave(landmarks, handedness, now)
          }
        })
      }
    }

    rafRef.current = requestAnimationFrame(detect)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [isLoading, cameraError])

  // Wave peak detection per hand
  function detectWave(landmarks, handedness, now) {
    const wrist = landmarks[0]
    const tracker = waveTrackersRef.current[handedness] || waveTrackersRef.current['Right']
    const y = wrist.y

    if (tracker.lastY === null) {
      tracker.lastY = y
      return
    }

    const dy = y - tracker.lastY
    tracker.lastY = y

    let direction = null
    if (Math.abs(dy) > WAVE_THRESHOLD / 5) {
      direction = dy < 0 ? 'up' : 'down' // in normalized coords, smaller y = higher on screen
    }

    if (direction && direction !== tracker.lastDirection) {
      // Direction change = one wave rep (peak or trough detected)
      if (now - tracker.lastPeakTime > WAVE_DEBOUNCE_MS) {
        tracker.lastDirection = direction
        tracker.lastPeakTime = now
        onRepRef.current?.()
      }
    } else if (direction) {
      tracker.lastDirection = direction
    }
  }

  // Reset wave trackers between games
  const resetTrackers = useCallback(() => {
    waveTrackersRef.current = { Left: createWaveTracker(), Right: createWaveTracker() }
  }, [])

  return {
    videoRef,
    canvasRef,
    isLoading,
    cameraError,
    handsDetected,
    startCamera,
    stopCamera,
    resetTrackers,
  }
}

// ── Draw hand skeleton on canvas ──
function drawHandSkeleton(ctx, landmarks, w, h, handedness) {
  const CONNECTIONS = [
    [0,1],[1,2],[2,3],[3,4],         // thumb
    [0,5],[5,6],[6,7],[7,8],         // index
    [0,9],[9,10],[10,11],[11,12],    // middle
    [0,13],[13,14],[14,15],[15,16],  // ring
    [0,17],[17,18],[18,19],[19,20],  // pinky
    [5,9],[9,13],[13,17],            // palm
  ]

  const color = handedness === 'Left' ? '#06b6d4' : '#a855f7'
  const tipColor = '#ffffff'

  // Draw connections
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.globalAlpha = 0.7
  CONNECTIONS.forEach(([a, b]) => {
    const pa = landmarks[a]
    const pb = landmarks[b]
    ctx.beginPath()
    ctx.moveTo(pa.x * w, pa.y * h)
    ctx.lineTo(pb.x * w, pb.y * h)
    ctx.stroke()
  })

  // Draw landmarks
  ctx.globalAlpha = 1
  landmarks.forEach((lm, idx) => {
    const isTip = FINGER_TIPS.includes(idx)
    ctx.beginPath()
    ctx.arc(lm.x * w, lm.y * h, isTip ? 5 : 3, 0, Math.PI * 2)
    ctx.fillStyle = isTip ? tipColor : color
    ctx.fill()
  })

  ctx.globalAlpha = 1
}
