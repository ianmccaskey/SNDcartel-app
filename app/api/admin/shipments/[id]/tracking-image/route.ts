import { NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { shipments } from '@/db/schema'
import { requireAdmin } from '@/lib/auth'
import { logAdminAction } from '@/lib/audit'

const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    // Verify shipment exists
    const [existing] = await db
      .select({ id: shipments.id })
      .from(shipments)
      .where(eq(shipments.id, id))
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: 'Shipment not found' }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `File type '${file.type}' not allowed. Must be JPEG, PNG, GIF, or WebP.` },
        { status: 400 },
      )
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: 'File size exceeds 5MB limit.' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const timestamp = Date.now()
    const rand = Math.random().toString(36).slice(2, 8)
    const filename = `${timestamp}-${rand}.${ext}`

    const trackingDir = path.join(process.cwd(), 'public', 'uploads', 'tracking')
    await mkdir(trackingDir, { recursive: true })

    await writeFile(path.join(trackingDir, filename), buffer)

    const trackingImageUrl = `/uploads/tracking/${filename}`

    await db
      .update(shipments)
      .set({ trackingImageUrl, updatedAt: new Date() })
      .where(eq(shipments.id, id))

    await logAdminAction({
      adminUserId: session.user.id,
      actionType: 'shipment_tracking_image_uploaded',
      targetType: 'shipment',
      targetId: id,
      payload: { trackingImageUrl },
      request,
    })

    return NextResponse.json({ url: trackingImageUrl }, { status: 201 })
  } catch (error) {
    console.error('POST /api/admin/shipments/[id]/tracking-image error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
