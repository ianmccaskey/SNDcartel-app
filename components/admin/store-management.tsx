"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { StoreProduct } from "@/lib/admin-types"
import { Plus, Edit2, Save, X } from "lucide-react"
import { loadFromStorage, saveToStorage } from "@/lib/storage"

export function StoreManagement() {
  const [products, setProducts] = useState<StoreProduct[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<StoreProduct>>({})

  useEffect(() => {
    const storedProducts = loadFromStorage<StoreProduct[]>("admin_store_products") || []
    setProducts(storedProducts)
  }, [])

  const saveProducts = (updatedProducts: StoreProduct[]) => {
    setProducts(updatedProducts)
    saveToStorage("admin_store_products", updatedProducts)
  }

  const createNewProduct = () => {
    const newProduct: StoreProduct = {
      id: Date.now().toString(),
      name: "New Product",
      description: "",
      price: 0,
      available: true,
      category: "Uncategorized",
      createdAt: new Date().toISOString(),
    }
    saveProducts([...products, newProduct])
    startEditing(newProduct)
  }

  const startEditing = (product: StoreProduct) => {
    setEditingId(product.id)
    setEditForm(product)
  }

  const saveEdit = () => {
    if (!editingId) return
    const updated = products.map((p) => (p.id === editingId ? { ...p, ...editForm } : p))
    saveProducts(updated)
    setEditingId(null)
    setEditForm({})
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditForm({})
  }

  const toggleAvailability = (productId: string) => {
    const updated = products.map((p) => (p.id === productId ? { ...p, available: !p.available } : p))
    saveProducts(updated)
  }

  return (
    <div className="space-y-6">
      <Card className="bg-background/60 backdrop-blur-md border-white/10">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Store Products</CardTitle>
          <Button onClick={createNewProduct} size="sm" className="bg-yellow-600 hover:bg-yellow-700">
            <Plus className="w-4 h-4 mr-2" />
            New Product
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Available</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.id}>
                  {editingId === product.id ? (
                    <>
                      <TableCell>
                        <Input
                          value={editForm.name || ""}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="bg-background/40"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={editForm.description || ""}
                          onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                          className="bg-background/40"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={editForm.category || ""}
                          onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                          className="bg-background/40"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={editForm.price || 0}
                          onChange={(e) => setEditForm({ ...editForm, price: Number(e.target.value) })}
                          className="w-24 bg-background/40"
                        />
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={editForm.available}
                          onCheckedChange={(checked) => setEditForm({ ...editForm, available: checked })}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={saveEdit}>
                            <Save className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={cancelEdit}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{product.description}</TableCell>
                      <TableCell className="text-sm">{product.category}</TableCell>
                      <TableCell className="font-medium">${product.price.toFixed(2)}</TableCell>
                      <TableCell>
                        <Switch checked={product.available} onCheckedChange={() => toggleAvailability(product.id)} />
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => startEditing(product)}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
