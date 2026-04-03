"use client"

import type React from "react"

import { motion, AnimatePresence } from "framer-motion"
import { usePathname } from "next/navigation"
import { useEffect, useState, useRef } from "react"

export function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const [minHeight, setMinHeight] = useState<number | undefined>(undefined)

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    setPrefersReducedMotion(mediaQuery.matches)

    const handleChange = () => setPrefersReducedMotion(mediaQuery.matches)
    mediaQuery.addEventListener("change", handleChange)
    return () => mediaQuery.removeEventListener("change", handleChange)
  }, [])

  // Capture current content height before exit so the container doesn't collapse
  useEffect(() => {
    if (containerRef.current) {
      setMinHeight(containerRef.current.offsetHeight)
    }
    // Clear min height after new content settles
    const timeout = setTimeout(() => setMinHeight(undefined), 400)
    return () => clearTimeout(timeout)
  }, [pathname])

  const duration = prefersReducedMotion ? 0 : 0.2

  return (
    <div ref={containerRef} style={{ minHeight: minHeight ? `${minHeight}px` : undefined }}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{
            duration,
            ease: [0.4, 0, 0.2, 1],
          }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
