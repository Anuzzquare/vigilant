'use client'

import { cn } from '@/lib/utils'
import { Eye, AlertTriangle, RotateCw, ScrollText } from 'lucide-react'

export type DrowsyEventType = 'eyes' | 'yawn' | 'tilt' | 'alarm'

export type DrowsyEvent = {
  id: string
  at: number
  type: DrowsyEventType
  message: string
}

const ICONS: Record<DrowsyEventType, { Icon: typeof Eye; color: string }> = {
  eyes: { Icon: Eye, color: 'text-warning' },
  yawn: { Icon: ScrollText, color: 'text-warning' },
  tilt: { Icon: RotateCw, color: 'text-warning' },
  alarm: { Icon: AlertTriangle, color: 'text-destructive' },
}

function fmt(at: number) {
  return new Date(at).toLocaleTimeString([], { hour12: false })
}

export function EventLog({ events }: { events: DrowsyEvent[] }) {
  return (
    <div className="flex h-full min-h-0 flex-col rounded-lg border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-mono text-xs font-semibold tracking-widest text-muted-foreground">
          EVENT LOG
        </h2>
        <span className="font-mono text-xs text-muted-foreground">{events.length}</span>
      </div>
      {events.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No events recorded yet.</p>
      ) : (
        <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
          {events.map((e) => {
            const { Icon, color } = ICONS[e.type]
            return (
              <li
                key={e.id}
                className="flex items-start gap-3 rounded-md border border-border bg-background/50 p-2.5"
              >
                <Icon className={cn('mt-0.5 size-4 shrink-0', color)} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground">{e.message}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">{fmt(e.at)}</p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
