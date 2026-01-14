"use client"

import Link from "next/link"
import { Logo } from "./logo"
import { motion } from "framer-motion"
import { useEffect, useState } from "react"

interface HeaderProps {
  showNav?: boolean
  animate?: boolean
}

export const Header = ({ showNav = false, animate = false }: HeaderProps) => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    setPrefersReducedMotion(mediaQuery.matches)

    const handleChange = () => setPrefersReducedMotion(mediaQuery.matches)
    mediaQuery.addEventListener("change", handleChange)
    return () => mediaQuery.removeEventListener("change", handleChange)
  }, [])

  const shouldAnimate = animate && !prefersReducedMotion

  return (
    <div className="fixed z-50 pt-8 md:pt-14 top-0 left-0 w-full backdrop-blur-sm">
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/30 to-transparent pointer-events-none" />
      <div className="mx-auto max-w-6xl px-4 relative">
        <header className={`flex items-center h-16 ${showNav ? "justify-between" : "justify-center"}`}>
          <motion.div
            initial={shouldAnimate ? { x: "calc(50vw - 50% - 12rem)" } : { x: 0 }}
            animate={{ x: 0 }}
            transition={{
              duration: shouldAnimate ? 3.0 : 0,
              ease: [0.33, 1, 0.68, 1],
            }}
          >
            <Link href="/">
              <Logo />
            </Link>
          </motion.div>

          {showNav && (
            <motion.nav
              className="flex gap-6 text-white"
              initial={shouldAnimate ? { opacity: 0, x: 20 } : { opacity: 1, x: 0 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                duration: shouldAnimate ? 2.0 : 0,
                delay: shouldAnimate ? 2.0 : 0,
                ease: [0.25, 0.1, 0.25, 1],
              }}
            >
              <Link href="/home" className="hover:text-white/80 transition-colors">
                Home
              </Link>
              <Link href="/account" className="hover:text-white/80 transition-colors">
                Account
              </Link>
            </motion.nav>
          )}
        </header>
      </div>
    </div>
  )
}
