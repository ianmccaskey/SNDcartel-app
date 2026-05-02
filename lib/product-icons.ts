import { Activity, Atom, Brain, Syringe, type LucideIcon } from "lucide-react"

/**
 * Pick a lucide icon for a peptide product based on keywords in its name.
 * Falls back to Syringe (most peptides in this domain are injectable).
 *
 * Mapping is intentionally small and easy to extend — add new branches
 * here as new peptide families ship.
 */
export function pickProductIcon(name: string): LucideIcon {
  const n = name.toLowerCase()

  // Tissue repair / healing peptides
  if (n.includes("bpc") || n.includes("tb-500") || n.includes("tb500") || n.includes("healing")) {
    return Activity
  }

  // Mitochondrial / cellular-energy peptides
  if (n.includes("ss-31") || n.includes("ss31") || n.includes("elamipretide") || n.includes("mito")) {
    return Atom
  }

  // Cognitive / nootropic / anxiolytic peptides
  if (n.includes("selank") || n.includes("semax") || n.includes("dsip") || n.includes("cog")) {
    return Brain
  }

  // Default: GLP-1 / GIP family (tirzepatide, retatrutide, semaglutide, etc.) and other injectables
  return Syringe
}
