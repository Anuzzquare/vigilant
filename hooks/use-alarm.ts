'use client'

import { useCallback, useEffect, useRef } from 'react'

// Generates a pulsing alarm tone with the Web Audio API — no audio asset needed.
export function useAlarm() {
  const ctxRef = useRef<AudioContext | null>(null)
  const oscRef = useRef<OscillatorNode | null>(null)
  const gainRef = useRef<GainNode | null>(null)
  const lfoRef = useRef<OscillatorNode | null>(null)
  const playingRef = useRef(false)

  const ensureContext = useCallback(() => {
    if (!ctxRef.current) {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext
      ctxRef.current = new Ctx()
    }
    return ctxRef.current!
  }, [])

  const start = useCallback(() => {
    if (playingRef.current) return
    const ctx = ensureContext()
    if (ctx.state === 'suspended') void ctx.resume()

    const osc = ctx.createOscillator()
    osc.type = 'square'
    osc.frequency.value = 880

    const gain = ctx.createGain()
    gain.gain.value = 0

    // LFO pulses the volume so the tone beeps on/off.
    const lfo = ctx.createOscillator()
    lfo.type = 'square'
    lfo.frequency.value = 4
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 0.18

    lfo.connect(lfoGain)
    lfoGain.connect(gain.gain)
    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start()
    lfo.start()

    oscRef.current = osc
    gainRef.current = gain
    lfoRef.current = lfo
    playingRef.current = true
  }, [ensureContext])

  const stop = useCallback(() => {
    if (!playingRef.current) return
    try {
      oscRef.current?.stop()
      lfoRef.current?.stop()
      oscRef.current?.disconnect()
      lfoRef.current?.disconnect()
      gainRef.current?.disconnect()
    } catch {
      // already stopped
    }
    oscRef.current = null
    lfoRef.current = null
    gainRef.current = null
    playingRef.current = false
  }, [])

  // Unlock the audio context on first user gesture (browsers require this).
  const prime = useCallback(() => {
    const ctx = ensureContext()
    if (ctx.state === 'suspended') void ctx.resume()
  }, [ensureContext])

  useEffect(() => () => stop(), [stop])

  return { start, stop, prime }
}
