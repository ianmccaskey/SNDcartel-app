import NextAuth from 'next-auth'
import { authConfig } from './auth.config'

// Use the edge-safe config (no DB imports) for middleware
export default NextAuth(authConfig).auth

export const config = {
  matcher: [
    /*
     * Match all paths except:
     *  - _next/static (static files)
     *  - _next/image (image optimization)
     *  - favicon.ico
     *  - api/auth/** (NextAuth routes — handled internally)
     *  - api/webhooks/** (Alchemy webhooks — have their own signature verification)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/).*)',
  ],
}
