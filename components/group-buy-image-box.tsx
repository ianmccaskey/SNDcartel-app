"use client"

import { useState } from "react"
import { Package } from "lucide-react"
import { cn } from "@/lib/utils"

// Default placeholder served from /public when a group buy has no imageUrl.
// Used by every consumer of GroupBuyImageBox.
export const DEFAULT_GROUP_BUY_IMAGE = "/SNDvial.mp4"

// Detect video sources so we render <video> instead of <img>. Matches
// extensions at the end of the path (allowing for query strings).
export function isVideoSrc(src: string): boolean {
  return /\.(mp4|webm|mov|m4v|ogv)(\?.*)?$/i.test(src)
}

/**
 * Displays a group buy's image (or video) inside a glass-card-styled box.
 *
 * - imageUrl: URL/path of the campaign asset; if null, falls back to
 *   DEFAULT_GROUP_BUY_IMAGE.
 * - title: used as alt/aria-label.
 * - className: appended via cn() so callers can override sizing,
 *   aspect ratio, etc. The default is a square (aspect-square) glass
 *   card; pass `aspect-auto` plus explicit width/height to opt out.
 *
 * Behaviour:
 *   .mp4/.webm/.mov/.m4v/.ogv -> <video> autoplay/loop/muted/playsInline
 *   anything else             -> <img>
 *   load error                -> centered Package icon (graceful fallback)
 */
export function GroupBuyImageBox({
  imageUrl,
  title,
  className,
}: {
  imageUrl: string | null
  title: string
  className?: string
}) {
  const [mediaFailed, setMediaFailed] = useState(false)
  const src = imageUrl || DEFAULT_GROUP_BUY_IMAGE
  const isVideo = isVideoSrc(src)

  return (
    <div
      className={cn(
        "aspect-square rounded-lg border border-white/10 bg-black/40 backdrop-blur-sm overflow-hidden",
        className,
      )}
    >
      {mediaFailed ? (
        <div className="w-full h-full flex items-center justify-center">
          <Package className="size-8 text-white/30" />
        </div>
      ) : isVideo ? (
        <video
          src={src}
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          aria-label={title}
          className="w-full h-full object-cover"
          onError={() => setMediaFailed(true)}
        />
      ) : (
        <img
          src={src}
          alt={title}
          className="w-full h-full object-cover"
          onError={() => setMediaFailed(true)}
        />
      )}
    </div>
  )
}
