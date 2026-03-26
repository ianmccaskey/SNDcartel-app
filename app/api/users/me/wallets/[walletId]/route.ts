import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { wallets } from '@/db/schema'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ walletId: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { walletId } = await params

  const deleted = await db
    .delete(wallets)
    .where(and(eq(wallets.id, walletId), eq(wallets.userId, session.user.id)))
    .returning({ id: wallets.id })

  if (deleted.length === 0) {
    return NextResponse.json({ error: 'Wallet not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
