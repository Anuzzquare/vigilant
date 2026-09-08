// Drowsiness detection math built on MediaPipe FaceMesh's 468/478 landmark model.
// All helpers are pure so they can be unit-reasoned about independently of the render loop.

export type Landmark = { x: number; y: number; z: number }

export type DrowsyStatus = 'ALERT' | 'DROWSY' | 'ALARM' | 'NO_FACE'

export type Metrics = {
  ear: number // Eye Aspect Ratio (lower = more closed)
  mar: number // Mouth Aspect Ratio (higher = more open / yawning)
  roll: number // head tilt sideways, degrees
  pitch: number // head nod up/down, degrees
  yaw: number // head turn left/right, degrees
}

// Tunable thresholds. Values chosen to work with normalized (0-1) landmark coordinates.
export const CONFIG = {
  earClosed: 0.2, // below this the eyes are considered closed
  earDrowsyMargin: 0.05, // eyes "drooping" band above the closed line
  marYawn: 0.6, // above this the mouth is considered a yawn
  tiltDegrees: 22, // roll/pitch beyond this = abnormal head position
  // seconds of sustained signal before it counts
  eyeClosedSecondsForAlarm: 1.4,
  yawnSecondsToCount: 1.2,
  tiltSecondsToCount: 1.6,
}

// FaceMesh landmark index groups (6-point EAR model per eye).
export const LEFT_EYE = [33, 160, 158, 133, 153, 144]
export const RIGHT_EYE = [362, 385, 387, 263, 373, 380]
// Mouth inner vertical pairs + outer horizontal corners.
export const MOUTH_TOP = [82, 13, 312]
export const MOUTH_BOTTOM = [87, 14, 317]
export const MOUTH_LEFT = 61
export const MOUTH_RIGHT = 291

function dist(a: Landmark, b: Landmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

// Eye Aspect Ratio: (|p2-p6| + |p3-p5|) / (2 * |p1-p4|)
export function eyeAspectRatio(lm: Landmark[], idx: number[]): number {
  const [p1, p2, p3, p4, p5, p6] = idx.map((i) => lm[i])
  const horizontal = dist(p1, p4)
  if (horizontal === 0) return 0
  return (dist(p2, p6) + dist(p3, p5)) / (2 * horizontal)
}

export function computeEAR(lm: Landmark[]): number {
  return (eyeAspectRatio(lm, LEFT_EYE) + eyeAspectRatio(lm, RIGHT_EYE)) / 2
}

// Mouth Aspect Ratio: mean vertical opening / horizontal width.
export function computeMAR(lm: Landmark[]): number {
  const horizontal = dist(lm[MOUTH_LEFT], lm[MOUTH_RIGHT])
  if (horizontal === 0) return 0
  let vertical = 0
  for (let i = 0; i < MOUTH_TOP.length; i++) {
    vertical += dist(lm[MOUTH_TOP[i]], lm[MOUTH_BOTTOM[i]])
  }
  vertical /= MOUTH_TOP.length
  return vertical / horizontal
}

const RAD2DEG = 180 / Math.PI

// Extract pitch/yaw/roll (degrees) from MediaPipe's column-major 4x4
// facial transformation matrix.
export function headPose(matrix: number[]): { pitch: number; yaw: number; roll: number } {
  if (!matrix || matrix.length < 11) return { pitch: 0, yaw: 0, roll: 0 }
  const r00 = matrix[0]
  const r10 = matrix[1]
  const r20 = matrix[2]
  const r21 = matrix[6]
  const r22 = matrix[10]
  const pitch = Math.atan2(r21, r22) * RAD2DEG
  const yaw = Math.atan2(-r20, Math.hypot(r21, r22)) * RAD2DEG
  const roll = Math.atan2(r10, r00) * RAD2DEG
  return { pitch, yaw, roll }
}
