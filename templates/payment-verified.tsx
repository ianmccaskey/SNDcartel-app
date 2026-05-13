export interface PaymentVerifiedData {
  orderTitle: string
  userFullName: string | null
  orderId: string
  totalUsd: number
  // URL where the customer can track the order
  orderUrl: string
  // 'auto' if matched by the Alchemy webhook, 'manual' if approved by an admin/operator.
  verifiedBy: 'auto' | 'manual'
}

const fmt = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function paymentVerifiedHtml(data: PaymentVerifiedData): string {
  const { orderTitle, userFullName, orderId, totalUsd, orderUrl, verifiedBy } = data

  const greeting = userFullName ? `Hi ${userFullName},` : 'Hi,'
  const verificationNote =
    verifiedBy === 'auto'
      ? `We saw your transaction on-chain and matched it to your order automatically.`
      : `Your payment has been verified by our team.`

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Geist Mono',monospace,sans-serif;color:#f1f5f9">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;padding:32px 16px">
    <tr><td>
      <h1 style="color:#FFC700;font-size:24px;margin:0 0 4px">SNDcartel</h1>
      <p style="color:#64748b;font-size:12px;margin:0 0 32px;text-transform:uppercase;letter-spacing:2px">Payment verified</p>

      <h2 style="font-size:20px;margin:0 0 8px;color:#10b981">✓ Your payment is confirmed</h2>
      <p style="color:#94a3b8;margin:0 0 8px">${greeting}</p>
      <p style="color:#f1f5f9;margin:0 0 16px">${verificationNote}</p>

      <div style="background:#1e293b;border-radius:8px;padding:16px;margin:16px 0">
        <p style="margin:0 0 4px;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:1px">Order</p>
        <p style="margin:0 0 12px;color:#f1f5f9;font-size:16px;font-weight:600">${escapeHtml(orderTitle)}</p>
        <p style="margin:0 0 4px;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:1px">Amount</p>
        <p style="margin:0;color:#FFC700;font-size:18px;font-weight:700;font-family:monospace">${fmt(totalUsd)}</p>
      </div>

      <p style="color:#94a3b8;margin:16px 0 8px">We'll start preparing your order. You'll get another email with tracking information once it ships.</p>

      <a href="${orderUrl}" style="display:inline-block;background:#FFC700;color:#000;font-weight:700;padding:12px 24px;border-radius:6px;text-decoration:none;margin-top:8px">View Order →</a>

      <p style="color:#64748b;font-size:12px;margin:24px 0 0;font-family:monospace">Order #${orderId}</p>

      <hr style="border:none;border-top:1px solid #1e293b;margin:32px 0">
      <p style="color:#475569;font-size:12px;margin:0">This email was sent by SNDcartel. If you have questions, reach out on Discord.</p>
    </td></tr>
  </table>
</body>
</html>`
}

export function paymentVerifiedText(data: PaymentVerifiedData): string {
  const { orderTitle, userFullName, orderId, totalUsd, orderUrl, verifiedBy } = data
  const lines = [
    `SNDcartel — Payment verified`,
    ``,
    userFullName ? `Hi ${userFullName},` : 'Hi,',
    ``,
    verifiedBy === 'auto'
      ? `We saw your transaction on-chain and matched it to your order automatically.`
      : `Your payment has been verified by our team.`,
    ``,
    `Order: ${orderTitle}`,
    `Amount: ${fmt(totalUsd)}`,
    ``,
    `We'll start preparing your order. You'll get another email with tracking once it ships.`,
    ``,
    `View order: ${orderUrl}`,
    ``,
    `Order #${orderId}`,
  ]
  return lines.filter((l) => l !== '').join('\n').trim()
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
