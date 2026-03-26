import type React from "react"
import type { Metadata } from "next"
import { Geist_Mono } from "next/font/google"
import "./globals.css"
import { ClientWrapper } from "@/components/client-wrapper"
import { Providers } from "@/components/providers"

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "SND Cartel App",
  description: "Investment strategies that outperform the market",
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${geistMono.variable} antialiased`} suppressHydrationWarning>
        {/* <ClientWrapper /> */}
        <Providers>
          <div className="relative z-10 bg-black min-h-screen">{children}</div>
        </Providers>
      </body>
    </html>
  )
}
