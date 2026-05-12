import type { DefaultSession, DefaultUser } from 'next-auth'

// The single source of truth for app-level role names. Keep in sync with the
// allow-list in lib/permissions.ts and the comment on users.role in db/schema.ts.
export type Role = 'user' | 'operator' | 'admin'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: Role
    } & DefaultSession['user']
  }

  interface User extends DefaultUser {
    role?: Role
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string
    role?: Role
  }
}
