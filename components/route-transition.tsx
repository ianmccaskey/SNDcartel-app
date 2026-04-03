"use client"

import type React from "react"
import { usePathname } from "next/navigation"

export function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div
      key={pathname}
      className="animate-page-in"
    >
      {children}
    </div>
  )
}
