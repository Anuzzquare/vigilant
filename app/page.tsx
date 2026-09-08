import { Eye } from 'lucide-react'
import { DrowsinessDetector } from '@/components/drowsiness-detector'

export default function Page() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-8 md:py-12">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-lg border border-primary/40 bg-primary/10 text-primary">
              <Eye className="size-6" aria-hidden />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                VigilEye
              </h1>
              <p className="font-mono text-xs tracking-wide text-muted-foreground">
                DRIVER DROWSINESS DETECTION
              </p>
            </div>
          </div>
          <p className="max-w-sm text-pretty text-sm text-muted-foreground">
            Runs entirely in your browser. Video never leaves your device — all face analysis
            happens locally on-device.
          </p>
        </header>

        <DrowsinessDetector />

        <footer className="mt-10 border-t border-border pt-6">
          <p className="text-xs text-muted-foreground">
            Assistive monitoring only. This is a demonstration and must not be relied on as a safety
            device. Always drive rested and pull over when tired.
          </p>
        </footer>
      </div>
    </main>
  )
}
