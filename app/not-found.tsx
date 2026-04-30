import Link from "next/link"

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      <div
        className="text-center p-12 rounded-2xl border border-white/10 backdrop-blur-md"
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(255,199,0,0.08) 0%, transparent 70%), rgba(255,255,255,0.03)",
        }}
      >
        <p className="text-[#FFC700] font-mono text-sm uppercase tracking-widest mb-4">404</p>
        <h1 className="text-5xl font-bold mb-3">Page Not Found</h1>
        <p className="text-muted-foreground mb-8 max-w-sm mx-auto">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/home"
          className="inline-flex items-center gap-2 px-6 py-3 bg-[#FFC700]/10 border border-[#FFC700]/30 text-[#FFC700] rounded font-mono text-sm uppercase tracking-wide hover:bg-[#FFC700]/20 transition-colors"
        >
          Back to Home
        </Link>
      </div>
    </div>
  )
}
