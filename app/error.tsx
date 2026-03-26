"use client"

import { useEffect } from "react"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      <div
        className="text-center p-12 rounded-2xl border border-white/10 backdrop-blur-md max-w-md"
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(239,68,68,0.08) 0%, transparent 70%), rgba(255,255,255,0.03)",
        }}
      >
        <p className="text-red-400 font-mono text-sm uppercase tracking-widest mb-4">Error</p>
        <h1 className="text-4xl font-bold mb-3">Something went wrong</h1>
        <p className="text-muted-foreground mb-2 text-sm">
          {error.message || "An unexpected error occurred."}
        </p>
        {error.digest && (
          <p className="text-muted-foreground/50 text-xs font-mono mb-6">
            Digest: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 border border-white/20 text-white rounded font-mono text-sm uppercase tracking-wide hover:bg-white/15 transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  )
}
