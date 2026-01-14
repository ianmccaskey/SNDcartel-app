"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { Wallet } from "@/lib/types"
import { Trash2 } from "lucide-react"
import { AddWalletDialog } from "./add-wallet-dialog"

interface WalletsCardProps {
  wallets: Wallet[]
  onAdd: (wallet: Omit<Wallet, "id">) => void
  onRemove: (id: string) => void
}

export function WalletsCard({ wallets, onAdd, onRemove }: WalletsCardProps) {
  return (
    <Card className="bg-background/80 backdrop-blur-md border-white/10">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Crypto Wallets</CardTitle>
        <AddWalletDialog onAdd={onAdd} />
      </CardHeader>
      <CardContent>
        {wallets.length === 0 ? (
          <p className="text-sm text-muted-foreground">No wallets added yet.</p>
        ) : (
          <div className="space-y-3">
            {wallets.map((wallet) => (
              <div key={wallet.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{wallet.chain}</div>
                  <div className="text-xs text-muted-foreground truncate">{wallet.address}</div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => onRemove(wallet.id)} className="ml-2">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
