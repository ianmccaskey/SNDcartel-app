export interface PaymentRejectedData {
  orderTitle: string
  userFullName: string | null
  orderId: string
  totalUsd: number
  reason: string
  // URL where the customer can submit a new payment.
  orderUrl: string
}

const fmt = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function paymentRejectedHtml(data: PaymentRejectedData): string {
  const { orderTitle, userFullName, orderId, totalUsd, reason, orderUrl } = data

  const greeting = userFullName ? `Hi ${userFullName},` : 'Hi,'

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Geist Mono',monospace,sans-serif;color:#f1f5f9">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;padding:32px 16px">
    <tr><td>
      <h1 style="color:#FFC700;font-size:24px;margin:0 0 4px">SNDcartel</h1>
      <p style="color:#64748b;font-size:12px;margin:0 0 32px;text-transform:uppercase;letter-spacing:2px">Payment needs attention</p>

      <h2 style="font-size:20px;margin:0 0 8px;color:#f87171">Your payment couldn't be verified</h2>
      <p style="color:#94a3b8;margin:0 0 8px">${greeting}</p>
      <p style="color:#f1f5f9;margin:0 0 16px">We weren't able to verify the payment for your order <strong>${escapeHtml(orderTitle)}</strong>. Your order is still reserved — you can submit a new transaction and we'll review it again.</p>

      <div style="background:#1e293b;border-radius:8px;padding:16px;margin:16px 0;border-left:3px solid #f87171">
        <p style="margin:0 0 4px;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:1px">Reason</p>
        <p style="margin:0 0 12px;color:#f1f5f9;font-size:14px">${escapeHtml(reason)}</p>
        <p style="margin:0 0 4px;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:1px">Amount expected</p>
        <p style="margin:0;color:#FFC700;font-size:18px;font-weight:700;font-family:monospace">${fmt(totalUsd)}</p>
      </div>

      <p style="color:#94a3b8;margin:16px 0 8px">Open your order in the app to resubmit your payment with a new transaction hash.</p>

      <a href="${orderUrl}" style="display:inline-block;background:#FFC700;color:#000;font-weight:700;padding:12px 24px;border-radius:6px;text-decoration:none;margin-top:8px">Resubmit Payment →</a>

      <p style="color:#64748b;font-size:12px;margin:24px 0 0;font-family:monospace">Order #${orderId}</p>

      <hr style="border:none;border-top:1px solid #1e293b;margin:32px 0">
      <p style="color:#475569;font-size:12px;margin:0">This email was sent by SNDcartel. If you have questions, reach out on Discord.</p>
    </td></tr>
  </table>
</body>
</html>`
}

export function paymentRejectedText(data: PaymentRejectedData): string {
  const { orderTitle, userFullName, orderId, totalUsd, reason, orderUrl } = data
  const lines = [
    `SNDcartel — Payment needs attention`,
    ``,
    userFullName ? `Hi ${userFullName},` : 'Hi,',
    ``,
    `We weren't able to verify the payment for your order "${orderTitle}".`,
    `Your order is still reserved — you can submit a new transaction.`,
    ``,
    `Reason: ${reason}`,
    `Amount expected: ${fmt(totalUsd)}`,
    ``,
    `Resubmit payment: ${orderUrl}`,
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
