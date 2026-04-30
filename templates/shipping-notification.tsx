export interface ShippingNotificationData {
  orderTitle: string
  userFullName: string | null
  carrier: string | null
  trackingNumber: string | null
  trackingUrl: string | null
  estimatedDelivery: string | null
  isPartial: boolean
  notes: string | null
}

export function shippingNotificationHtml(data: ShippingNotificationData): string {
  const {
    orderTitle,
    userFullName,
    carrier,
    trackingNumber,
    trackingUrl,
    estimatedDelivery,
    isPartial,
    notes,
  } = data

  const greeting = userFullName ? `Hi ${userFullName},` : 'Hi,'
  const partialNote = isPartial
    ? `<p style="color:#f59e0b;margin:0 0 12px">⚠️ This is a <strong>partial shipment</strong>. Remaining items will ship separately.</p>`
    : ''
  const trackingBlock =
    trackingNumber
      ? `<div style="background:#1e293b;border-radius:8px;padding:16px;margin:16px 0">
          <p style="margin:0 0 4px;color:#94a3b8;font-size:12px">CARRIER</p>
          <p style="margin:0 0 12px;color:#f1f5f9;font-size:16px;font-weight:600">${carrier ?? 'Carrier'}</p>
          <p style="margin:0 0 4px;color:#94a3b8;font-size:12px">TRACKING NUMBER</p>
          <p style="margin:0 0 12px;color:#f1f5f9;font-size:16px;font-family:monospace">${trackingNumber}</p>
          ${estimatedDelivery ? `<p style="margin:0 0 4px;color:#94a3b8;font-size:12px">ESTIMATED DELIVERY</p><p style="margin:0;color:#f1f5f9;font-size:14px">${estimatedDelivery}</p>` : ''}
        </div>
        ${trackingUrl ? `<a href="${trackingUrl}" style="display:inline-block;background:#06b6d4;color:#000;font-weight:700;padding:12px 24px;border-radius:6px;text-decoration:none;margin-top:8px">Track Your Package →</a>` : ''}`
      : ''

  const notesBlock = notes
    ? `<p style="color:#94a3b8;font-size:14px;margin:16px 0 0"><strong>Note:</strong> ${notes}</p>`
    : ''

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Geist Mono',monospace,sans-serif;color:#f1f5f9">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;padding:32px 16px">
    <tr><td>
      <h1 style="color:#06b6d4;font-size:24px;margin:0 0 4px">SNDcartel</h1>
      <p style="color:#64748b;font-size:12px;margin:0 0 32px;text-transform:uppercase;letter-spacing:2px">Order Update</p>

      <h2 style="font-size:20px;margin:0 0 8px;color:#f1f5f9">Your order has shipped</h2>
      <p style="color:#94a3b8;margin:0 0 24px">${greeting}</p>
      <p style="color:#f1f5f9;margin:0 0 16px">Your order for <strong>${orderTitle}</strong> has been shipped and is on its way.</p>

      ${partialNote}
      ${trackingBlock}
      ${notesBlock}

      <hr style="border:none;border-top:1px solid #1e293b;margin:32px 0">
      <p style="color:#475569;font-size:12px;margin:0">This email was sent by SNDcartel. If you have questions, reach out on Discord.</p>
    </td></tr>
  </table>
</body>
</html>`
}

export function shippingNotificationText(data: ShippingNotificationData): string {
  const { orderTitle, userFullName, carrier, trackingNumber, trackingUrl, estimatedDelivery, isPartial, notes } = data
  const lines = [
    `SNDcartel — Your order has shipped`,
    ``,
    userFullName ? `Hi ${userFullName},` : 'Hi,',
    ``,
    `Your order for "${orderTitle}" has been shipped.`,
    isPartial ? `NOTE: This is a partial shipment. Remaining items will ship separately.` : '',
    ``,
    carrier ? `Carrier: ${carrier}` : '',
    trackingNumber ? `Tracking Number: ${trackingNumber}` : '',
    trackingUrl ? `Track: ${trackingUrl}` : '',
    estimatedDelivery ? `Estimated Delivery: ${estimatedDelivery}` : '',
    notes ? `\nNote: ${notes}` : '',
  ]
  return lines.filter((l) => l !== undefined).join('\n').trim()
}
