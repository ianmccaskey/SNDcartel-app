import type { NextAuthConfig } from 'next-auth'

// Edge-safe auth config — no DB imports allowed here (used by middleware)
export const authConfig = {
  pages: {
    signIn: '/login',
  },
  callbacks: {
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
        if (isLoggedIn) return Response.redirect(new URL('/home', nextUrl))
        return true
      }

      // Require login for everything else
      if (!isLoggedIn) return false

      // Admin pages require admin role
      if (isAdminPage) {
        const user = auth?.user as { role?: string } | undefined
        if (user?.role !== 'admin') {
          return Response.redirect(new URL('/home', nextUrl))
        }
      }

      return true
    },
  },
  providers: [],
} satisfies NextAuthConfig
