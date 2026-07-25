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
import ProductCard, { type Product } from "@/components/ProductCard"
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"

// =========================================================================
//                             COMPONENTS
// =========================================================================

function ProductSkeleton() {
  return (
    <div className="bg-white rounded-2xl h-full overflow-hidden border border-slate-100 flex flex-col p-0 animate-pulse">
      <Skeleton className="aspect-square w-full rounded-[16px] bg-slate-100" />
      <div className="p-3 flex flex-col gap-2 flex-grow justify-between">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-3.5 w-full bg-slate-200" />
          <Skeleton className="h-3.5 w-2/3 bg-slate-200" />
          <Skeleton className="h-2.5 w-1/2 bg-slate-100 mt-1" />
        </div>
        <div className="mt-auto pt-2 flex flex-col gap-2.5">
          <Skeleton className="h-4 w-1/3 bg-slate-200" />
          <Skeleton className="h-9 w-full rounded-full bg-slate-100" />
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
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                {Array(12).fill(0).map((_, i) => <ProductSkeleton key={i} />)}
              </div>
            ) : filteredProducts.length > 0 ? (
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6"
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