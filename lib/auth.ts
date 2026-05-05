import NextAuth from 'next-auth'
import type { Session } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { authConfig } from '@/auth.config'
import { db } from '@/db'
import { users } from '@/db/schema'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials)
        if (!parsed.success) return null

        const { email, password } = parsed.data

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email.toLowerCase()))
          .limit(1)

        if (!user || !user.passwordHash) return null

        const passwordMatch = await bcrypt.compare(password, user.passwordHash)
        if (!passwordMatch) return null

        return {
          id: user.id,
          email: user.email,
          name: user.fullName ?? user.email,
          role: user.role,
        }
      },
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    ...authConfig.callbacks,
  },
})

// ── Typed server-side session helpers ────────────────────────────────────────
// `auth` is overloaded in NextAuth v5 (server-component shape, middleware-
// wrapper shape, edge handler shape). When TypeScript's `Awaited<ReturnType
// <typeof auth>>` resolves the overloads, it picks the wrapper return type
// (`NextMiddleware`) rather than `Session | null`, which breaks every route
// that touches `session.user.role`. These helpers narrow the type explicitly
// so route handlers can use a `Session | null` directly.

/**
 * Server-side session getter for route handlers and server components.
 * Always returns `Session | null` (never a middleware factory).
 */
export async function getSession(): Promise<Session | null> {
  return (await auth()) as unknown as Session | null
}

/**
 * Returns the current session if (and only if) the user is signed in AND has
 * the `admin` role. Returns `null` otherwise. Convenient for the standard
 * "guard at the top of an admin route handler" pattern:
 *
 *     const session = await requireAdmin()
 *     if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
 */
export async function requireAdmin(): Promise<Session | null> {
  const session = await getSession()
  if (!session?.user?.id || session.user.role !== 'admin') return null
  return session
}
