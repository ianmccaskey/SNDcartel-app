"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ShoppingCart, Package, Clock, Filter } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { StoreCheckoutOverlay } from "@/components/store-checkout-overlay"

interface Product {
  id: string
  name: string
  category: "peptide" | "supplement" | "equipment"
  price: number
  groupBuyPrice?: number
  description: string
  inStock: boolean
  groupBuyActive?: boolean
  groupBuyEnds?: string
  minGroupSize?: number
  currentGroupSize?: number
}

interface CartItem {
  productId: string
  name: string
  price: number
  quantity: number
}

const mockProducts: Product[] = [
  {
    id: "1",
    name: "BPC-157 (5mg)",
    category: "peptide",
    price: 45.0,
    groupBuyPrice: 32.0,
    description: "High-purity BPC-157 peptide for tissue repair and recovery",
    inStock: true,
    groupBuyActive: true,
    groupBuyEnds: "2024-01-15",
    minGroupSize: 10,
    currentGroupSize: 7,
  },
  {
    id: "2",
    name: "TB-500 (5mg)",
    category: "peptide",
    price: 55.0,
    groupBuyPrice: 38.0,
    description: "Premium TB-500 with third-party testing certificates",
    inStock: true,
    groupBuyActive: true,
    groupBuyEnds: "2024-01-20",
    minGroupSize: 10,
    currentGroupSize: 9,
  },
  {
    id: "3",
    name: "NAD+ (500mg)",
    category: "supplement",
    price: 35.0,
    description: "High-quality NAD+ precursor for cellular health",
    inStock: true,
  },
  {
    id: "4",
    name: "Bacteriostatic Water (30ml)",
    category: "equipment",
    price: 12.0,
    description: "Sterile bacteriostatic water for reconstitution",
    inStock: true,
  },
  {
    id: "5",
    name: "GHK-Cu (50mg)",
    category: "peptide",
    price: 40.0,
    description: "Copper peptide for skin and tissue regeneration",
    inStock: false,
  },
]

export default function StorePage() {
  const [selectedCategory, setSelectedCategory] = useState<"all" | "peptide" | "supplement" | "equipment">("all")
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false)

  const filteredProducts =
    selectedCategory === "all" ? mockProducts : mockProducts.filter((p) => p.category === selectedCategory)

  const activeGroupBuys = mockProducts.filter((p) => p.groupBuyActive)

  const categoryLabels = {
    all: "All Products",
    peptide: "Peptides",
    supplement: "Supplements",
    equipment: "Equipment",
  }

  const addToCart = (product: Product) => {
    const existingItem = cartItems.find((item) => item.productId === product.id)
    if (existingItem) {
      setCartItems(
        cartItems.map((item) => (item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item)),
      )
    } else {
      setCartItems([...cartItems, { productId: product.id, name: product.name, price: product.price, quantity: 1 }])
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

        {activeGroupBuys.length > 0 && (
          <Card className="mb-6 bg-yellow-900/60 backdrop-blur-xl border-yellow-700/50 shadow-lg">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-yellow-500" />
                <CardTitle className="text-yellow-100">Active Group Buys</CardTitle>
              </div>
              <CardDescription className="text-yellow-200/80">
                Join group buys to save up to 30% on select products
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {activeGroupBuys.map((product) => (
                  <div key={product.id} className="bg-black/20 rounded-lg p-4 border border-yellow-700/30">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold text-yellow-50">{product.name}</h3>
                      </div>
                      <Badge variant="outline" className="bg-yellow-500/20 text-yellow-100 border-yellow-500/50">
                        Ends {new Date(product.groupBuyEnds!).toLocaleDateString()}
                      </Badge>
                    </div>
                    <div className="flex items-baseline gap-2 mb-3">
                      <span className="text-lg font-bold text-yellow-100">${product.groupBuyPrice}</span>
                      <span className="text-sm text-yellow-300/60 line-through">${product.price}</span>
                      <span className="text-xs text-yellow-200">
                        Save {Math.round(((product.price - product.groupBuyPrice!) / product.price) * 100)}%
                      </span>
                    </div>
                    <Button size="sm" className="w-full bg-yellow-600 hover:bg-yellow-700 text-white">
                      Join Group Buy
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="hidden md:block mb-6">
          <Tabs value={selectedCategory} onValueChange={(v) => setSelectedCategory(v as any)}>
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
            <Select value={selectedCategory} onValueChange={(v) => setSelectedCategory(v as any)}>
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

        <motion.div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3" layout>
          <AnimatePresence mode="popLayout">
            {filteredProducts.map((product, index) => (
              <motion.div
                key={product.id}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{
                  duration: 0.3,
                  delay: index * 0.05,
                  ease: "easeOut",
                }}
              >
                <Card className="bg-background/80 backdrop-blur-md border-white/10 shadow-lg h-full flex flex-col">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg">{product.name}</CardTitle>
                      {!product.inStock && (
                        <Badge variant="secondary" className="text-xs">
                          Out of Stock
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="text-sm">{product.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold">${product.price.toFixed(2)}</span>
                      {product.groupBuyActive && (
                        <Badge variant="default" className="bg-yellow-600">
                          Group Buy Active
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                  <CardFooter>
                    {product.groupBuyActive ? (
                      <div className="flex flex-col gap-2 w-full">
                        <Button className="w-full bg-yellow-600 hover:bg-yellow-700" disabled={!product.inStock}>
                          Join Group Buy
                        </Button>
                        <Button
                          variant="outline"
                          className="w-full bg-transparent"
                          disabled={!product.inStock}
                          onClick={() => {
                            addToCart(product)
                            setIsCheckoutOpen(true)
                          }}
                        >
                          <ShoppingCart className="mr-2 h-4 w-4" />
                          Add to Cart
                        </Button>
                      </div>
                    ) : (
                      <Button
                        className="w-full bg-transparent"
                        disabled={!product.inStock}
                        variant="outline"
                        onClick={() => {
                          addToCart(product)
                          setIsCheckoutOpen(true)
                        }}
                      >
                        <ShoppingCart className="mr-2 h-4 w-4" />
                        Add to Cart
                      </Button>
                    )}
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
