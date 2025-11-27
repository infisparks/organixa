"use client"

import type React from "react"
import { useState, useEffect, useCallback } from "react"
import { Heart, Star, ShieldCheck, Filter, Loader2, ArrowRight, Sparkles, TrendingUp, Tag } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
// RESTORING EXTERNAL COMPONENT IMPORTS
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { supabase } from "@/lib/supabase"
import AuthPopup from "@/components/auth-popup"
import { useRouter } from "next/navigation"

// =========================================================================
//                             HELPER FUNCTIONS
// =========================================================================

// --- 1. Helper function for Product Image path resolution (product-media bucket) ---
/**
 * Helper function to reconstruct the public URL from the stored path.
 * The paths are stored in the 'product-media' bucket.
 * @param path The relative path stored in the database (e.g., 'images/123/file.jpg')
 * @returns The full public URL string.
 */
const getPublicUrlFromPath = (path: string | undefined): string => {
    if (!path) {
        return "/placeholder.svg"; // Default placeholder if path is missing
    }
    const { data } = supabase.storage
        .from("product-media")
        .getPublicUrl(path);

    return data.publicUrl || "/placeholder.svg";
};

// --- 2. Helper function for Company Logo path resolution (company-documents bucket) ---
/**
 * Helper function to reconstruct the public URL from the stored path (e.g., 'logos/123/...').
 * Targets the 'company-documents' bucket.
 * @param path The relative path stored in the database.
 * @returns The full public URL string.
 */
const getCompanyLogoUrlFromPath = (path: string | undefined): string => {
    if (!path) {
        return "/placeholder.svg"; // Default placeholder if path is missing
    }
    // TARGETS THE CORRECT BUCKET: company-documents
    const { data } = supabase.storage
        .from("company-documents") 
        .getPublicUrl(path);

    return data.publicUrl || "/placeholder.svg";
};

// --- 3. Product Skeleton (DEFINED ONLY ONCE) ---
function ProductSkeleton() {
  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100 animate-pulse">
      <div className="aspect-[3/4] sm:aspect-[3/4] bg-gray-200" />
      <div className="p-3 sm:p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-gray-200" />
          <div className="h-3 bg-gray-200 rounded w-20" />
        </div>
        <div className="h-4 bg-gray-200 rounded w-full mb-3" /> 
        <div className="flex gap-1 mb-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="w-3.5 h-3.5 bg-gray-200 rounded" />
          ))}
        </div>
        <div className="h-6 bg-gray-200 rounded w-24 mb-3" />
        <div className="h-8 bg-gray-200 rounded-lg mt-auto" />
      </div>
    </div>
  )
}

// =========================================================================
//                             TYPE DEFINITIONS
// =========================================================================

// Product type definition
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

// Category type definition
type CategoryProps = {
  categories: { id: number; title: string; subtitle: string; icon: string; image: string }[]
  selectedCategory: string | null
  onCategoryClick: (category: string) => void
}

// =========================================================================
//                             COMPONENTS
// =========================================================================

