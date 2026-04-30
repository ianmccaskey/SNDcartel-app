import { db } from '@/db'
import { adminActions } from '@/db/schema'

interface AuditParams {
  adminUserId: string
  actionType: string
  targetType: string
  targetId: string
  payload?: Record<string, unknown>
  request?: Request
}

export async function logAdminAction({
  adminUserId,
  actionType,
  targetType,
  targetId,
  payload,
  request,
}: AuditParams): Promise<void> {
  try {
    await db.insert(adminActions).values({
      adminUserId,
      actionType,
      targetType,
      targetId,
      payload: payload ?? null,
      ipAddress: request ? (request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? null) : null,
      userAgent: request ? (request.headers.get('user-agent') ?? null) : null,
    })
  } catch (err) {
    // Audit failures should not break the main operation
    console.error('audit log failed:', err)
  }
}
