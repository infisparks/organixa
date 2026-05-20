"use client"

import type React from "react"
import { useState, useEffect, useCallback } from "react"
import { Heart, Search, SlidersHorizontal } from "lucide-react"
import Link from "next/link"
import { motion, Variants } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import Footer from "@/components/Footer"
import Header from "@/components/Header"
import { supabase } from "@/lib/supabase"
import AuthPopup from "@/components/auth-popup"
import { getPublicUrlFromPath } from "@/lib/image-utils"
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"

// =========================================================================
//                             TYPE DEFINITIONS
// =========================================================================

type Product = {
  id: string
  product_name: string
  product_photo_urls?: string[]
  original_price?: number
  discount_price: number
  categories?: Array<{ main: string; sub: string }>
  company: {
    company_name: string
    company_logo_url: string
  } | null
  is_featured?: boolean
  is_best_seller?: boolean
  is_approved?: boolean
  stock_quantity?: number
}

// =========================================================================
//                             COMPONENTS
// =========================================================================

function FavButton({ product }: { product: Product }) {
  const [isFav, setIsFav] = useState(false)
  const [showAuthPopup, setShowAuthPopup] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const checkUserAndFavStatus = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const currentUserId = session?.user?.id || null
      setUserId(currentUserId)

      if (currentUserId) {
        const { data } = await supabase
          .from("favorites")
          .select("id")
          .eq("user_id", currentUserId)
          .eq("product_id", product.id)
          .maybeSingle()
        setIsFav(!!data)
      } else {
        setIsFav(false)
      }
      setIsLoading(false)
    }

    checkUserAndFavStatus()
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id || null)
      checkUserAndFavStatus()
    })
    return () => authListener.subscription.unsubscribe()
  }, [product.id])

  const toggleFav = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    e.preventDefault()
    if (!userId) {
      setShowAuthPopup(true)
      return
    }

    setIsLoading(true)
    try {
      if (isFav) {
        await supabase.from("favorites").delete().eq("user_id", userId).eq("product_id", product.id)
        setIsFav(false)
      } else {
        await supabase.from("favorites").insert({ user_id: userId, product_id: product.id })
        setIsFav(true)
      }
    } catch (error) {
      console.error("Error toggling favorite:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={toggleFav}
        disabled={isLoading}
        className={`absolute top-2 right-2 p-1.5 sm:p-2 rounded-full backdrop-blur-md transition-all duration-300 z-20 
          ${isLoading ? "opacity-50" : "opacity-100"} 
          ${isFav ? "bg-red-50 text-red-500 shadow-sm" : "bg-white/80 text-slate-400 hover:text-slate-900 shadow-sm"}`}
        aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
      >
        <Heart className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform ${isFav ? "fill-current scale-110" : "scale-100"}`} />
      </button>
      <AuthPopup isOpen={showAuthPopup} onClose={() => setShowAuthPopup(false)} onSuccess={() => setShowAuthPopup(false)} />
    </>
  )
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.25, 0, 1] } }
}

function ProductCard({ product }: { product: Product }) {
  const discountPercent = product.original_price && product.original_price > product.discount_price
    ? Math.round(((product.original_price - product.discount_price) / product.original_price) * 100)
    : 0

  return (
    <motion.div variants={itemVariants} className="h-full">
      <Link 
        href={`/product/${product.id}`} 
        className="group relative flex flex-col h-full bg-white rounded-2xl overflow-hidden border border-slate-100 hover:border-slate-200 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300"
      >
        {/* Minimal Image Container */}
        <div className="relative aspect-square overflow-hidden bg-slate-50">
          <img
            src={getPublicUrlFromPath(product.product_photo_urls?.[0]) || "/placeholder.svg"}
            alt={product.product_name}
            className="object-cover w-full h-full transition-transform duration-700 group-hover:scale-105"
          />
          
          {/* Discount Badge */}
          {discountPercent > 0 && (
            <div className="absolute top-2 left-2 z-10">
              <span className="bg-slate-900/90 backdrop-blur-sm text-white text-[10px] font-semibold px-2 py-0.5 rounded shadow-sm tracking-wide">
                -{discountPercent}%
              </span>
            </div>
          )}
          <FavButton product={product} />
        </div>

        {/* Clean Content Area */}
        <div className="p-3 flex flex-col flex-grow justify-between">
          <h3 className="font-medium text-slate-800 text-xs sm:text-sm leading-tight line-clamp-2 mb-2 group-hover:text-emerald-600 transition-colors">
            {product.product_name}
          </h3>

          <div className="flex items-baseline gap-1.5 mt-auto">
            <span className="text-sm sm:text-base font-semibold text-slate-900 tracking-tight">
              ₹{product.discount_price.toFixed(2)}
            </span>
            {discountPercent > 0 && (
              <span className="text-[10px] sm:text-xs text-slate-400 line-through">
                ₹{product.original_price?.toFixed(2)}
              </span>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

function ProductSkeleton() {
  return (
    <div className="bg-white rounded-2xl h-full overflow-hidden border border-slate-100 flex flex-col">
      <Skeleton className="aspect-square w-full rounded-none bg-slate-100" />
      <div className="p-3 flex flex-col gap-2 flex-grow">
        <Skeleton className="h-3.5 w-full bg-slate-100" />
        <Skeleton className="h-3.5 w-2/3 bg-slate-100" />
        <div className="mt-auto pt-2">
          <Skeleton className="h-4 w-1/3 bg-slate-100" />
        </div>
      </div>
    </div>
  )
}

// =========================================================================
//                             MAIN SHOP COMPONENT
// =========================================================================

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } }
}

export default function ShopPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [activeFilter, setActiveFilter] = useState<"all" | "deals" | "bestsellers">("all")
  const [isFilterOpen, setIsFilterOpen] = useState(false)

  const allCategories = [
    "Organic Groceries & Superfoods",
    "Herbal & Natural Personal Care",
    "Health & Wellness Products",
    "Sustainable Home & Eco-Friendly Living",
    "Sustainable Fashion & Accessories",
    "Organic Baby & Kids Care",
    "Organic Pet Care",
    "Special Dietary & Lifestyle Products",
  ]

  useEffect(() => {
    setIsLoading(true)
    const fetchProducts = async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, company:companies(company_name, company_logo_url)")
        .eq("is_approved", true)
        .order("created_at", { ascending: false })

      if (!error) setProducts(data || [])
      setIsLoading(false)
    }
    fetchProducts()
  }, [])

  const handleCategoryChange = (category: string, checked: boolean) => {
    setSelectedCategories((prev) => (checked ? [...prev, category] : prev.filter((cat) => cat !== category)))
  }

  const filteredProducts = products.filter((product) => {
    let match = true
    if (selectedCategories.length > 0) {
      match = match && !!product.categories?.some((cat) => selectedCategories.includes(cat.main))
    }
    if (activeFilter === "deals") {
      match = match && !!(product.original_price && product.original_price > product.discount_price)
    } else if (activeFilter === "bestsellers") {
      match = match && !!product.is_best_seller
    }
    if (searchTerm) {
      match = match && product.product_name.toLowerCase().includes(searchTerm.toLowerCase())
    }
    return match
  })

  return (
    <main className="min-h-screen bg-[#fafafa] flex flex-col font-poppins relative pb-24 lg:pb-0 selection:bg-slate-200">
      <Header showSearchBar={true} onSearch={setSearchTerm} />

      {/* Minimal Header */}
      <div className="bg-white border-b border-slate-100 pt-8 pb-6 sm:pt-12 sm:pb-10 text-center px-4">
        <h1 className="text-3xl sm:text-4xl font-semibold text-slate-900 tracking-tight mb-2">The Collection</h1>
        <p className="text-slate-500 text-xs sm:text-sm font-medium max-w-md mx-auto">
          Explore our complete range of certified essentials curated for a mindful lifestyle.
        </p>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-10">

          {/* Desktop Sidebar Filters */}
          <aside className="hidden lg:block w-60 flex-shrink-0">
            <div className="sticky top-24 space-y-8">
              <div>
                <h3 className="text-[10px] font-bold text-slate-400 tracking-widest uppercase mb-4">Quick Links</h3>
                <div className="space-y-1">
                  {["all", "deals", "bestsellers"].map((f) => (
                    <button
                      key={f}
                      onClick={() => setActiveFilter(f as any)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all ${activeFilter === f
                        ? "bg-slate-900 text-white font-medium"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                        }`}
                    >
                      {f === "all" ? "All Products" : f === "deals" ? "Today's Deals" : "Best Sellers"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-[10px] font-bold text-slate-400 tracking-widest uppercase mb-4">Categories</h3>
                <div className="space-y-3">
                  {allCategories.map((category) => (
                    <div key={category} className="flex items-start group cursor-pointer">
                      <Checkbox
                        id={`desktop-${category}`}
                        checked={selectedCategories.includes(category)}
                        onCheckedChange={(checked) => handleCategoryChange(category, checked === true)}
                        className="w-4 h-4 mt-0.5 border-slate-300 rounded shadow-sm data-[state=checked]:bg-slate-900 data-[state=checked]:border-slate-900 transition-all"
                      />
                      <Label htmlFor={`desktop-${category}`} className="ml-3 text-xs text-slate-600 leading-tight cursor-pointer group-hover:text-slate-900 transition-colors">
                        {category}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {(selectedCategories.length > 0 || activeFilter !== "all" || searchTerm) && (
                <Button
                  onClick={() => { setSelectedCategories([]); setActiveFilter("all"); setSearchTerm("") }}
                  variant="ghost"
                  className="w-full text-xs font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 h-9 rounded-lg"
                >
                  Clear Filters
                </Button>
              )}
            </div>
          </aside>

          {/* Product Feed */}
          <div className="flex-grow">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4 hidden lg:flex">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  {activeFilter === "deals" ? "Exclusive Deals" : activeFilter === "bestsellers" ? "Most Loved" : "All Products"}
                </h2>
                <p className="text-xs text-slate-500 mt-1">{filteredProducts.length} items</p>
              </div>

              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Sort by</span>
                <select className="bg-transparent text-xs font-medium text-slate-800 focus:outline-none cursor-pointer">
                  <option>Latest Arrivals</option>
                  <option>Price: Low to High</option>
                  <option>Price: High to Low</option>
                </select>
              </div>
            </div>

            {/* Premium Dense Grid */}
            {isLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                {Array(15).fill(0).map((_, i) => <ProductSkeleton key={i} />)}
              </div>
            ) : filteredProducts.length > 0 ? (
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4"
              >
                {filteredProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </motion.div>
            ) : (
              <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-dashed border-slate-200 text-center px-4">
                <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                  <Search className="w-5 h-5 text-slate-300" />
                </div>
                <h3 className="text-lg font-medium text-slate-900 mb-1">No products found</h3>
                <p className="text-xs text-slate-500 mb-6">Try adjusting your search or filters.</p>
                <Button
                  variant="outline"
                  className="rounded-lg text-xs"
                  onClick={() => { setSelectedCategories([]); setActiveFilter("all"); setSearchTerm("") }}
                >
                  Clear all filters
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <Footer />

      {/* MOBILE FLOATING FILTER PILL */}
      <div className="lg:hidden fixed bottom-6 left-0 right-0 flex justify-center z-50 px-4 pointer-events-none">
        <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
          <SheetTrigger asChild>
            <button className="pointer-events-auto bg-slate-900/95 backdrop-blur-md text-white px-5 py-3 rounded-full shadow-xl shadow-slate-900/20 flex items-center gap-2 hover:scale-105 active:scale-95 transition-transform border border-slate-800">
              <SlidersHorizontal className="w-4 h-4" />
              <span className="font-medium text-xs tracking-wide">Filters & Sort</span>
              {(selectedCategories.length > 0 || activeFilter !== "all") && (
                <span className="ml-1 bg-white text-slate-900 text-[10px] w-4 h-4 flex items-center justify-center rounded-full font-bold">
                  {(selectedCategories.length > 0 ? 1 : 0) + (activeFilter !== "all" ? 1 : 0)}
                </span>
              )}
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[80vh] rounded-t-3xl p-6 overflow-y-auto bg-white border-none shadow-2xl">
            <SheetHeader className="mb-6 text-left">
              <SheetTitle className="text-xl font-semibold text-slate-900">Filters</SheetTitle>
              <SheetDescription className="text-xs text-slate-500">Refine your search results.</SheetDescription>
            </SheetHeader>
            
            <div className="space-y-8 pb-20">
              <div>
                <h3 className="text-[10px] font-bold text-slate-400 tracking-widest uppercase mb-3">Quick Filters</h3>
                <div className="flex flex-wrap gap-2">
                  {["all", "deals", "bestsellers"].map((f) => (
                    <button
                      key={f}
                      onClick={() => setActiveFilter(f as any)}
                      className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${activeFilter === f ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
                        }`}
                    >
                      {f === "all" ? "All Products" : f === "deals" ? "Deals" : "Best Sellers"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-[10px] font-bold text-slate-400 tracking-widest uppercase mb-3">Categories</h3>
                <div className="space-y-1">
                  {allCategories.map((category) => (
                    <div key={category} className="flex items-center justify-between py-2.5 border-b border-slate-50">
                      <Label htmlFor={`mobile-${category}`} className="text-xs font-medium text-slate-700 cursor-pointer flex-grow">
                        {category}
                      </Label>
                      <Checkbox
                        id={`mobile-${category}`}
                        checked={selectedCategories.includes(category)}
                        onCheckedChange={(checked) => handleCategoryChange(category, checked === true)}
                        className="w-5 h-5 rounded border-slate-300 data-[state=checked]:bg-slate-900 data-[state=checked]:border-slate-900"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Mobile Action Bar */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-md border-t border-slate-100 flex gap-3">
              <Button
                variant="outline"
                className="flex-1 rounded-xl h-11 text-xs font-medium text-slate-600"
                onClick={() => { setSelectedCategories([]); setActiveFilter("all"); }}
              >
                Clear
              </Button>
              <Button
                className="flex-[2] rounded-xl h-11 text-xs font-medium bg-slate-900 text-white"
                onClick={() => setIsFilterOpen(false)}
              >
                Show {filteredProducts.length} Results
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </main>
  )
}