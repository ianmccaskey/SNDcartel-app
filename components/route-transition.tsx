"use client"

import type React from "react"
import { usePathname } from "next/navigation"
import { useEffect, useState, useRef } from "react"

export function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [displayChildren, setDisplayChildren] = useState(children)
  const [transitioning, setTransitioning] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const prevPathname = useRef(pathname)

  useEffect(() => {
    // Same page, just update children
    if (pathname === prevPathname.current) {
      setDisplayChildren(children)
      return
    }

    prevPathname.current = pathname

    // Start exit
    setTransitioning(true)

    // After exit completes, swap content and enter
    const exitTimer = setTimeout(() => {
      setDisplayChildren(children)
      // Force a reflow so the browser applies opacity:0 before we transition to opacity:1
      requestAnimationFrame(() => {
        setTransitioning(false)
      })
    }, 200) // Match exit duration

    return () => clearTimeout(exitTimer)
  }, [pathname, children])

  return (
    <div ref={containerRef}>
      <div
        style={{
          opacity: transitioning ? 0 : 1,
          transform: transitioning ? "translateY(8px)" : "translateY(0)",
          transition: "opacity 0.3s ease, transform 0.3s ease",
        }}
      >
        {displayChildren}
      </div>
    </div>
  )
}
