"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { StoreProduct } from "@/lib/admin-types"
import { Plus, Edit2, Save, X, Loader2, Upload, Image as ImageIcon } from "lucide-react"

export function StoreManagement() {
  const [products, setProducts] = useState<StoreProduct[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<StoreProduct>>({})
  const [loading, setLoading] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Load ──────────────────────────────────────────────────────────────────

  const loadProducts = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/store/products")
      if (!res.ok) throw new Error(await res.text())
      setProducts(await res.json())
    } catch (e) {
      setError("Failed to load products")
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProducts()
  }, [])

  // ── Create ────────────────────────────────────────────────────────────────

  const createNewProduct = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/store/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Product", description: "", category: "Uncategorized", price: 0 }),
      })
      if (!res.ok) throw new Error(await res.text())
      const newProduct: StoreProduct = await res.json()
      setProducts((prev) => [...prev, newProduct])
      startEditing(newProduct)
    } catch (e) {
      setError("Failed to create product")
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // ── Edit / Save ───────────────────────────────────────────────────────────

  const startEditing = (product: StoreProduct) => {
    setEditingId(product.id)
    setEditForm(product)
  }

  const saveEdit = async () => {
    if (!editingId) return
    setSavingId(editingId)
    setError(null)
    try {
      const res = await fetch(`/api/admin/store/products/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name,
          description: editForm.description,
          category: editForm.category,
          price: editForm.price,
          available: editForm.available,
          imageUrl: editForm.imageUrl,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      const updated: StoreProduct = await res.json()
      setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
      setEditingId(null)
      setEditForm({})
    } catch (e) {
      setError("Failed to save product")
      console.error(e)
    } finally {
      setSavingId(null)
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingImage(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch("/api/admin/uploads", { method: "POST", body: formData })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Upload failed" }))
        throw new Error(err.error || "Upload failed")
      }
      const { url } = await res.json()
      setEditForm((prev) => ({ ...prev, imageUrl: url }))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image upload failed")
    } finally {
      setUploadingImage(false)
    }
  }

  const cancelEdit = () => {
    // If editing a freshly-created product that was never saved, remove it
    const isNew = products.find((p) => p.id === editingId && p.name === "New Product")
    if (isNew) {
      setProducts((prev) => prev.filter((p) => p.id !== editingId))
    }
    setEditingId(null)
    setEditForm({})
  }

  // ── Toggle availability (immediate PATCH) ─────────────────────────────────

  const toggleAvailability = async (productId: string) => {
    const product = products.find((p) => p.id === productId)
    if (!product) return

    // Optimistic update
    setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, available: !p.available } : p)))

    try {
      const res = await fetch(`/api/admin/store/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ available: !product.available }),
      })
      if (!res.ok) throw new Error(await res.text())
    } catch (e) {
      // Revert on failure
      setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, available: product.available } : p)))
      setError("Failed to update availability")
      console.error(e)
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  const deleteProduct = async (productId: string) => {
    const product = products.find((p) => p.id === productId)
    if (!product) return
    if (!confirm(`Delete "${product.name}"?`)) return

    // Optimistic remove
    setProducts((prev) => prev.filter((p) => p.id !== productId))

    try {
      const res = await fetch(`/api/admin/store/products/${productId}`, { method: "DELETE" })
      if (!res.ok) throw new Error(await res.text())
    } catch (e) {
      setError("Failed to delete product")
      console.error(e)
      await loadProducts()
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-900/40 border border-red-500/40 rounded-lg px-4 py-3 flex items-center justify-between">
          <span className="text-red-300 text-sm">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200 ml-4">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <Card className="bg-background/60 backdrop-blur-md border-white/10">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Store Products</CardTitle>
          <Button onClick={createNewProduct} disabled={loading} size="sm" className="bg-yellow-600 hover:bg-yellow-700">
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
            New Product
          </Button>
        </CardHeader>
        <CardContent>
          {loading && products.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Loading products...
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Image</TableHead>
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
                          <div className="flex flex-col items-center gap-1">
                            {editForm.imageUrl ? (
                              <img src={editForm.imageUrl} alt="" className="w-12 h-12 rounded object-cover border border-white/10" />
                            ) : (
                              <div className="w-12 h-12 rounded border border-white/10 bg-white/5 flex items-center justify-center">
                                <ImageIcon className="w-5 h-5 text-muted-foreground/40" />
                              </div>
                            )}
                            <label className="cursor-pointer text-xs text-yellow-500 hover:text-yellow-400 flex items-center gap-1">
                              {uploadingImage ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                              {uploadingImage ? "..." : "Upload"}
                              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploadingImage} />
                            </label>
                          </div>
                        </TableCell>
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
                            <Button variant="ghost" size="sm" onClick={saveEdit} disabled={savingId === product.id}>
                              {savingId === product.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Save className="w-4 h-4" />
                              )}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={cancelEdit}>
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell>
                          {product.imageUrl ? (
                            <img src={product.imageUrl} alt={product.name} className="w-12 h-12 rounded object-cover border border-white/10" />
                          ) : (
                            <div className="w-12 h-12 rounded border border-white/10 bg-white/5 flex items-center justify-center">
                              <ImageIcon className="w-5 h-5 text-muted-foreground/40" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{product.description}</TableCell>
                        <TableCell className="text-sm">{product.category}</TableCell>
                        <TableCell className="font-medium">${product.price.toFixed(2)}</TableCell>
                        <TableCell>
                          <Switch checked={product.available} onCheckedChange={() => toggleAvailability(product.id)} />
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => startEditing(product)}>
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteProduct(product.id)}
                              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
