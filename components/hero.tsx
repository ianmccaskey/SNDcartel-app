"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import { Pill } from "./pill"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { motion, AnimatePresence } from "framer-motion"
import { useState } from "react"

export function Hero() {
  const router = useRouter()
  const [showLoginForm, setShowLoginForm] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [hovering, setHovering] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })
      if (result?.error) {
        setError("Invalid email or password")
      } else {
        router.push("/home")
      }
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-svh justify-between">
      <div className="pb-16 mt-auto text-center relative">
        <Pill className="mb-6">The Group Buy Engine</Pill>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-sentient">
          Community-Powered <br />
          <i className="font-light">Peptide</i> Purchasing
        </h1>

        <AnimatePresence mode="wait">
          {!showLoginForm ? (
            <motion.div
              key="buttons"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col sm:flex-row gap-4 justify-center items-center mt-14"
            >
              <Button
                className="max-sm:hidden"
                onClick={() => setShowLoginForm(true)}
                onMouseEnter={() => setHovering(true)}
                onMouseLeave={() => setHovering(false)}
              >
                [Log In]
              </Button>
              <Button
                size="sm"
                className="sm:hidden"
                onClick={() => setShowLoginForm(true)}
                onMouseEnter={() => setHovering(true)}
                onMouseLeave={() => setHovering(false)}
              >
                [Log In]
              </Button>

              <Link className="contents max-sm:hidden" href="/register" scroll={false}>
                <Button
                  onMouseEnter={() => setHovering(true)}
                  onMouseLeave={() => setHovering(false)}
                >
                  [Register]
                </Button>
              </Link>
              <Link className="contents sm:hidden" href="/register" scroll={false}>
                <Button
                  size="sm"
                  onMouseEnter={() => setHovering(true)}
                  onMouseLeave={() => setHovering(false)}
                >
                  [Register]
                </Button>
              </Link>
            </motion.div>
          ) : (
            <motion.div
              key="login-form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="mx-auto w-full max-w-sm px-4 mt-10"
            >
              <div className="bg-background/60 backdrop-blur-md border border-white/10 rounded-xl p-6 text-left">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-1">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={loading}
                      className="bg-white/5 border-white/10"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                      className="bg-white/5 border-white/10"
                    />
                  </div>

                  {error && (
                    <p className="text-sm text-red-400 text-center">{error}</p>
                  )}

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      className="flex-1 bg-white/10"
                      onClick={() => {
                        setShowLoginForm(false)
                        setError("")
                      }}
                      disabled={loading}
                    >
                      Back
                    </Button>
                    <Button type="submit" className="flex-1" disabled={loading}>
                      {loading ? "Signing in..." : "[Log In]"}
                    </Button>
                  </div>
                </form>
              </div>

              <p className="mt-4 text-sm text-muted-foreground text-center">
                Don&apos;t have an account?{" "}
                <Link href="/register" className="text-white hover:underline">
                  Register
                </Link>
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
