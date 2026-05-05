import { NextResponse } from 'next/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { requireAdmin } from '@/lib/auth'

const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']

const s3 = new S3Client({
  endpoint: `https://${process.env.DO_SPACES_REGION}.digitaloceanspaces.com`,
  region: process.env.DO_SPACES_REGION!,
  credentials: {
    accessKeyId: process.env.DO_SPACES_KEY!,
    secretAccessKey: process.env.DO_SPACES_SECRET!,
  },
  forcePathStyle: false,
})

const BUCKET = process.env.DO_SPACES_BUCKET!
const CDN_ENDPOINT = process.env.DO_SPACES_CDN_ENDPOINT
  ?? `https://${BUCKET}.${process.env.DO_SPACES_REGION}.cdn.digitaloceanspaces.com`

export async function POST(request: Request) {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `File type '${file.type}' not allowed. Must be an image (JPEG, PNG, GIF, WebP).` },
        { status: 400 },
      )
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: 'File size exceeds 5MB limit.' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Generate unique filename
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const timestamp = Date.now()
    const rand = Math.random().toString(36).slice(2, 8)
    const key = `uploads/${timestamp}-${rand}.${ext}`

    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: buffer,
        ContentType: file.type,
        ACL: 'public-read',
      }),
    )

    const url = `${CDN_ENDPOINT}/${key}`

    return NextResponse.json({ url }, { status: 201 })
  } catch (error) {
    console.error('POST /api/admin/uploads error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
