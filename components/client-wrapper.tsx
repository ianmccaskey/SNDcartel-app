"use client"

import dynamic from "next/dynamic"
import { useState } from "react"

const GL = dynamic(() => import("./gl").then((mod) => mod.GL), {
  ssr: false,
})

export function ClientWrapper() {
  const [hovering, setHovering] = useState(false)

  return (
    <div
      className="fixed inset-0 z-0"
      onPointerOver={() => setHovering(true)}
      onPointerOut={() => setHovering(false)}
    >
      <GL hovering={hovering} />
    </div>
  )
}
