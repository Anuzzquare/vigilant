'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'

type LoadState = 'idle' | 'loading' | 'ready' | 'error'

export function useFaceLandmarker() {
  const landmarkerRef = useRef<FaceLandmarker | null>(null)
  const [state, setState] = useState<LoadState>('idle')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (landmarkerRef.current || state === 'loading') return
    setState('loading')
    setError(null)
    try {
      const fileset = await FilesetResolver.forVisionTasks('/mediapipe/wasm')
      const landmarker = await FaceLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: '/mediapipe/models/face_landmarker.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: true,
      })
      landmarkerRef.current = landmarker
      setState('ready')
    } catch (err) {
      console.log('[v0] FaceLandmarker load error:', (err as Error)?.message)
      setError((err as Error)?.message ?? 'Failed to load model')
      setState('error')
    }
  }, [state])

  useEffect(() => {
    return () => {
      landmarkerRef.current?.close()
      landmarkerRef.current = null
    }
  }, [])

  return { landmarkerRef, state, error, load }
}
