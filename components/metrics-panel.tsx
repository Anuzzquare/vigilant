'use client'

import { cn } from '@/lib/utils'
import { CONFIG, type Metrics } from '@/lib/drowsiness'

type Flags = { eyesClosed: boolean; yawning: boolean; headTilt: boolean }

function MetricBar({
  label,
  value,
  display,
  max,
  threshold,
  active,
  invert,
}: {
  label: string
  value: number
  display: string
  max: number
  threshold: number
  active: boolean
  invert?: boolean // invert = "lower is worse" (EAR)
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  const thresholdPct = Math.min(100, Math.max(0, (threshold / max) * 100))
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="font-mono text-xs tracking-wide text-muted-foreground">{label}</span>
        <span
          className={cn(
            'font-mono text-sm font-semibold tabular-nums',
            active ? 'text-warning' : 'text-foreground',
          )}
        >
          {display}
        </span>
      </div>
      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-foreground/10">
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-150',
            active ? 'bg-warning' : 'bg-primary',
          )}
          style={{ width: `${pct}%` }}
        />
        {/* threshold marker */}
        <div
          className="absolute inset-y-0 w-0.5 bg-destructive/70"
          style={{ left: `${thresholdPct}%` }}
          title={`Threshold ${threshold}`}
          aria-hidden
        />
      </div>
      <div className="mt-0.5 text-right font-mono text-[10px] text-muted-foreground">
        {invert ? 'closes below' : 'triggers above'} {threshold}
      </div>
    </div>
  )
}

export function MetricsPanel({ metrics, flags }: { metrics: Metrics; flags: Flags }) {
  const maxTilt = 45
  const tiltValue = Math.max(Math.abs(metrics.roll), Math.abs(metrics.pitch))
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h2 className="mb-4 font-mono text-xs font-semibold tracking-widest text-muted-foreground">
        LIVE SIGNALS
      </h2>
      <div className="flex flex-col gap-4">
        <MetricBar
          label="EAR · Eye Aspect Ratio"
          value={metrics.ear}
          display={metrics.ear.toFixed(3)}
          max={0.45}
          threshold={CONFIG.earClosed}
          active={flags.eyesClosed}
          invert
        />
        <MetricBar
          label="MAR · Mouth Aspect Ratio"
          value={metrics.mar}
          display={metrics.mar.toFixed(3)}
          max={1.2}
          threshold={CONFIG.marYawn}
          active={flags.yawning}
        />
        <MetricBar
          label="HEAD TILT · roll / pitch"
          value={tiltValue}
          display={`${tiltValue.toFixed(0)}°`}
          max={maxTilt}
          threshold={CONFIG.tiltDegrees}
          active={flags.headTilt}
        />
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2 font-mono text-[10px]">
        <StatChip label="ROLL" value={`${metrics.roll.toFixed(0)}°`} />
        <StatChip label="PITCH" value={`${metrics.pitch.toFixed(0)}°`} />
        <StatChip label="YAW" value={`${metrics.yaw.toFixed(0)}°`} />
      </div>
    </div>
  )
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background/50 px-2 py-1.5 text-center">
      <div className="text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold text-foreground tabular-nums">{value}</div>
    </div>
  )
}
