"use client"

import type React from "react"
import { usePathname } from "next/navigation"
import { useRef, useState, useLayoutEffect, useEffect, useCallback } from "react"
import gsap from "gsap"

export function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const containerRef = useRef<HTMLDivElement>(null)
  const prevPathname = useRef<string | null>(null)
  const [displayChildren, setDisplayChildren] = useState(children)
  const isAnimating = useRef(false)
  const pendingChildren = useRef<React.ReactNode>(null)
  const hasMounted = useRef(false)

  const animateIn = useCallback(() => {
    const el = containerRef.current
    if (!el) return

    gsap.set(el, { autoAlpha: 0, y: 12 })

    gsap.to(el, {
      autoAlpha: 1,
      y: 0,
      duration: 0.4,
      ease: "power3.out",
      onComplete: () => {
        isAnimating.current = false
        if (pendingChildren.current) {
          const next = pendingChildren.current
          pendingChildren.current = null
          animateOut(next)
        }
      },
    })
  }, [])

  const animateOut = useCallback(
    (nextChildren: React.ReactNode) => {
      const el = containerRef.current
      if (!el) {
        setDisplayChildren(nextChildren)
        return
      }

      isAnimating.current = true

      gsap.to(el, {
        autoAlpha: 0,
        y: -8,
        duration: 0.25,
        ease: "power2.in",
        onComplete: () => {
          setDisplayChildren(nextChildren)
        },
      })
    },
    [],
  )

  // Initial mount — show content immediately with a fade in
  useEffect(() => {
    if (!hasMounted.current && containerRef.current) {
      hasMounted.current = true
      animateIn()
    }
  }, [animateIn])

  // Route changes after initial mount
  useLayoutEffect(() => {
    if (!hasMounted.current) return

    if (prevPathname.current === null) {
      prevPathname.current = pathname
      return
    }

    if (pathname === prevPathname.current) {
      setDisplayChildren(children)
      return
    }

    prevPathname.current = pathname

    if (isAnimating.current) {
      pendingChildren.current = children
      return
    }

    animateOut(children)
  }, [pathname, children, animateOut])

  // Animate in after displayChildren swap (from animateOut completing)
  useLayoutEffect(() => {
    if (!hasMounted.current) return
    // Only animate in if we're mid-transition (displayChildren was swapped by animateOut)
    if (isAnimating.current) {
      animateIn()
    }
  }, [displayChildren, animateIn])

  return (
    <div
      ref={containerRef}
      style={{ visibility: "hidden" }}
    >
      {displayChildren}
    </div>
  )
}
