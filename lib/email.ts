import { Resend } from 'resend'
import {
  shippingNotificationHtml,
  shippingNotificationText,
  type ShippingNotificationData,
} from '@/templates/shipping-notification'

const FROM_ADDRESS = process.env.RESEND_FROM_ADDRESS ?? 'SNDcartel <noreply@sndcartel.com>'

export async function sendShippingNotification({
  to,
  data,
}: {
  to: string
  data: ShippingNotificationData
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set — skipping shipping email to', to)
    return
  }

  // Lazily instantiate so the constructor error only fires when the key is present
  const resend = new Resend(process.env.RESEND_API_KEY)

  try {
    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to,
      subject: `Your order has shipped — ${data.orderTitle}`,
      html: shippingNotificationHtml(data),
      text: shippingNotificationText(data),
    })

    if (error) {
      console.error('Resend send error:', error)
    }
  } catch (err) {
    // Email failures should not break the main operation
    console.error('sendShippingNotification failed:', err)
  }
}
