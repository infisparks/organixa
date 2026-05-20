"use client"

import type React from "react"
import { useState, useEffect, useCallback } from "react"
import { Heart, Filter, Loader2, ArrowRight, Sparkles } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import AuthPopup from "@/components/auth-popup"
import { useRouter } from "next/navigation"
import { getPublicUrlFromPath } from "@/lib/image-utils"
import { motion } from "framer-motion"
import Header from "@/components/Header"
import Footer from "@/components/Footer"

// =========================================================================
//                             HELPER FUNCTIONS
// =========================================================================

function ProductSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-100 animate-pulse flex flex-col">
      <div className="aspect-square bg-slate-100" />
      <div className="p-2.5 sm:p-3 flex flex-col gap-2">
        <div className="h-3 bg-slate-200 rounded w-full" />
        <div className="h-3 bg-slate-200 rounded w-2/3" />
        <div className="h-4 bg-slate-200 rounded w-1/3 mt-1" />
      </div>
    </div>
  )
}

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

type CategoryProps = {
  categories: { id: number; title: string; subtitle: string; icon: string; image: string }[]
  selectedCategory: string | null
  onCategoryClick: (category: string) => void
}

// =========================================================================
//                             COMPONENTS
// =========================================================================

function CategoryCarousel({ categories, selectedCategory, onCategoryClick }: CategoryProps) {
  return (
    <section className="py-3 bg-gradient-to-b from-white to-slate-50/50">
      <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
        <div className="overflow-x-auto scrollbar-hide pb-2">
          <div className="flex gap-2 sm:gap-3 w-max">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => onCategoryClick(cat.title)}
                className={`flex-shrink-0 transition-all duration-300 ${selectedCategory === cat.title
                  ? "scale-[1.03] shadow-md"
                  : "hover:scale-[1.02]"
                  }`}
              >
                <div
                  className={`flex items-center gap-2 px-2.5 py-2 sm:gap-3 sm:px-3 sm:py-2.5 rounded-xl border-2 transition-all whitespace-nowrap ${selectedCategory === cat.title
                    ? "border-emerald-500 bg-emerald-50 shadow-emerald-100"
                    : "border-slate-100 bg-white hover:border-emerald-200"
                    }`}
                >
                  <div className={`text-lg sm:text-2xl flex-shrink-0 transition-transform duration-300 ${selectedCategory === cat.title ? "scale-110" : ""}`}>
                    {cat.icon}
                  </div>
                  <div className="text-left min-w-[70px] sm:min-w-[100px]">
                    <p className={`font-semibold text-xs sm:text-sm leading-tight ${selectedCategory === cat.title ? "text-emerald-700" : "text-slate-800"}`}>
                      {cat.title.split(" ")[0]}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5 hidden sm:block">
                      {cat.subtitle}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function FavButton({ product }: { product: Product }) {
  const [isFav, setIsFav] = useState(false)
  const [showAuthPopup, setShowAuthPopup] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [isAnimating, setIsAnimating] = useState(false)

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
    const { data: authListener } = supabase.auth.onAuthStateChange(() => checkUserAndFavStatus())
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
    setIsAnimating(true)
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
      setTimeout(() => setIsAnimating(false), 600)
    }
  }

  return (
    <>
      <button
        onClick={toggleFav}
        disabled={isLoading}
        className={`p-1.5 sm:p-2 rounded-full backdrop-blur-md transition-all duration-300 z-20 
          ${isLoading ? "opacity-50 cursor-not-allowed" : "opacity-100"}
          ${isFav ? "bg-red-50 text-red-500 shadow-sm" : "bg-white/80 text-slate-400 hover:text-slate-600 shadow-sm"}
        `}
        aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
      >
        <Heart className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform duration-300 ${isFav ? "fill-current" : ""} ${isAnimating ? "scale-125" : ""}`} />
      </button>
      <AuthPopup isOpen={showAuthPopup} onClose={() => setShowAuthPopup(false)} onSuccess={() => setShowAuthPopup(false)} />
    </>
  )
}

// =========================================================================
//                     UPDATED COMPACT PRODUCT CARD
// =========================================================================

function ProductCard({ product, index }: { product: Product, index: number }) {
  const discountPercent = product.original_price
    ? Math.round(((product.original_price - product.discount_price) / product.original_price) * 100)
    : 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-20px" }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.03, 0.3) }}
      className="group relative bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 border border-slate-100 flex flex-col overflow-hidden font-poppins h-full"
    >
      {/* FavButton placed absolutely to sit above the link without blocking it entirely */}
      <div className="absolute top-2 right-2 z-20">
        <FavButton product={product} />
      </div>

      {/* The entire card is wrapped in the Link */}
      <Link href={`/product/${product.id}`} className="flex flex-col h-full z-10">
        {/* Image Section - Compact Square Ratio */}
        <div className="relative aspect-square overflow-hidden bg-slate-50">
          <Image
            src={getPublicUrlFromPath(product.product_photo_urls?.[0])}
            alt={product.product_name}
            fill
            unoptimized
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            priority={index < 4}
          />
          {/* Badge */}
          {discountPercent > 0 && (
            <div className="absolute top-2 left-2 z-20">
              <span className="bg-slate-900 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm tracking-wide">
                -{discountPercent}%
              </span>
            </div>
          )}
        </div>

        {/* Minimal Content Section */}
        <div className="p-2.5 sm:p-3 flex flex-col flex-grow justify-between bg-white">
          <h3 className="font-medium text-slate-800 text-xs sm:text-sm leading-tight line-clamp-2 mb-1.5 group-hover:text-emerald-600 transition-colors">
            {product.product_name}
          </h3>

          <div className="flex items-baseline gap-1.5 mt-auto">
            <span className="text-sm font-semibold text-slate-900">
              ₹{product.discount_price.toFixed(2)}
            </span>
            {product.original_price && product.original_price > product.discount_price && (
              <span className="text-[10px] text-slate-400 line-through">
                ₹{product.original_price.toFixed(2)}
              </span>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

// =========================================================================
//                             MAIN HOME COMPONENT
// =========================================================================

export default function Home() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<"all" | "deals" | "bestsellers">("all")
  const [isCompanyApproved, setIsCompanyApproved] = useState<boolean | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")

  const carouselCategories = [
    { id: 1, title: "Organic Groceries and Superfoods", subtitle: "Fresh & Healthy", icon: "🥦", image: "" },
    { id: 2, title: "Herbal & Natural Personal Care", subtitle: "Pure & Gentle", icon: "🧴", image: "" },
    { id: 3, title: "Health & Wellness Products", subtitle: "Boost Wellbeing", icon: "🌿", image: "" },
    { id: 4, title: "Sustainable Home & Eco-Friendly Living", subtitle: "Green Living", icon: "♻️", image: "" },
    { id: 5, title: "Sustainable Fashion & Accessories", subtitle: "Eco-Chic Styles", icon: "👕", image: "" },
    { id: 8, title: "Special Dietary & Lifestyle Products", subtitle: "For Your Lifestyle", icon: "🥗", image: "" },
  ]

  useEffect(() => {
    const checkUserAndApproval = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setIsLoggedIn(true)
        const userId = session.user.id
        const { data: companyData, error: companyError } = await supabase
          .from("companies")
          .select("is_approved")
          .eq("user_id", userId)
          .maybeSingle()

        if (companyError && companyError.code !== "PGRST116") {
          setIsCompanyApproved(false)
        } else if (companyData) {
          setIsCompanyApproved(companyData.is_approved)
        } else {
          setIsCompanyApproved(false)
        }
      } else {
        setIsLoggedIn(false)
        setIsCompanyApproved(false)
      }
    }

    checkUserAndApproval()
    const { data: authListener } = supabase.auth.onAuthStateChange(() => checkUserAndApproval())
    return () => authListener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (isLoggedIn && isCompanyApproved) {
      router.push("/company/dashboard")
    }
  }, [isLoggedIn, isCompanyApproved, router])

  const fetchProducts = useCallback(async () => {
    setIsLoading(true)
    let query = supabase
      .from("products")
      .select(`*, company:companies(company_name, company_logo_url)`)
      .eq("is_approved", true)
      .order("created_at", { ascending: false })

    if (activeFilter === "bestsellers") query = query.eq("is_best_seller", true)
    if (searchTerm) query = query.ilike("product_name", `%${searchTerm}%`)

    const { data, error } = await query

    if (error) {
      setProducts([])
    } else {
      let filteredData = data as Product[]
      if (activeFilter === "deals") {
        filteredData = filteredData.filter(p => p.original_price && p.original_price > p.discount_price)
      }
      setProducts(filteredData)
    }
    setIsLoading(false)
  }, [activeFilter, searchTerm])

  useEffect(() => {
    fetchProducts()
    const productSubscription = supabase
      .channel("products_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "products", filter: "is_approved=eq.true" }, () => fetchProducts())
      .subscribe()

    return () => {
      productSubscription.unsubscribe()
    }
  }, [fetchProducts])

  const getFilteredProducts = useCallback(() => {
    let filtered = [...products]
    if (selectedCategory) {
      filtered = filtered.filter((p) => p.categories?.some((c) => c.main === selectedCategory))
    }
    return filtered
  }, [products, selectedCategory])

  const handleCategoryClick = useCallback((cat: string) => {
    setSelectedCategory((prevCat) => (prevCat === cat ? null : cat))
  }, [])

  const handleSearch = useCallback((term: string) => {
    setSearchTerm(term)
    setSelectedCategory(null)
  }, [])

  if (isCompanyApproved === null && isLoggedIn === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 font-poppins">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-white font-poppins selection:bg-emerald-100">
      <div className="bg-slate-900 text-center py-2 text-[10px] text-white uppercase tracking-widest font-semibold">
        <div className="flex items-center justify-center gap-2">
          <Sparkles className="w-3 h-3 text-emerald-400" />
          <span>FREE SHIPPING ON ORDERS OVER ₹1000</span>
          <Sparkles className="w-3 h-3 text-emerald-400" />
        </div>
      </div>

      <Header showSearchBar={true} onSearch={handleSearch} />

      <CategoryCarousel
        categories={carouselCategories}
        selectedCategory={selectedCategory}
        onCategoryClick={handleCategoryClick}
      />

      <section className="py-10 sm:py-16 bg-[#fafafa]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight">
              Fresh <span className="text-emerald-600">Picks</span>
            </h2>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-5">
            {isLoading
              ? Array(10).fill(0).map((_, i) => <ProductSkeleton key={i} />)
              : getFilteredProducts().length > 0
                ? getFilteredProducts().map((product, index) => <ProductCard key={product.id} product={product} index={index} />)
                : (
                  <div className="col-span-full py-20 text-center bg-white rounded-2xl border border-dashed border-slate-200">
                    <Filter className="w-10 h-10 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-slate-800 mb-1">Nothing found</h3>
                    <p className="text-xs text-slate-400 mb-6">Try adjusting your filters.</p>
                    <Button onClick={() => { setSelectedCategory(null); setProducts([]); fetchProducts(); }} variant="outline" className="text-xs">
                      Clear Filters
                    </Button>
                  </div>
                )}
          </div>

          {getFilteredProducts().length > 0 && (
            <div className="mt-10 text-center">
              <Button asChild variant="ghost" className="text-sm font-medium hover:bg-slate-100 rounded-lg group">
                <Link href="/shop" className="flex items-center gap-2">
                  View Full Catalog
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
            </div>
          )}
        </div>
      </section>

      <Footer />
    </main>
  )
}