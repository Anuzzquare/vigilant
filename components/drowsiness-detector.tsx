'use client'

import { useCallback, useRef, useState } from 'react'
import { Camera, CameraOff, Volume2, VolumeX, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAlarm } from '@/hooks/use-alarm'
import { useFaceLandmarker } from '@/hooks/use-face-landmarker'
import {
  CONFIG,
  computeEAR,
  computeMAR,
  headPose,
  LEFT_EYE,
  RIGHT_EYE,
  MOUTH_TOP,
  MOUTH_BOTTOM,
  MOUTH_LEFT,
  MOUTH_RIGHT,
  type DrowsyStatus,
  type Metrics,
  type Landmark,
} from '@/lib/drowsiness'
import { StatusPanel } from '@/components/status-panel'
import { MetricsPanel } from '@/components/metrics-panel'
import { EventLog, type DrowsyEvent, type DrowsyEventType } from '@/components/event-log'

const COLORS = {
  ok: '#3fd0d8',
  warn: '#f2b03d',
  alarm: '#e5484d',
}

const EMPTY_METRICS: Metrics = { ear: 0, mar: 0, roll: 0, pitch: 0, yaw: 0 }

export function DrowsinessDetector() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)

  const { landmarkerRef, state: modelState, error: modelError, load } = useFaceLandmarker()
  const { start: startAlarm, stop: stopAlarm, prime } = useAlarm()

  // Per-frame accumulators (seconds of sustained signal) live in refs to avoid re-renders.
  const lastTsRef = useRef<number>(0)
  const lastVideoTimeRef = useRef<number>(-1)
  const closedTimeRef = useRef(0)
  const yawnTimeRef = useRef(0)
  const tiltTimeRef = useRef(0)
  const alarmActiveRef = useRef(false)
  const yawnLoggedRef = useRef(false)
  const tiltLoggedRef = useRef(false)
  const lastUiUpdateRef = useRef(0)
  const mutedRef = useRef(false)

  const [running, setRunning] = useState(false)
  const [starting, setStarting] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [muted, setMuted] = useState(false)
  const [status, setStatus] = useState<DrowsyStatus>('NO_FACE')
  const [metrics, setMetrics] = useState<Metrics>(EMPTY_METRICS)
  const [flags, setFlags] = useState({ eyesClosed: false, yawning: false, headTilt: false })
  const [score, setScore] = useState(0)
  const [events, setEvents] = useState<DrowsyEvent[]>([])

  const logEvent = useCallback((type: DrowsyEventType, message: string) => {
    setEvents((prev) =>
      [{ id: crypto.randomUUID(), at: Date.now(), type, message }, ...prev].slice(0, 50),
    )
  }, [])

  const drawOverlay = useCallback(
    (lm: Landmark[] | null, tone: string) => {
      const canvas = canvasRef.current
      const video = videoRef.current
      if (!canvas || !video) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const w = canvas.width
      const h = canvas.height

      ctx.save()
      // Mirror so the feed reads like a mirror; landmarks mirror in lockstep.
      ctx.translate(w, 0)
      ctx.scale(-1, 1)
      ctx.drawImage(video, 0, 0, w, h)

      if (lm) {
        const drawPoints = (idx: number[], color: string) => {
          ctx.fillStyle = color
          for (const i of idx) {
            const p = lm[i]
            ctx.beginPath()
            ctx.arc(p.x * w, p.y * h, 2.2, 0, Math.PI * 2)
            ctx.fill()
          }
        }
        drawPoints(LEFT_EYE, tone)
        drawPoints(RIGHT_EYE, tone)
        drawPoints([...MOUTH_TOP, ...MOUTH_BOTTOM, MOUTH_LEFT, MOUTH_RIGHT], tone)
      }
      ctx.restore()
    },
    [],
  )

  const loop = useCallback(() => {
    const video = videoRef.current
    const landmarker = landmarkerRef.current
    if (!video || !landmarker) {
      rafRef.current = requestAnimationFrame(loop)
      return
    }

    const now = performance.now()
    const dt = lastTsRef.current ? (now - lastTsRef.current) / 1000 : 0
    lastTsRef.current = now

    if (video.readyState >= 2 && video.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = video.currentTime
      const result = landmarker.detectForVideo(video, now)
      const lm = result.faceLandmarks?.[0] as Landmark[] | undefined

      if (lm && lm.length > 0) {
        const ear = computeEAR(lm)
        const mar = computeMAR(lm)
        const matrix = result.facialTransformationMatrixes?.[0]?.data
        const pose = headPose(matrix ? Array.from(matrix) : [])

        const eyesClosed = ear < CONFIG.earClosed
        const yawning = mar > CONFIG.marYawn
        const tiltMag = Math.max(Math.abs(pose.roll), Math.abs(pose.pitch))
        const headTilt = tiltMag > CONFIG.tiltDegrees

        closedTimeRef.current = eyesClosed ? closedTimeRef.current + dt : 0
        yawnTimeRef.current = yawning ? yawnTimeRef.current + dt : 0
        tiltTimeRef.current = headTilt ? tiltTimeRef.current + dt : 0

        // Weighted drowsiness score (eyes dominate).
        const eyeScore = Math.min(1, closedTimeRef.current / CONFIG.eyeClosedSecondsForAlarm) * 60
        const yawnScore = Math.min(1, yawnTimeRef.current / CONFIG.yawnSecondsToCount) * 22
        const tiltScore = Math.min(1, tiltTimeRef.current / CONFIG.tiltSecondsToCount) * 18
        const nextScore = Math.min(100, eyeScore + yawnScore + tiltScore)

        // Alarm on sustained eye closure.
        const alarmOn = closedTimeRef.current >= CONFIG.eyeClosedSecondsForAlarm
        if (alarmOn && !alarmActiveRef.current) {
          alarmActiveRef.current = true
          if (!mutedRef.current) startAlarm()
          logEvent('alarm', 'Prolonged eye closure — DROWSINESS ALARM triggered')
        } else if (!alarmOn && alarmActiveRef.current && closedTimeRef.current === 0) {
          alarmActiveRef.current = false
          stopAlarm()
        }

        // Yawn / tilt logging (once per sustained episode).
        if (yawnTimeRef.current >= CONFIG.yawnSecondsToCount && !yawnLoggedRef.current) {
          yawnLoggedRef.current = true
          logEvent('yawn', 'Yawning detected (high mouth aspect ratio)')
        } else if (yawnTimeRef.current === 0) {
          yawnLoggedRef.current = false
        }
        if (tiltTimeRef.current >= CONFIG.tiltSecondsToCount && !tiltLoggedRef.current) {
          tiltLoggedRef.current = true
          logEvent('tilt', `Abnormal head position (${tiltMag.toFixed(0)}° tilt)`)
        } else if (tiltTimeRef.current === 0) {
          tiltLoggedRef.current = false
        }

        let nextStatus: DrowsyStatus = 'ALERT'
        if (alarmOn) nextStatus = 'ALARM'
        else if (nextScore >= 40 || yawnLoggedRef.current || tiltLoggedRef.current)
          nextStatus = 'DROWSY'

        const tone =
          nextStatus === 'ALARM' ? COLORS.alarm : nextStatus === 'DROWSY' ? COLORS.warn : COLORS.ok
        drawOverlay(lm, tone)

        // Throttle React state updates to ~12Hz.
        if (now - lastUiUpdateRef.current > 80) {
          lastUiUpdateRef.current = now
          setMetrics({ ear, mar, roll: pose.roll, pitch: pose.pitch, yaw: pose.yaw })
          setFlags({ eyesClosed, yawning, headTilt })
          setScore(nextScore)
          setStatus(nextStatus)
        }
      } else {
        // No face: decay accumulators and silence alarm.
        closedTimeRef.current = 0
        yawnTimeRef.current = 0
        tiltTimeRef.current = 0
        yawnLoggedRef.current = false
        tiltLoggedRef.current = false
        if (alarmActiveRef.current) {
          alarmActiveRef.current = false
          stopAlarm()
        }
        drawOverlay(null, COLORS.ok)
        if (now - lastUiUpdateRef.current > 120) {
          lastUiUpdateRef.current = now
          setStatus('NO_FACE')
          setMetrics(EMPTY_METRICS)
          setFlags({ eyesClosed: false, yawning: false, headTilt: false })
          setScore(0)
        }
      }
    }

    rafRef.current = requestAnimationFrame(loop)
  }, [drawOverlay, landmarkerRef, logEvent, startAlarm, stopAlarm])

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    stopAlarm()
    alarmActiveRef.current = false
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    lastTsRef.current = 0
    lastVideoTimeRef.current = -1
    setRunning(false)
    setStatus('NO_FACE')
    setScore(0)
    setMetrics(EMPTY_METRICS)
    setFlags({ eyesClosed: false, yawning: false, headTilt: false })
  }, [stopAlarm])

  const start = useCallback(async () => {
    setCameraError(null)
    setStarting(true)
    prime() // unlock audio within the user gesture
    try {
      if (!landmarkerRef.current) await load()
      if (!landmarkerRef.current) {
        // load() sets its own error state; surface a camera-agnostic message.
        throw new Error('Model failed to initialize')
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      })
      streamRef.current = stream
      const video = videoRef.current!
      video.srcObject = stream
      await video.play()

      const canvas = canvasRef.current!
      canvas.width = video.videoWidth || 640
      canvas.height = video.videoHeight || 480

      setRunning(true)
      lastTsRef.current = performance.now()
      rafRef.current = requestAnimationFrame(loop)
    } catch (err) {
      console.log('[v0] start error:', (err as Error)?.message)
      setCameraError(
        (err as Error)?.name === 'NotAllowedError'
          ? 'Camera permission denied. Allow camera access and try again.'
          : (err as Error)?.message ?? 'Could not start the camera.',
      )
      stop()
    } finally {
      setStarting(false)
    }
  }, [landmarkerRef, load, loop, prime, stop])

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m
      mutedRef.current = next
      if (next) stopAlarm()
      else if (alarmActiveRef.current) startAlarm()
      return next
    })
  }, [startAlarm, stopAlarm])

  return (
    <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
      {/* Camera + overlay */}
      <div className="flex flex-col gap-4">
        <div className="relative overflow-hidden rounded-xl border border-border bg-black">
          <div className="aspect-[4/3] w-full">
            {/* video is the source; the mirrored canvas is what the user sees */}
            <video ref={videoRef} playsInline muted className="hidden" />
            <canvas ref={canvasRef} className="h-full w-full object-cover" />
          </div>

          {!running && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 text-center">
              <Camera className="size-8 text-primary" aria-hidden />
              <p className="max-w-xs text-balance px-4 text-sm text-muted-foreground">
                {modelState === 'loading' || starting
                  ? 'Loading detection model & camera…'
                  : 'Start monitoring to analyze eye closure, yawning, and head position in real time.'}
              </p>
            </div>
          )}

          <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1 font-mono text-xs backdrop-blur">
            <span
              className={`size-2 rounded-full ${running ? 'bg-primary animate-pulse' : 'bg-muted-foreground'}`}
              aria-hidden
            />
            {running ? 'LIVE' : 'OFFLINE'}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {!running ? (
            <Button onClick={start} disabled={starting || modelState === 'loading'} size="lg">
              {starting || modelState === 'loading' ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Camera />
              )}
              Start Monitoring
            </Button>
          ) : (
            <Button onClick={stop} variant="destructive" size="lg">
              <CameraOff />
              Stop
            </Button>
          )}
          <Button onClick={toggleMute} variant="secondary" size="lg" aria-pressed={muted}>
            {muted ? <VolumeX /> : <Volume2 />}
            {muted ? 'Alarm muted' : 'Alarm on'}
          </Button>
        </div>

        {(cameraError || modelError) && (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {cameraError ?? `Model error: ${modelError}`}
          </p>
        )}
      </div>

      {/* Right column */}
      <div className="flex flex-col gap-5">
        <StatusPanel status={status} score={score} />
        <MetricsPanel metrics={metrics} flags={flags} />
        <EventLog events={events} />
      </div>
    </div>
  )
}
