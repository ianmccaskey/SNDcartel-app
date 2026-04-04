"use client"

import type React from "react"
import { usePathname } from "next/navigation"
import { useRef, useState, useLayoutEffect, useCallback } from "react"
import gsap from "gsap"

export function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const containerRef = useRef<HTMLDivElement>(null)
  const prevPathname = useRef(pathname)
  const [displayChildren, setDisplayChildren] = useState(children)
  const isAnimating = useRef(false)
  const pendingChildren = useRef<React.ReactNode>(null)

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
        // If another navigation happened during animation, run it now
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
          // animateIn will be triggered by the useLayoutEffect below
        },
      })
    },
    [],
  )

  // Detect route change
  useLayoutEffect(() => {
    if (pathname === prevPathname.current) {
      // Same route, just update children (e.g. data refresh)
      setDisplayChildren(children)
      return
    }

    prevPathname.current = pathname

    if (isAnimating.current) {
      // Queue this navigation
      pendingChildren.current = children
      return
    }

    animateOut(children)
  }, [pathname, children, animateOut])

  // Animate in when displayChildren changes (after exit completes)
  useLayoutEffect(() => {
    if (containerRef.current) {
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
