"use client"

import type React from "react"
import { usePathname } from "next/navigation"
import { useRef, useEffect } from "react"
import gsap from "gsap"

export function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const containerRef = useRef<HTMLDivElement>(null)
  const firstRender = useRef(true)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    // Kill any running animations to prevent stuck states
    gsap.killTweensOf(el)

    if (firstRender.current) {
      // First page load — just fade in
      firstRender.current = false
      gsap.fromTo(el,
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.4, ease: "power3.out" }
      )
    } else {
      // Route change — content already swapped by React, just animate in
      gsap.fromTo(el,
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.35, ease: "power3.out" }
      )
    }
  }, [pathname])

  return (
    <div ref={containerRef} style={{ opacity: 0 }}>
      {children}
    </div>
  )
}
