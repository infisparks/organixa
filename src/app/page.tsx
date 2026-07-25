"use client"

import type React from "react"
import { useState, useEffect, useCallback } from "react"
import { Heart, Filter, Loader2, ArrowRight, Sparkles, Phone, Mail, CheckCircle2, ShieldCheck, Award, ChevronRight } from "lucide-react"
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

import ProductCard, { type Product } from "@/components/ProductCard"

// =========================================================================
//                             HELPER FUNCTIONS
// =========================================================================

function ProductSkeleton() {
  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-slate-100 animate-pulse flex flex-col h-full">
      <div className="aspect-square bg-slate-100 rounded-[16px]" />
      <div className="p-3 flex flex-col gap-2 flex-grow justify-between">
        <div className="flex flex-col gap-1.5">
          <div className="h-3.5 bg-slate-200 rounded w-full" />
          <div className="h-3.5 bg-slate-200 rounded w-2/3" />
          <div className="h-2.5 bg-slate-100 rounded w-1/2 mt-1" />
        </div>
        <div className="mt-3 flex flex-col gap-3">
          <div className="h-4 bg-slate-200 rounded w-1/3" />
          <div className="h-9 bg-slate-100 rounded-full w-full" />
        </div>
      </div>
    </div>
  )
}

// =========================================================================
//                             TYPE DEFINITIONS
// =========================================================================

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

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
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

      {/* 🌿 GrowGenics Distributor Opportunity Section */}
      <section className="py-16 sm:py-24 bg-gradient-to-b from-[#fafafa] to-slate-100 border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Header */}
          <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16 space-y-4">
            <span className="bg-emerald-100 text-emerald-800 px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600 animate-spin" /> GrowGenics Distributor Opportunity
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Powered by <span className="text-emerald-600">Organicza</span> – Gateway of Wellness
            </h2>
            <p className="text-base sm:text-lg text-slate-600 font-medium max-w-2xl mx-auto">
              💰 Earn More with a High-Demand Nutrition Brand!
            </p>
          </div>

          {/* Grid Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            
            {/* Left Side: Benefits (7 Cols) */}
            <div className="lg:col-span-7 space-y-6 flex flex-col justify-between">
              
              {/* What You Get Card */}
              <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-100 shadow-sm flex-grow">
                <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2 border-b pb-3">
                  <span className="text-emerald-600 bg-emerald-50 p-1.5 rounded-lg">🔥</span> What You Get:
                </h3>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { title: "Up to 40% Margin", desc: "Highly lucrative profit shares in the segment." },
                    { title: "High Repeat Demand Product", desc: "Customers love the results and repurchase monthly." },
                    { title: "Clean-Label Advantage", desc: "No chemicals, no added sugar - pure nutrition." },
                    { title: "Premium Brand Positioning", desc: "Elegant aesthetics and top-tier packaging." },
                    { title: "Fast Growing Health Segment", desc: "Tap into the booming daily wellness market." }
                  ].map((item, idx) => (
                    <li key={idx} className="flex gap-3 items-start">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-slate-800 text-xs sm:text-sm">{item.title}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{item.desc}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Why GrowGenics Card */}
              <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-100 shadow-sm flex-grow mt-6">
                <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2 border-b pb-3">
                  <span className="text-emerald-600 bg-emerald-50 p-1.5 rounded-lg">🌾</span> Why GrowGenics?
                </h3>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { title: "Rich Nutrition Profile", desc: "Packed with Protein, Fiber, Calcium, Iron & Multivitamins." },
                    { title: "Functional Health Benefits", desc: "Supports natural energy, immunity & healthy growth." },
                    { title: "Family-Friendly daily nutrition", desc: "Suitable for adults, seniors, and active kids alike." },
                    { title: "Trusted Clean-Label Product", desc: "Pure formulation transparency you can proudly recommend." }
                  ].map((item, idx) => (
                    <li key={idx} className="flex gap-3 items-start">
                      <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-slate-800 text-xs sm:text-sm">{item.title}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{item.desc}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

            </div>

            {/* Right Side: Who Can Apply & Contact (5 Cols) */}
            <div className="lg:col-span-5 space-y-6 flex flex-col justify-between">
              
              {/* Who Can Apply & Limited Area */}
              <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-100 shadow-sm space-y-6 flex-grow">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 border-b pb-3">
                  <span className="text-emerald-600 bg-emerald-50 p-1.5 rounded-lg">📈</span> Who Can Apply?
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    "FMCG Distributors",
                    "Medical & General Store Owners",
                    "Health Product Sellers",
                    "Entrepreneurs"
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 text-xs text-slate-700 font-semibold bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <ChevronRight className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
                
                <div className="bg-amber-50/80 border border-amber-200/50 p-4 rounded-xl space-y-1.5">
                  <p className="text-xs text-amber-800 font-bold flex items-center gap-1">
                    ⚡ Limited Area Distribution Available
                  </p>
                  <p className="text-[11px] text-amber-700 leading-relaxed">
                    👉 Secure your area before others! Exclusivity rights are granted on a first-come, first-served basis.
                  </p>
                </div>
              </div>

              {/* Contact Now Card */}
              <div className="bg-slate-900 text-white p-6 sm:p-8 rounded-2xl shadow-md space-y-5">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Phone className="w-5 h-5 text-emerald-400" /> Contact Now
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <a href="tel:7020977280" className="flex items-center gap-3 hover:text-emerald-400 transition-colors group">
                    <div className="bg-slate-800 p-2.5 rounded-xl border border-slate-700 group-hover:scale-105 transition-transform">
                      <Phone className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Call / WhatsApp</p>
                      <p className="text-sm font-bold">+91 70209 77280</p>
                    </div>
                  </a>
                  
                  <a href="mailto:organicza2025@gmail.com" className="flex items-center gap-3 hover:text-emerald-400 transition-colors group">
                    <div className="bg-slate-800 p-2.5 rounded-xl border border-slate-700 group-hover:scale-105 transition-transform">
                      <Mail className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Email</p>
                      <p className="text-sm font-bold truncate max-w-[160px] sm:max-w-none">organicza2025@gmail.com</p>
                    </div>
                  </a>
                </div>
              </div>

              {/* Formula Highlight */}
              <div className="bg-gradient-to-r from-emerald-600 to-emerald-800 text-white p-5 rounded-2xl text-center shadow-md relative overflow-hidden">
                <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-4 translate-y-4">
                  <Sparkles className="w-20 h-20" />
                </div>
                <p className="text-[10px] font-bold text-emerald-100 uppercase tracking-widest mb-0.5">🔥 Closing Formula</p>
                <p className="text-lg sm:text-xl font-extrabold italic tracking-tight">
                  “High Margin + High Demand = High Profit”
                </p>
              </div>

            </div>

          </div>

        </div>
      </section>

      <Footer />
    </main>
  )
}