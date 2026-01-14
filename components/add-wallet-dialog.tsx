"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus } from "lucide-react"

interface AddWalletDialogProps {
  onAdd: (wallet: { chain: string; address: string }) => void
}

export function AddWalletDialog({ onAdd }: AddWalletDialogProps) {
  const [open, setOpen] = useState(false)
  const [chain, setChain] = useState<string>("")
  const [address, setAddress] = useState("")

  const handleAdd = () => {
    if (chain && address) {
      onAdd({ chain, address })
      setChain("")
      setAddress("")
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Wallet
        </Button>
      </DialogTrigger>
      <DialogContent className="add-wallet-overlay">
        <DialogHeader>
          <DialogTitle>Add Crypto Wallet</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div>
            <Label htmlFor="chain" className="text-white">
              Blockchain
            </Label>
            <Select value={chain} onValueChange={setChain}>
              <SelectTrigger id="chain" className="text-white blockchain-select">
                <SelectValue placeholder="Select blockchain" />
              </SelectTrigger>
              <SelectContent className="bg-background/80 backdrop-blur-xl border-white/20 blockchain-select-content">
                <SelectItem value="Ethereum">Ethereum</SelectItem>
                <SelectItem value="Solana">Solana</SelectItem>
                <SelectItem value="Bitcoin">Bitcoin</SelectItem>
                <SelectItem value="Polygon">Polygon</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="address">Wallet Address</Label>
            <Input
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Enter wallet address"
            />
          </div>
          <Button onClick={handleAdd} className="w-full">
            Add Wallet
          </Button>
        </div>
        <style jsx>{`
          .add-wallet-overlay .blockchain-select-content [role="option"] {
            color: white !important;
          }
          .add-wallet-overlay .blockchain-select-content [role="option"][data-highlighted] {
            color: white !important;
            background-color: rgba(255, 255, 255, 0.1);
          }
        `}</style>
      </DialogContent>
    </Dialog>
  )
}
