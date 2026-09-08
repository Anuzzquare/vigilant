'use client'

import { cn } from '@/lib/utils'
import type { DrowsyStatus } from '@/lib/drowsiness'
import { AlertTriangle, CheckCircle2, Eye, UserX } from 'lucide-react'

const MAP: Record<
  DrowsyStatus,
  { label: string; sub: string; classes: string; Icon: typeof Eye; pulse: boolean }
> = {
  ALERT: {
    label: 'ALERT',
    sub: 'Driver is attentive',
    classes: 'border-primary/40 bg-primary/10 text-primary',
    Icon: CheckCircle2,
    pulse: false,
  },
  DROWSY: {
    label: 'DROWSY',
    sub: 'Signs of fatigue detected',
    classes: 'border-warning/50 bg-warning/10 text-warning',
    Icon: Eye,
    pulse: true,
  },
  ALARM: {
    label: 'DROWSINESS DETECTED!',
    sub: 'Wake up — pull over safely',
    classes: 'border-destructive/60 bg-destructive/15 text-destructive',
    Icon: AlertTriangle,
    pulse: true,
  },
  NO_FACE: {
    label: 'NO FACE',
    sub: 'Position your face in view',
    classes: 'border-border bg-muted/40 text-muted-foreground',
    Icon: UserX,
    pulse: false,
  },
}

export function StatusPanel({ status, score }: { status: DrowsyStatus; score: number }) {
  const { label, sub, classes, Icon, pulse } = MAP[status]
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-lg border p-6 text-center transition-colors',
        classes,
        pulse && 'animate-pulse',
      )}
      role="status"
      aria-live="assertive"
    >
      <Icon className="size-10" aria-hidden />
      <div className="text-2xl font-bold tracking-tight text-balance">{label}</div>
      <p className="text-sm opacity-80">{sub}</p>
      <div className="mt-2 w-full">
        <div className="mb-1 flex items-center justify-between font-mono text-xs opacity-70">
          <span>DROWSINESS SCORE</span>
          <span>{Math.round(score)}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-foreground/10">
          <div
            className="h-full rounded-full bg-current transition-[width] duration-200"
            style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
          />
        </div>
      </div>
    </div>
  )
}