// Enhanced Category Carousel with better mobile UX (Scrollable)
function CategoryCarousel({ categories, selectedCategory, onCategoryClick }: CategoryProps) {
  return (
    <section className="py-4 bg-gradient-to-b from-white to-gray-50/50">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        {/* Scrollable Container */}
        <div className="overflow-x-auto scrollbar-hide -mx-3 px-3">
          <div className="flex gap-3 pb-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => onCategoryClick(cat.title)}
                className={`flex-shrink-0 transition-all duration-300 ${
                  selectedCategory === cat.title ? "scale-105" : "hover:scale-102"
                }`}
              >
                <div
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all whitespace-nowrap ${
                    selectedCategory === cat.title
                      ? "border-green-500 bg-green-50 shadow-lg shadow-green-100"
                      : "border-gray-200 bg-white hover:border-green-300 hover:shadow-md"
                  }`}
                >
                  <div className={`text-2xl sm:text-3xl flex-shrink-0 transition-transform duration-300 ${
                    selectedCategory === cat.title ? "scale-110" : ""
                  }`}>
                    {cat.icon}
                  </div>
                  <div className="text-left min-w-[120px] sm:min-w-[140px]">
                    <p className={`font-semibold text-sm sm:text-base leading-tight ${
                      selectedCategory === cat.title ? "text-green-700" : "text-gray-800"
                    }`}>
                      {cat.title.split(" ")[0]}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{cat.subtitle}</p>
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

// Updated FavButton component with authentication popup support
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
          .single()
        setIsFav(!!data)
      } else {
        setIsFav(false)
      }
      setIsLoading(false)
    }

    checkUserAndFavStatus()

    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      checkUserAndFavStatus() // Re-check fav status on auth change
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
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
        className={`absolute top-3 right-3 p-2.5 rounded-full backdrop-blur-sm transition-all duration-300 z-10 
          ${isLoading ? "opacity-50 cursor-not-allowed" : "opacity-100"}
          ${isFav
            ? "bg-red-500 hover:bg-red-600 shadow-lg scale-110"
            : "bg-white/90 hover:bg-white shadow-md hover:scale-110"
          }
        `}
        aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
      >
        <Heart
          className={`w-4 h-4 transition-all duration-300 ${
            isFav ? "text-white fill-current" : "text-gray-700"
          } ${isAnimating ? "scale-125" : ""}`}
        />
      </button>
      <AuthPopup
        isOpen={showAuthPopup}
        onClose={() => setShowAuthPopup(false)}
        onSuccess={() => setShowAuthPopup(false)}
      />
    </>
  )
}

// Professional Product Card with dynamic review fetching - UPDATED
function ProductCard({ product }: { product: Product }) {
  const [reviewData, setReviewData] = useState({ count: 0, average: 0 })

  useEffect(() => {
    const fetchReviews = async () => {
      // Assuming 'reviews' table exists and has 'product_id' and 'rating' columns
      const { data, error } = await supabase.from("reviews").select("rating").eq("product_id", product.id)

      if (error) {
        setReviewData({ count: 0, average: 0 })
        return
      }

      if (data && data.length > 0) {
        const count = data.length
        const sum = data.reduce((acc, review: { rating: number }) => acc + review.rating, 0)
        const average = count ? sum / count : 0
        setReviewData({ count, average: parseFloat(average.toFixed(1)) })
      } else {
        setReviewData({ count: 0, average: 0 })
      }
    }

    fetchReviews()

    // Real-time listener setup
    const reviewSubscription = supabase
      .channel(`reviews_for_product_${product.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reviews", filter: `product_id=eq.${product.id}` },
        () => fetchReviews(), // Re-fetch all on change
      )
      .subscribe()

    return () => {
      reviewSubscription.unsubscribe()
    }
  }, [product.id])

  const discountPercent = product.original_price
    ? Math.round(((product.original_price - product.discount_price) / product.original_price) * 100)
    : 0

  const stockStatus =
    product.stock_quantity === 0
      ? { label: "Out of Stock", color: "bg-gray-600", textColor: "text-gray-600" }
      : product.stock_quantity && product.stock_quantity < 10
        ? { label: "Only Few Left", color: "bg-orange-500", textColor: "text-orange-600" }
        : { label: "In Stock", color: "bg-green-500", textColor: "text-green-600" }

  return (
    <Link
      href={`/product/${product.id}`}
      className="group bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-500 overflow-hidden border border-gray-100 hover:border-green-200 flex flex-col h-full"
    >
      {/* Image Section - Compact Aspect Ratio */}
      <div className="relative aspect-[3/4] sm:aspect-[3/4] overflow-hidden bg-gray-50">
        <Image
          // Use the product image helper
          src={getPublicUrlFromPath(product.product_photo_urls?.[0])}
          alt={product.product_name}
          fill
          sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
          className="object-cover group-hover:scale-110 transition-transform duration-700"
          priority={false}
        />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-2">
          {discountPercent > 0 && (
            <div className="bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1">
              <Tag className="w-3 h-3" />
              {discountPercent}% OFF
            </div>
          )}
          {product.is_best_seller && (
            <div className="bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              Bestseller
            </div>
          )}
        </div>

        {/* Stock Badge */}
        {product.stock_quantity !== undefined && product.stock_quantity < 50 && (
          <div className={`absolute bottom-3 left-3 ${stockStatus.color} text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg`}>
            {stockStatus.label}
          </div>
        )}

        <FavButton product={product} />
      </div>

      {/* Content Section */}
      <div className="p-3 sm:p-4 flex-grow flex flex-col">
        {/* Company Info */}
        {product.company && (
          <div className="flex items-center gap-2 mb-2">
            <Image
              // Uses the company logo helper (targets 'company-documents')
              src={getCompanyLogoUrlFromPath(product.company.company_logo_url) || "/placeholder.svg"}
              alt={product.company.company_name || "Brand"}
              width={20}
              height={20}
              className="w-4 h-4 sm:w-5 sm:h-5 rounded-full object-cover border border-gray-200"
            />
            <span className="text-xs sm:text-sm text-gray-600 font-medium truncate">
              {product.company.company_name}
            </span>
          </div>
        )}

        {/* Product Name - Single Line, smaller font, truncated */}
        <h3 className="font-semibold text-gray-900 mb-2 text-sm sm:text-base whitespace-nowrap overflow-hidden text-ellipsis">
          {product.product_name}
        </h3>

        {/* Rating Section */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center gap-0.5">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${
                  i < Math.round(reviewData.average)
                    ? "fill-yellow-400 text-yellow-400"
                    : "fill-gray-200 text-gray-200"
                }`}
              />
            ))}
          </div>
          <span className="text-xs sm:text-sm text-gray-600 font-medium">
            {reviewData.average.toFixed(1)} ({reviewData.count})
          </span>
        </div>

        {/* Price Section */}
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-xl sm:text-2xl font-bold text-gray-900">
            ₹{product.discount_price.toFixed(2)}
          </span>
          {product.original_price && product.original_price > product.discount_price && (
            <span className="text-sm sm:text-base text-gray-400 line-through">
              ₹{product.original_price.toFixed(2)}
            </span>
          )}
        </div>

        {/* Organic Badge - pushed to bottom */}
        <div className="flex items-center gap-1.5 text-xs sm:text-sm text-green-700 bg-green-50 px-3 py-1.5 rounded-lg border border-green-200 mt-auto">
          <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
          <span className="font-medium">Certified Organic</span>
        </div>
        
        {/* NO "View Product" button */}
      </div>
    </Link>
  )
}


// Main Component (Home)
export default function Home() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<"all" | "deals" | "bestsellers">("all")
  const [isCompanyApproved, setIsCompanyApproved] = useState<boolean | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")

  // --- Category Definitions ---
  const carouselCategories = [
    { id: 1, title: "Organic Groceries and Superfoods", subtitle: "Fresh & Healthy", icon: "🥦", image: "" },
    { id: 2, title: "Herbal & Natural Personal Care", subtitle: "Pure & Gentle", icon: "🧴", image: "" },
    { id: 3, title: "Health & Wellness Products", subtitle: "Boost Wellbeing", icon: "🌿", image: "" },
    { id: 4, title: "Sustainable Home & Eco-Friendly Living", subtitle: "Green Living", icon: "♻️", image: "" },
    { id: 5, title: "Sustainable Fashion & Accessories", subtitle: "Eco-Chic Styles", icon: "👕", image: "" },
    { id: 8, title: "Special Dietary & Lifestyle Products", subtitle: "For Your Lifestyle", icon: "🥗", image: "" },
  ]

  // --- Auth and Redirection Logic ---
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
          .single()

        if (companyError && companyError.code !== "PGRST116") {
          console.error("Error fetching company data:", companyError)
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

    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      checkUserAndApproval()
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (isLoggedIn && isCompanyApproved) {
      router.push("/company/dashboard")
    }
  }, [isLoggedIn, isCompanyApproved, router])


  // --- Data Fetching Logic ---
  const fetchProducts = useCallback(async () => {
    setIsLoading(true)
    let query = supabase
      .from("products")
      .select(
        `
        *,
        company:companies(company_name, company_logo_url)
      `,
      )
      .eq("is_approved", true)
      .order("created_at", { ascending: false })

    if (activeFilter === "bestsellers") {
      query = query.eq("is_best_seller", true)
    }

    if (searchTerm) {
      query = query.ilike("product_name", `%${searchTerm}%`)
    }

    const { data, error } = await query

    if (error) {
      console.error("Error fetching products:", error)
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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products", filter: "is_approved=eq.true" },
        () => fetchProducts(),
      )
      .subscribe()

    return () => {
      productSubscription.unsubscribe()
    }
  }, [fetchProducts])

  // --- Client-side Filtering and Handlers ---
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

  const handleFilterClick = useCallback((filter: "all" | "deals" | "bestsellers") => {
    setActiveFilter(filter)
    setSelectedCategory(null)
  }, [])

  const handleSearch = useCallback((term: string) => {
    setSearchTerm(term)
    setSelectedCategory(null)
  }, [])

  // If loading initial user/company status, show a loader
  if (isCompanyApproved === null && isLoggedIn === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        <span className="ml-3 text-lg text-blue-700">Loading initial configuration...</span>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Announcement Bar */}
      <div className="bg-gradient-to-r from-green-600 to-green-500 text-center py-2.5 text-xs sm:text-sm text-white px-4">
        <div className="flex items-center justify-center gap-2">
          <Sparkles className="w-4 h-4" />
          <span className="font-medium">
            Free shipping on orders over ₹1000 | Use code: <span className="font-bold bg-white/20 px-2 py-0.5 rounded">ORGANIC10</span>
          </span>
        </div>
      </div>

      {/* RESTORED Header Component */}
      <Header 
        showSearchBar={true} 
        onSearch={handleSearch} 
      />

      <CategoryCarousel
        categories={carouselCategories}
        selectedCategory={selectedCategory}
        onCategoryClick={handleCategoryClick}
      />

      {/* Products Section */}
      <section className="py-6 sm:py-10">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 sm:mb-8 gap-4">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Explore Products</h2>
              <p className="text-sm sm:text-base text-gray-600 mt-1">Fresh organic products at the best prices</p>
            </div>

            {/* Filter Buttons */}
            <div className="flex items-center gap-2 bg-white p-1 rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
              {[
                { key: "all", label: "All" },
                { key: "deals", label: "Deals" },
                { key: "bestsellers", label: "Best Sellers" }
              ].map((filter) => (
                <button
                  key={filter.key}
                  onClick={() => handleFilterClick(filter.key as any)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                    activeFilter === filter.key
                      ? "bg-green-600 text-white shadow-md"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          {/* Active Filters */}
          {(selectedCategory || searchTerm || activeFilter !== 'all') && (
            <div className="flex items-center gap-2 mb-6 flex-wrap">
              {(selectedCategory || searchTerm) && <span className="text-sm font-semibold text-gray-700">Active Filters:</span>}
              
              {selectedCategory && (
                <span className="bg-green-100 text-green-800 px-3 py-1.5 rounded-lg text-sm font-medium border border-green-200">
                  Category: {selectedCategory.split(" ")[0]}
                </span>
              )}
              {searchTerm && (
                <span className="bg-blue-100 text-blue-800 px-3 py-1.5 rounded-lg text-sm font-medium border border-blue-200">
                  Search: "{searchTerm}"
                </span>
              )}
              {activeFilter !== 'all' && (
                <span className="bg-amber-100 text-amber-800 px-3 py-1.5 rounded-lg text-sm font-medium border border-amber-200">
                  Filter: {activeFilter === 'deals' ? "Today's Deals" : "Bestsellers"}
                </span>
              )}
              
              <button
                onClick={() => {
                  setSelectedCategory(null)
                  setSearchTerm("")
                  setActiveFilter("all")
                }}
                className="text-gray-500 hover:text-red-500 text-sm font-medium ml-2"
              >
                ✕ Clear All
              </button>
            </div>
          )}

          {/* Products Grid - 2 columns on mobile, responsive on larger screens */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
            {isLoading
              ? Array(8).fill(0).map((_, i) => <ProductSkeleton key={i} />)
              : getFilteredProducts().length > 0
              ? getFilteredProducts().map((product) => <ProductCard key={product.id} product={product} />)
              : (
                <div className="col-span-full py-12 text-center bg-white rounded-xl shadow-inner border border-dashed border-gray-300">
                  <div className="mx-auto w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <Filter className="w-10 h-10 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No products found</h3>
                  <p className="text-gray-500 mb-4">Try adjusting your filters, clearing your search, or viewing all products.</p>
                  <button
                    onClick={() => {
                      setSelectedCategory(null)
                      setActiveFilter("all")
                      setSearchTerm("")
                    }}
                    className="px-6 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors shadow-md"
                  >
                    Clear Filters
                  </button>
                </div>
              )}
          </div>

          {/* View All Button */}
          {getFilteredProducts().length > 0 && (
            <div className="mt-10 text-center">
              <Link href="/shop" passHref>
                <button className="px-8 py-3 border-2 border-green-600 text-green-600 rounded-xl font-semibold hover:bg-green-50 transition-all inline-flex items-center gap-2 group shadow-md hover:shadow-lg">
                  View All Products
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* RESTORED Footer Component */}
      <Footer />
    </main>
  )
}