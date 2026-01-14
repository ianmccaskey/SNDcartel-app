"use client"

import dynamic from "next/dynamic"
import { Leva } from "leva"

const GL = dynamic(() => import("@/components/gl").then((mod) => ({ default: mod.GL })), {
  ssr: false,
})

export function ClientWrapper() {
  return (
    <>
      <div className="fixed inset-0 z-0">
        <GL hovering={false} />
      </div>
      <Leva hidden />
    </>
  )
}
