import { Resend } from 'resend'
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

const FROM_ADDRESS = process.env.RESEND_FROM_ADDRESS ?? 'SNDcartel <noreply@sndcartel.com>'

// Shared sender. Treats RESEND_API_KEY absence as a soft no-op so dev / CI can
// run without configuring email. Catches and logs errors — email failures must
// never break a primary mutation (order create, payment verify, etc).
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
  if (!process.env.RESEND_API_KEY) {
    console.warn(`RESEND_API_KEY not set — skipping ${context} email to ${to}`)
    return
  }

  const resend = new Resend(process.env.RESEND_API_KEY)

  try {
    const { error } = await resend.emails.send({ from: FROM_ADDRESS, to, subject, html, text })
    if (error) {
      console.error(`Resend send error (${context}):`, error)
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
