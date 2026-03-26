// Supported carriers and their tracking URL templates
export const CARRIERS = ['USPS', 'UPS', 'FedEx', 'DHL', 'Other'] as const
export type Carrier = (typeof CARRIERS)[number]

export function getTrackingUrl(carrier: string, trackingNumber: string): string {
  const n = encodeURIComponent(trackingNumber.trim())
  switch (carrier.toUpperCase()) {
    case 'USPS':
      return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${n}`
    case 'UPS':
      return `https://www.ups.com/track?loc=null&tracknum=${n}`
    case 'FEDEX':
      return `https://www.fedex.com/fedextrack/?trknbr=${n}`
    case 'DHL':
      return `https://www.dhl.com/us-en/home/tracking/tracking-express.html?submit=1&tracking-id=${n}`
    default:
      return ''
  }
}
