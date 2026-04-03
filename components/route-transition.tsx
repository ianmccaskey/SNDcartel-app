"use client"

import type React from "react"

// With viewTransition enabled in next.config.ts, the browser handles
// crossfade transitions natively. This wrapper just passes children through.
// The animation is defined in globals.css via ::view-transition pseudo-elements.
export function RouteTransition({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
