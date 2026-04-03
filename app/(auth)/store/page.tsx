"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ShoppingCart, Package, Filter } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { StoreCheckoutOverlay } from "@/components/store-checkout-overlay"

interface StoreProduct {
  id: string
  name: string
  description: string
  category: string
  price: number
  imageUrl: string | null
  available: boolean
}

interface CartItem {
  productId: string
  name: string
  price: number
  quantity: number
}

const categoryLabels: Record<string, string> = {
  all: "All Products",
  peptide: "Peptides",
  supplement: "Supplements",
  equipment: "Equipment",
}

export default function StorePage() {
  const router = useRouter()
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false)
  const [products, setProducts] = useState<StoreProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [firstGroupBuyId, setFirstGroupBuyId] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const [productsRes, groupBuysRes] = await Promise.all([
          fetch("/api/store/products"),
          fetch("/api/group-buys"),
        ])
        if (productsRes.ok) {
          const data = await productsRes.json()
          setProducts(data)
        }
        if (groupBuysRes.ok) {
          const gbs = await groupBuysRes.json()
          if (gbs.length > 0) setFirstGroupBuyId(gbs[0].id)
        }
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const filteredProducts =
    selectedCategory === "all"
      ? products
      : products.filter((p) => p.category.toLowerCase() === selectedCategory.toLowerCase())

  const addToCart = (product: StoreProduct) => {
    const existing = cartItems.find((item) => item.productId === product.id)
    if (existing) {
      setCartItems(
        cartItems.map((item) =>
          item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item,
        ),
      )
    } else {
      setCartItems([...cartItems, { productId: product.id, name: product.name, price: product.price, quantity: 1 }])
    }
  }

  const handleJoinGroupBuy = () => {
    if (firstGroupBuyId) {
      router.push(`/group-buy/${firstGroupBuyId}`)
    }
  }

  return (
    <div className="min-h-screen bg-transparent relative">
      <div
        className="container mx-auto px-4 py-8 max-w-6xl relative z-10"
        style={{
          maskImage: "linear-gradient(to bottom, transparent 0%, black 120px, black 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 120px, black 100%)",
        }}
      >
        <div className="mb-8 pt-32 md:pt-40">
          <h1 className="text-4xl font-bold mb-2">Store</h1>
          <p className="text-muted-foreground font-semibold">
            Browse our selection of peptides, supplements, and equipment
          </p>
        </div>

        <div className="hidden md:block mb-6">
          <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
            <TabsList className="bg-background/60 backdrop-blur-md border border-white/10">
              <TabsTrigger value="all">All Products</TabsTrigger>
              <TabsTrigger value="peptide">Peptides</TabsTrigger>
              <TabsTrigger value="supplement">Supplements</TabsTrigger>
              <TabsTrigger value="equipment">Equipment</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="md:hidden mb-6">
          <div className="store-categories-filter text-white">
            <div className="flex items-center gap-2 mb-2">
              <Filter className="h-4 w-4" />
              <label className="text-sm font-medium text-white">Categories</label>
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full bg-background/60 backdrop-blur-md border-white/10 text-white">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent className="store-categories-select-content bg-black/90 border-white/10">
                <SelectItem value="all">{categoryLabels.all}</SelectItem>
                <SelectItem value="peptide">{categoryLabels.peptide}</SelectItem>
                <SelectItem value="supplement">{categoryLabels.supplement}</SelectItem>
                <SelectItem value="equipment">{categoryLabels.equipment}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="bg-background/80 backdrop-blur-md border-white/10 shadow-lg h-48 animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            <motion.div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3" layout>
              <AnimatePresence mode="popLayout">
                {filteredProducts.map((product, index) => (
                  <motion.div
                    key={product.id}
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.3, delay: index * 0.05, ease: "easeOut" }}
                  >
                    <Card className="bg-background/80 backdrop-blur-md border-white/10 shadow-lg h-full flex flex-col">
                      <CardHeader>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-lg">{product.name}</CardTitle>
                            {!product.available && (
                              <Badge variant="secondary" className="text-xs mt-1">
                                Out of Stock
                              </Badge>
                            )}
                            <CardDescription className="text-sm mt-1">{product.description}</CardDescription>
                          </div>
                          {product.imageUrl ? (
                            <div className="w-20 h-20 rounded-lg overflow-hidden border border-white/10 flex-shrink-0">
                              <img
                                src={product.imageUrl}
                                alt={product.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="w-20 h-20 rounded-lg border border-white/10 flex-shrink-0 flex items-center justify-center bg-white/5">
                              <Package className="h-8 w-8 text-muted-foreground/40" />
                            </div>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-bold">${product.price.toFixed(2)}</span>
                        </div>
                      </CardContent>
                      <CardFooter>
                        <div className="flex flex-col gap-2 w-full">
                          {firstGroupBuyId && (
                            <Button
                              className="w-full bg-yellow-600 hover:bg-yellow-700"
                              disabled={!product.available}
                              onClick={handleJoinGroupBuy}
                            >
                              Join Group Buy
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            className="w-full bg-transparent"
                            disabled={!product.available}
                            onClick={() => {
                              addToCart(product)
                              setIsCheckoutOpen(true)
                            }}
                          >
                            <ShoppingCart className="mr-2 h-4 w-4" />
                            Add to Cart
                          </Button>
                        </div>
                      </CardFooter>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>

            {filteredProducts.length === 0 && (
              <Card className="bg-background/60 backdrop-blur-md border-white/10">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Package className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No products found in this category</p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      <StoreCheckoutOverlay
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        cartItems={cartItems}
        onCartUpdate={setCartItems}
      />

      <style jsx>{`
        .store-categories-select-content [role="option"] {
          color: #ffffff;
        }
        .store-categories-select-content [role="option"][data-state="checked"] {
          background-color: rgba(0, 0, 0, 0.5);
          color: #ffffff;
        }
        .store-categories-select-content [role="option"][data-highlighted] {
          background-color: rgba(31, 41, 55, 0.8);
          color: #ffffff;
        }
      `}</style>
    </div>
  )
}
