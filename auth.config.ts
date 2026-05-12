import type { NextAuthConfig } from 'next-auth'
import type { Role } from '@/types/next-auth'

// Edge-safe auth config — no DB imports allowed here (used by middleware)
export const authConfig = {
  pages: {
    signIn: '/login',
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = ((user as { role?: Role }).role ?? 'user') as Role
      }
      return token
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id as string
      if (token.role) session.user.role = token.role as Role
      return session
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const { pathname } = nextUrl

      const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/register')
      const isAdminPage = pathname.startsWith('/admin')
      const isLanding = pathname === '/'

      // Always allow landing
      if (isLanding) return true

      // Redirect logged-in users away from auth pages
      if (isAuthPage) {
        if (isLoggedIn) {
          const homeUrl = new URL('/home', process.env.NEXTAUTH_URL || nextUrl.origin)
          return Response.redirect(homeUrl)
        }
        return true
      }

      // Require login for everything else
      if (!isLoggedIn) return false

      // /admin/* is reachable by admin OR operator. Fine-grained, per-resource
      // gating (operator can only touch their own group buys) is enforced
      // inside each API route via lib/permissions.ts, not here.
      if (isAdminPage) {
        const user = auth?.user as { role?: Role } | undefined
        if (user?.role !== 'admin' && user?.role !== 'operator') {
          const homeUrl = new URL('/home', process.env.NEXTAUTH_URL || nextUrl.origin)
          return Response.redirect(homeUrl)
        }
      }

      return true
    },
  },
  providers: [],
} satisfies NextAuthConfig
