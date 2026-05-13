export interface OrderConfirmationData {
  orderTitle: string
  userFullName: string | null
  orderId: string
  items: Array<{
    productNameSnapshot: string
    quantity: number
    unitPriceUsd: number
    lineTotalUsd: number
  }>
  subtotalUsd: number
  shippingFeeUsd: number
  adminFeeUsd: number
  totalUsd: number
  // URL where the customer can complete payment and view order status
  orderUrl: string
}

const fmt = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function orderConfirmationHtml(data: OrderConfirmationData): string {
  const {
    orderTitle,
    userFullName,
    orderId,
    items,
    subtotalUsd,
    shippingFeeUsd,
    adminFeeUsd,
    totalUsd,
    orderUrl,
  } = data

  const greeting = userFullName ? `Hi ${userFullName},` : 'Hi,'

  const itemsRows = items
    .map(
      (item) => `<tr>
        <td style="padding:8px 0;color:#f1f5f9;font-size:14px">${escapeHtml(item.productNameSnapshot)}</td>
        <td style="padding:8px 0;color:#94a3b8;font-size:14px;text-align:center">×${item.quantity}</td>
        <td style="padding:8px 0;color:#f1f5f9;font-size:14px;text-align:right;font-family:monospace">${fmt(item.lineTotalUsd)}</td>
      </tr>`,
    )
    .join('')

  const feeRows = [
    shippingFeeUsd > 0 ? `<tr><td style="color:#94a3b8;font-size:13px;padding:4px 0">Shipping</td><td colspan="2" style="color:#94a3b8;font-size:13px;text-align:right;font-family:monospace">${fmt(shippingFeeUsd)}</td></tr>` : '',
    adminFeeUsd > 0 ? `<tr><td style="color:#94a3b8;font-size:13px;padding:4px 0">Admin fee</td><td colspan="2" style="color:#94a3b8;font-size:13px;text-align:right;font-family:monospace">${fmt(adminFeeUsd)}</td></tr>` : '',
  ]
    .filter(Boolean)
    .join('')

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Geist Mono',monospace,sans-serif;color:#f1f5f9">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;padding:32px 16px">
    <tr><td>
      <h1 style="color:#FFC700;font-size:24px;margin:0 0 4px">SNDcartel</h1>
      <p style="color:#64748b;font-size:12px;margin:0 0 32px;text-transform:uppercase;letter-spacing:2px">Order received</p>

      <h2 style="font-size:20px;margin:0 0 8px;color:#f1f5f9">Thanks — we got your order</h2>
      <p style="color:#94a3b8;margin:0 0 8px">${greeting}</p>
      <p style="color:#f1f5f9;margin:0 0 16px">Your order for <strong>${escapeHtml(orderTitle)}</strong> has been received. The next step is to send payment via the wallet shown in the app, then we'll verify it (usually within minutes).</p>

      <div style="background:#1e293b;border-radius:8px;padding:16px;margin:16px 0">
        <p style="margin:0 0 12px;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:1px">Order details</p>
        <table width="100%" cellpadding="0" cellspacing="0">
          ${itemsRows}
          <tr><td colspan="3" style="border-top:1px solid #334155;padding-top:8px;margin-top:8px"></td></tr>
          <tr><td style="color:#94a3b8;font-size:13px;padding:4px 0">Subtotal</td><td colspan="2" style="color:#94a3b8;font-size:13px;text-align:right;font-family:monospace">${fmt(subtotalUsd)}</td></tr>
          ${feeRows}
          <tr><td style="color:#FFC700;font-size:16px;font-weight:700;padding:8px 0 0">Total</td><td colspan="2" style="color:#FFC700;font-size:16px;font-weight:700;text-align:right;font-family:monospace;padding:8px 0 0">${fmt(totalUsd)}</td></tr>
        </table>
      </div>

      <a href="${orderUrl}" style="display:inline-block;background:#FFC700;color:#000;font-weight:700;padding:12px 24px;border-radius:6px;text-decoration:none;margin-top:8px">Complete Payment →</a>

      <p style="color:#64748b;font-size:12px;margin:24px 0 0;font-family:monospace">Order #${orderId}</p>

      <hr style="border:none;border-top:1px solid #1e293b;margin:32px 0">
      <p style="color:#475569;font-size:12px;margin:0">This email was sent by SNDcartel. If you have questions, reach out on Discord.</p>
    </td></tr>
  </table>
</body>
</html>`
}

export function orderConfirmationText(data: OrderConfirmationData): string {
  const {
    orderTitle,
    userFullName,
    orderId,
    items,
    subtotalUsd,
    shippingFeeUsd,
    adminFeeUsd,
    totalUsd,
    orderUrl,
  } = data
  const lines = [
    `SNDcartel — Order received`,
    ``,
    userFullName ? `Hi ${userFullName},` : 'Hi,',
    ``,
    `Your order for "${orderTitle}" has been received.`,
    `Send payment via the wallet shown in the app; we'll verify within minutes.`,
    ``,
    `Order details:`,
    ...items.map((i) => `  ${i.productNameSnapshot} × ${i.quantity}  ${fmt(i.lineTotalUsd)}`),
    ``,
    `Subtotal: ${fmt(subtotalUsd)}`,
    shippingFeeUsd > 0 ? `Shipping: ${fmt(shippingFeeUsd)}` : '',
    adminFeeUsd > 0 ? `Admin fee: ${fmt(adminFeeUsd)}` : '',
    `TOTAL: ${fmt(totalUsd)}`,
    ``,
    `Complete payment: ${orderUrl}`,
    ``,
    `Order #${orderId}`,
  ]
  return lines.filter((l) => l !== '').join('\n').trim()
}

// Tiny HTML escaper — we control the data shape but never trust strings that
// originated from user input (productNameSnapshot, orderTitle).
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
