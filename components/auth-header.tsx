"use client"

import Link from "next/link"
import { Logo } from "./logo"
import { motion, LayoutGroup, AnimatePresence, type Variants } from "framer-motion"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { Menu, X, LogOut } from "lucide-react"
import { useSession, signOut } from "next-auth/react"

export const AuthHeader = () => {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const isAdmin = session?.user?.role === "admin"

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    setPrefersReducedMotion(mediaQuery.matches)

    const handleChange = () => setPrefersReducedMotion(mediaQuery.matches)
    mediaQuery.addEventListener("change", handleChange)
    return () => mediaQuery.removeEventListener("change", handleChange)
  }, [])

  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [isMobileMenuOpen])

  const showNav = pathname === "/home" || pathname === "/account" || pathname === "/store" || pathname === "/admin"
  const shouldAnimate = !prefersReducedMotion

  const baseNavItems = [
    { href: "/home", label: "Home" },
    { href: "/account", label: "Account" },
    { href: "/store", label: "Store" },
  ]

  const navItems = isAdmin
    ? [...baseNavItems, { href: "/admin", label: "Admin" }]
    : baseNavItems

  const getLinkClassName = (itemHref: string) => {
    const isActive = pathname === itemHref
    return isActive
      ? "block text-2xl font-medium transition-colors py-4 text-yellow-500"
      : "block text-2xl font-medium transition-colors py-4 text-white hover:text-yellow-500"
  }

  const easeOut: [number, number, number, number] = [0.22, 1, 0.36, 1]

  const menuContainerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.4,
        ease: easeOut,
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
    exit: {
      opacity: 0,
      transition: {
        duration: 0.3,
        ease: easeOut,
        staggerChildren: 0.05,
        staggerDirection: -1,
      },
    },
  }

  const menuItemVariants: Variants = {
    hidden: {
      opacity: 0,
      y: 40,
      scale: 0.9,
      filter: "blur(10px)",
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      filter: "blur(0px)",
      transition: {
        duration: 0.5,
        ease: easeOut,
      },
    },
    exit: {
      opacity: 0,
      y: -20,
      scale: 0.95,
      filter: "blur(5px)",
      transition: {
        duration: 0.3,
        ease: easeOut,
      },
    },
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const backdropVariants: any = {
    hidden: {
      opacity: 0,
      backdropFilter: "blur(0px)",
    },
    visible: {
      opacity: 1,
      backdropFilter: "blur(24px)",
      transition: {
        duration: 0.4,
        ease: easeOut,
      },
    },
    exit: {
      opacity: 0,
      backdropFilter: "blur(0px)",
      transition: {
        duration: 0.3,
        ease: easeOut,
      },
    },
  }

  const closeButtonVariants: Variants = {
    hidden: { opacity: 0, rotate: -90, scale: 0.5 },
    visible: {
      opacity: 1,
      rotate: 0,
      scale: 1,
      transition: {
        duration: 0.4,
        ease: easeOut,
        delay: 0.3,
      },
    },
    exit: {
      opacity: 0,
      rotate: 90,
      scale: 0.5,
      transition: {
        duration: 0.2,
      },
    },
  }

  return (
    <>
      <AnimatePresence mode="wait">
        {isMobileMenuOpen && showNav && (
          <motion.div
            key="mobile-menu"
            className="fixed inset-0 z-[100] md:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Mobile navigation menu"
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <motion.div
              className="absolute inset-0 bg-black/80"
              variants={backdropVariants}
              onClick={() => setIsMobileMenuOpen(false)}
            />

            <div className="relative z-10 flex flex-col items-center justify-center h-full">
              <motion.button
                variants={closeButtonVariants}
                onClick={() => setIsMobileMenuOpen(false)}
                className="absolute top-8 right-6 text-white p-2 hover:text-yellow-500 transition-colors"
                aria-label="Close menu"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <X size={32} />
              </motion.button>

              <motion.nav className="flex flex-col items-center gap-8" variants={menuContainerVariants}>
                {navItems.map((item) => (
                  <motion.div
                    key={item.href}
                    variants={menuItemVariants}
                    whileHover={{
                      scale: 1.1,
                      x: 10,
                      transition: { duration: 0.2 },
                    }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Link
                      href={item.href}
                      scroll={false}
                      className={getLinkClassName(item.href)}
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      {item.label}
                    </Link>
                  </motion.div>
                ))}

                <motion.div variants={menuItemVariants}>
                  <button
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    className="block text-2xl font-medium transition-colors py-4 text-white hover:text-yellow-500"
                  >
                    Log Out
                  </button>
                </motion.div>
              </motion.nav>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="fixed z-50 pt-8 md:pt-14 top-0 left-0 w-full backdrop-blur-sm">
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/30 to-transparent pointer-events-none" />

        <div className={showNav ? "mx-auto w-full relative px-4" : "mx-auto w-full relative"}>
          <LayoutGroup>
            <motion.header
              className={
                showNav ? "flex items-center h-16 mx-auto max-w-6xl justify-between" : "flex items-center h-16 relative"
              }
              transition={{
                duration: shouldAnimate ? 2.5 : 0,
                ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number],
              }}
            >
              <motion.div
                layoutId="auth-logo"
                className={showNav ? "" : "absolute left-1/2 -translate-x-1/2"}
                layout={shouldAnimate}
                transition={{
                  duration: shouldAnimate ? 2.5 : 0,
                  ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number],
                }}
              >
                <Link href="/" scroll={false}>
                  <Logo />
                </Link>
              </motion.div>

              {showNav && (
                <>
                  <motion.nav
                    className="hidden md:flex gap-6 text-white ml-auto text-lg font-medium z-50 items-center"
                    animate={{ opacity: 1 }}
                    transition={{
                      duration: shouldAnimate ? 1.0 : 0,
                      ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number],
                    }}
                  >
                    {navItems.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        scroll={false}
                        className="hover:text-white/80 transition-colors"
                      >
                        {item.label}
                      </Link>
                    ))}
                    <button
                      onClick={() => signOut({ callbackUrl: "/login" })}
                      className="hover:text-white/80 transition-colors flex items-center gap-1"
                      title="Log out"
                    >
                      <LogOut size={16} />
                    </button>
                  </motion.nav>

                  <button
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="md:hidden ml-auto text-white p-2 hover:text-white/80 transition-colors z-[101]"
                    aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
                    aria-expanded={isMobileMenuOpen}
                    aria-controls="mobile-menu"
                  >
                    {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
                  </button>
                </>
              )}
            </motion.header>
          </LayoutGroup>
        </div>
      </div>
    </>
  )
}
