import { NextResponse } from 'next/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { wallets } from '@/db/schema'

const addWalletSchema = z.object({
  chain: z.enum(['Ethereum', 'Solana', 'Bitcoin', 'Polygon', 'Base', 'Arbitrum', 'Other']),
  address: z.string().min(10, 'Invalid wallet address'),
  label: z.string().optional(),
})

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userWallets = await db
    .select()
    .from(wallets)
    .where(eq(wallets.userId, session.user.id))

  return NextResponse.json(userWallets)
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const parsed = addWalletSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 },
      )
    }

    const [wallet] = await db
      .insert(wallets)
      .values({
        userId: session.user.id,
        chain: parsed.data.chain,
        address: parsed.data.address,
        label: parsed.data.label,
      })
      .returning()

    return NextResponse.json(wallet, { status: 201 })
  } catch (error: unknown) {
    // Unique constraint: same chain+address already added
    if (error instanceof Error && error.message.includes('unique')) {
      return NextResponse.json(
        { error: 'This wallet address is already added for this chain' },
        { status: 409 },
      )
    }
    console.error('Add wallet error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
