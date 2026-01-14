"use client"

import Link from "next/link"
import { Pill } from "./pill"
import { Button } from "./ui/button"
import { useState } from "react"

export function Hero() {
  const [hovering, setHovering] = useState(false)
  return (
    <div className="flex flex-col h-svh justify-between">
      <div className="pb-16 mt-auto text-center relative">
        <Pill className="mb-6">The Group Buy Engine</Pill>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-sentient">
          Community-Powered <br />
          <i className="font-light">Peptide</i> Purchasing
        </h1>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mt-14">
          <Link className="contents max-sm:hidden" href="/home" scroll={false}>
            <Button onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)}>
              [Log In]
            </Button>
          </Link>
          <Link className="contents sm:hidden" href="/home" scroll={false}>
            <Button size="sm" onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)}>
              [Log In]
            </Button>
          </Link>

          <Link className="contents max-sm:hidden" href="/home" scroll={false}>
            <Button onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)}>
              [Register]
            </Button>
          </Link>
          <Link className="contents sm:hidden" href="/home" scroll={false}>
            <Button size="sm" onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)}>
              [Register]
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
