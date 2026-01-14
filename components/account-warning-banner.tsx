"use client"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import Link from "next/link"

export function AccountWarningBanner() {
  return (
    <Alert variant="default" className="border-yellow-500/30 bg-yellow-900/60 backdrop-blur-xl shadow-lg">
      <AlertCircle className="h-4 w-4 text-yellow-400" />
      <AlertDescription className="text-sm text-yellow-100">
        Please complete your{" "}
        <Link href="/account" className="underline font-medium text-yellow-200 hover:text-yellow-100">
          account information
        </Link>{" "}
        before participating in group buys.
      </AlertDescription>
    </Alert>
  )
}
