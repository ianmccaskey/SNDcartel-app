import {
  shippingNotificationHtml,
  shippingNotificationText,
  type ShippingNotificationData,
} from '@/templates/shipping-notification'
import {
  orderConfirmationHtml,
  orderConfirmationText,
  type OrderConfirmationData,
} from '@/templates/order-confirmation'
import {
  paymentVerifiedHtml,
  paymentVerifiedText,
  type PaymentVerifiedData,
} from '@/templates/payment-verified'

// ZeptoMail transactional email (Zoho).
//
// Config (env):
//   ZEPTOMAIL_API_TOKEN     — required. The send-API key from
//                              Mail Agents → <agent> → Setup Info. Accepts
//                              either the bare token or the full
//                              "Zoho-enczapikey <token>" header value.
//   ZEPTOMAIL_FROM_ADDRESS  — optional. Defaults to
//                              "SNDcartel <noreply@sndcartel.com>". The
//                              domain must be verified in ZeptoMail.
//   ZEPTOMAIL_BOUNCE_ADDRESS — optional. Defaults to the from address. Used
//                              as bounce_address in the API payload; must
//                              be on a verified domain.
//   ZEPTOMAIL_API_ENDPOINT  — optional. Defaults to the US endpoint
//                              https://api.zeptomail.com/v1.1/email. Use
//                              https://api.zeptomail.eu/v1.1/email for the
//                              EU region.

const FROM_RAW = process.env.ZEPTOMAIL_FROM_ADDRESS ?? 'SNDcartel <noreply@sndcartel.com>'
const API_ENDPOINT = process.env.ZEPTOMAIL_API_ENDPOINT ?? 'https://api.zeptomail.com/v1.1/email'

interface ParsedAddress {
  name?: string
  address: string
}

function parseAddress(raw: string): ParsedAddress {
  // Supports "Display Name <email@domain.tld>" and bare "email@domain.tld".
  const match = raw.match(/^([^<]*)<([^>]+)>\s*$/)
  if (match) {
    const name = match[1].trim()
    return { name: name || undefined, address: match[2].trim() }
  }
  return { address: raw.trim() }
}

function normalizeToken(raw: string): string {
  // ZeptoMail's dashboard shows the token already prefixed; accept either form.
  return raw.startsWith('Zoho-enczapikey ') ? raw : `Zoho-enczapikey ${raw}`
}

const FROM_PARSED = parseAddress(FROM_RAW)
const BOUNCE_ADDRESS =
  process.env.ZEPTOMAIL_BOUNCE_ADDRESS ?? FROM_PARSED.address

// Shared sender. Treats ZEPTOMAIL_API_TOKEN absence as a soft no-op so dev / CI
// can run without configuring email. Catches and logs errors so email failures
// can never break a primary mutation (order create, payment verify, etc).
async function send({
  to,
  subject,
  html,
  text,
  context,
}: {
  to: string
  subject: string
  html: string
  text: string
  context: string
}): Promise<void> {
  const token = process.env.ZEPTOMAIL_API_TOKEN
  if (!token) {
    console.warn(`ZEPTOMAIL_API_TOKEN not set — skipping ${context} email to ${to}`)
    return
  }

  const payload = {
    bounce_address: BOUNCE_ADDRESS,
    from: FROM_PARSED.name
      ? { address: FROM_PARSED.address, name: FROM_PARSED.name }
      : { address: FROM_PARSED.address },
    to: [{ email_address: { address: to } }],
    subject,
    htmlbody: html,
    textbody: text,
  }

  try {
    const res = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: normalizeToken(token),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error(`ZeptoMail send error (${context}): HTTP ${res.status} ${body}`)
    }
  } catch (err) {
    console.error(`send(${context}) failed:`, err)
  }
}

export async function sendShippingNotification({
  to,
  data,
}: {
  to: string
  data: ShippingNotificationData
}): Promise<void> {
  await send({
    to,
    subject: `Your order has shipped — ${data.orderTitle}`,
    html: shippingNotificationHtml(data),
    text: shippingNotificationText(data),
    context: 'shipping_notification',
  })
}

export async function sendOrderConfirmation({
  to,
  data,
}: {
  to: string
  data: OrderConfirmationData
}): Promise<void> {
  await send({
    to,
    subject: `Order received — ${data.orderTitle}`,
    html: orderConfirmationHtml(data),
    text: orderConfirmationText(data),
    context: 'order_confirmation',
  })
}

export async function sendPaymentVerified({
  to,
  data,
}: {
  to: string
  data: PaymentVerifiedData
}): Promise<void> {
  await send({
    to,
    subject: `Payment verified — ${data.orderTitle}`,
    html: paymentVerifiedHtml(data),
    text: paymentVerifiedText(data),
    context: 'payment_verified',
  })
}
