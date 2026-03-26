import { NextResponse } from 'next/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { users } from '@/db/schema'

const patchSchema = z.object({
  fullName: z.string().min(1).optional(),
  discordName: z.string().optional(),
  phone: z.string().optional(),
  country: z.string().optional(),
  shippingLine1: z.string().optional(),
  shippingLine2: z.string().optional(),
  shippingCity: z.string().optional(),
  shippingState: z.string().optional(),
  shippingZip: z.string().optional(),
  shippingCountry: z.string().optional(),
})

function isProfileComplete(user: {
  fullName: string | null
  shippingLine1: string | null
  shippingCity: string | null
  shippingState: string | null
  shippingZip: string | null
}) {
  return !!(
    user.fullName &&
    user.shippingLine1 &&
    user.shippingCity &&
    user.shippingState &&
    user.shippingZip
  )
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      fullName: users.fullName,
      discordName: users.discordName,
      phone: users.phone,
      country: users.country,
      shippingLine1: users.shippingLine1,
      shippingLine2: users.shippingLine2,
      shippingCity: users.shippingCity,
      shippingState: users.shippingState,
      shippingZip: users.shippingZip,
      shippingCountry: users.shippingCountry,
      profileComplete: users.profileComplete,
      accountStatus: users.accountStatus,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1)

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  return NextResponse.json(user)
}

export async function PATCH(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const parsed = patchSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 },
      )
    }

    const updates = parsed.data

    // Fetch current values to compute profileComplete
    const [current] = await db
      .select({
        fullName: users.fullName,
        shippingLine1: users.shippingLine1,
        shippingCity: users.shippingCity,
        shippingState: users.shippingState,
        shippingZip: users.shippingZip,
      })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1)

    if (!current) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const merged = { ...current, ...updates }
    const profileComplete = isProfileComplete(merged)

    const [updated] = await db
      .update(users)
      .set({
        ...updates,
        profileComplete,
        updatedAt: new Date(),
      })
      .where(eq(users.id, session.user.id))
      .returning({
        id: users.id,
        email: users.email,
        role: users.role,
        fullName: users.fullName,
        discordName: users.discordName,
        phone: users.phone,
        country: users.country,
        shippingLine1: users.shippingLine1,
        shippingLine2: users.shippingLine2,
        shippingCity: users.shippingCity,
        shippingState: users.shippingState,
        shippingZip: users.shippingZip,
        shippingCountry: users.shippingCountry,
        profileComplete: users.profileComplete,
        accountStatus: users.accountStatus,
      })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Profile update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
