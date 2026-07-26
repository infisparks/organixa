"use client"

import React, { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { Heart, Loader2, Check } from "lucide-react"
import { motion } from "framer-motion"
import { supabase } from "@/lib/supabase"
import { getPublicUrlFromPath } from "@/lib/image-utils"
import AuthPopup from "@/components/auth-popup"
import { useToast } from "@/hooks/use-toast"

export type Product = {
  id: string
  product_name: string
  product_photo_urls?: string[]
  original_price?: number
  discount_price: number
  categories?: any
  company?: {
    company_name: string
    company_logo_url: string
  } | null
  is_featured?: boolean
  is_best_seller?: boolean
  is_approved?: boolean
  stock_quantity?: number
}

interface ProductCardProps {
  product: Product
  index?: number
  onFavToggle?: () => void
}

export default function ProductCard({ product, index = 0, onFavToggle }: ProductCardProps) {
  const { toast } = useToast()
  const [isFav, setIsFav] = useState(false)
  const [showAuthPopup, setShowAuthPopup] = useState(false)
  const [favLoading, setFavLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  
  const [isAddingToCart, setIsAddingToCart] = useState(false)
  const [isInCart, setIsInCart] = useState(false)

  // Calculate discount percentage
  const discountPercent = product.original_price && product.original_price > product.discount_price
    ? Math.round(((product.original_price - product.discount_price) / product.original_price) * 100)
    : 0

  // Extract category display string
  const categoryName = React.useMemo(() => {
    if (!product.categories) return "Natural Food & Nutrition"
    if (Array.isArray(product.categories) && product.categories.length > 0) {
      const first = product.categories[0]
      if (typeof first === "string") return first
      if (first?.main) return first.main
    }
    if (typeof product.categories === "string") return product.categories
    return "Natural Food & Nutrition"
  }, [product.categories])

  useEffect(() => {
    let isMounted = true
    const checkStatus = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const currentUserId = session?.user?.id || null
      if (!isMounted) return
      setUserId(currentUserId)

      if (currentUserId) {
        // Check wishlist
        const { data: favData } = await supabase
          .from("favorites")
          .select("id")
          .eq("user_id", currentUserId)
          .eq("product_id", product.id)
          .maybeSingle()
        if (isMounted) setIsFav(!!favData)

        // Check cart
        const { data: cartData } = await supabase
          .from("cart_items")
          .select("id")
          .eq("user_id", currentUserId)
          .eq("product_id", product.id)
          .maybeSingle()
        if (isMounted) setIsInCart(!!cartData)
      } else {
        if (isMounted) {
          setIsFav(false)
          setIsInCart(false)
        }
      }
      if (isMounted) setFavLoading(false)
    }

    checkStatus()
    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      if (isMounted) checkStatus()
    })
    return () => {
      isMounted = false
      authListener.subscription.unsubscribe()
    }
  }, [product.id])

  const toggleFav = async (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()

    if (!userId) {
      setShowAuthPopup(true)
      return
    }

    setFavLoading(true)
    try {
      if (isFav) {
        await supabase.from("favorites").delete().eq("user_id", userId).eq("product_id", product.id)
        setIsFav(false)
        toast({ title: "Removed from wishlist" })
      } else {
        await supabase.from("favorites").insert({ user_id: userId, product_id: product.id })
        setIsFav(true)
        toast({ title: "Added to wishlist" })
      }
      if (onFavToggle) onFavToggle()
    } catch (error: any) {
      console.error("Error toggling favorite:", error)
    } finally {
      setFavLoading(false)
    }
  }

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()

    if (!userId) {
      setShowAuthPopup(true)
      return
    }

    if (isInCart) {
      toast({ title: "Already in cart", description: "This product is already in your cart!" })
      return
    }

    setIsAddingToCart(true)
    try {
      const { error } = await supabase.from("cart_items").insert({
        user_id: userId,
        product_id: product.id,
        quantity: 1,
        price_at_add: product.discount_price,
      })
      if (error) throw error
      setIsInCart(true)
      toast({ title: "Added to cart!", description: `${product.product_name} added to cart.` })
    } catch (error: any) {
      toast({ title: "Error adding to cart", description: error.message, variant: "destructive" })
    } finally {
      setIsAddingToCart(false)
    }
  }

  const hasOptions = (product.stock_quantity !== undefined && product.stock_quantity <= 0)

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-10px" }}
        transition={{ duration: 0.35, delay: Math.min(index * 0.04, 0.3) }}
        className="group relative flex flex-col h-full bg-white rounded-2xl transition-all duration-300 hover:shadow-md overflow-hidden font-sans border border-slate-100/80"
      >
        {/* Top Image Container */}
        <div className="relative aspect-square w-full overflow-hidden rounded-[16px] sm:rounded-[18px] bg-[#f7f6f2] sm:bg-[#f5f4f0]">
          <Link href={`/product/${product.id}`} className="block w-full h-full">
            <img
              src={getPublicUrlFromPath(product.product_photo_urls?.[0]) || "/placeholder.svg"}
              alt={product.product_name}
              className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-105"
            />
          </Link>

          {/* Top-Left Orange/Golden Discount Badge */}
          {discountPercent > 0 && (
            <div className="absolute top-2.5 left-2.5 z-10 pointer-events-none">
              <span className="inline-block bg-[#c26510] text-white text-[10px] sm:text-[11px] font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-xs">
                {discountPercent}% OFF
              </span>
            </div>
          )}

          {/* Top-Right Favorite / Wishlist Button */}
          <button
            onClick={toggleFav}
            disabled={favLoading}
            className={`absolute top-2.5 right-2.5 p-1.5 sm:p-2 rounded-full backdrop-blur-md transition-all duration-300 z-20 shadow-xs 
              ${favLoading ? "opacity-50 cursor-not-allowed" : "opacity-100 cursor-pointer"}
              ${isFav ? "bg-red-50 text-red-500 shadow-xs" : "bg-white/80 text-slate-400 hover:text-slate-700 hover:bg-white"}`}
            aria-label={isFav ? "Remove from wishlist" : "Add to wishlist"}
          >
            <Heart className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform ${isFav ? "fill-current scale-110" : "scale-100"}`} />
          </button>
        </div>

        {/* Content Section below image */}
        <div className="pt-3 pb-1 px-1 flex flex-col flex-grow justify-between bg-white">
          <div>
            {/* Product Title */}
            <Link href={`/product/${product.id}`} className="block group-hover:text-[#c26510] transition-colors">
              <h3 className="font-semibold text-slate-800 text-xs sm:text-[14px] leading-snug line-clamp-2 mb-1">
                {product.product_name}
              </h3>
            </Link>

            {/* Category Subtitle */}
            <p className="text-[11px] sm:text-xs text-slate-400 font-normal mb-2 truncate">
              {categoryName}
            </p>
          </div>

          <div>
            {/* Price Row */}
            <div className="flex items-center gap-2 mb-3">
              {product.original_price && product.original_price > product.discount_price && (
                <span className="text-xs sm:text-sm text-slate-400 line-through font-normal">
                  ₹{product.original_price.toFixed(2)}
                </span>
              )}
              <span className={`text-sm sm:text-base font-semibold ${
                discountPercent > 0 ? "text-[#0e7e52]" : "text-[#c26510]"
              }`}>
                ₹{product.discount_price.toFixed(2)}
              </span>
            </div>

            {/* Action Button: Add to cart / Select options */}
            {hasOptions ? (
              <Link
                href={`/product/${product.id}`}
                className="w-full py-2 sm:py-2.5 px-4 rounded-full border border-[#c57e36] text-[#c57e36] hover:bg-[#c57e36] hover:text-white transition-all duration-200 text-xs sm:text-sm font-medium text-center flex items-center justify-center gap-1.5"
              >
                Select options
              </Link>
            ) : (
              <button
                onClick={handleAddToCart}
                disabled={isAddingToCart}
                className={`w-full py-2 sm:py-2.5 px-4 rounded-full border border-[#c57e36] text-[#c57e36] hover:bg-[#c57e36] hover:text-white transition-all duration-200 text-xs sm:text-sm font-medium text-center flex items-center justify-center gap-1.5 cursor-pointer ${
                  isInCart ? "bg-[#c57e36]/10 text-[#c57e36]" : ""
                }`}
              >
                {isAddingToCart ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : isInCart ? (
                  <>
                    <Check className="w-3.5 h-3.5" /> Added
                  </>
                ) : (
                  "Add to cart"
                )}
              </button>
            )}
          </div>
        </div>
      </motion.div>

      <AuthPopup isOpen={showAuthPopup} onClose={() => setShowAuthPopup(false)} onSuccess={() => setShowAuthPopup(false)} />
    </>
  )
}
