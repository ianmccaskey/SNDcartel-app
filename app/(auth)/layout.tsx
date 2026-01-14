"use client"

import type React from "react"
import { usePathname } from "next/navigation"

import { AuthHeader } from "@/components/auth-header"
import { RouteTransition } from "@/components/route-transition"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLoginPage = pathname === "/login"
  const overlayOpacity = isLoginPage ? "bg-black/0" : "bg-black/50"

  return (
    <>
      <div
        className={`fixed inset-0 ${overlayOpacity} pointer-events-none z-[1] transition-colors duration-700 ease-in-out`}
      />
      <div className="relative z-10">
        <AuthHeader />
        <RouteTransition>{children}</RouteTransition>
      </div>
    </>
  )
}
