import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { users } from '@/db/schema'
import { getSession } from '@/lib/auth'

// TEMPORARY DEBUG ENDPOINT — remove before Phase 2 promote.
//
// Tells the caller what the server sees as their identity, plus what the DB
// row for that identity says. If those two don't match, the user is on a
// stale JWT (didn't actually re-login, browser-cached cookie, etc).
//
// GET /api/debug/whoami
export async function GET() {
  const session = await getSession()

  if (!session?.user?.id) {
    return NextResponse.json({ signedIn: false })
  }

  // Read the DB row to compare to what the JWT says.
  const [row] = await db
    .select({ id: users.id, email: users.email, role: users.role })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1)

  return NextResponse.json({
    signedIn: true,
    session: {
      userId: session.user.id,
      email: session.user.email,
      role: session.user.role,
    },
    db: row
      ? {
          userId: row.id,
          email: row.email,
          role: row.role,
        }
      : null,
    match: row?.role === session.user.role,
  })
}
