"use client"

import type React from "react"
import { Video } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import {
  Minus,
  Plus,
  Heart,
  ShieldCheck,
  Truck,
  Clock,
  Star,
  MessageSquare,
  Share2,
  ChevronRight,
  X,
  Check,
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import AuthPopup from "@/components/auth-popup"
import CheckoutDetailsModal from "@/components/checkout-details-modal"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

// =========================================================================
//                              HELPER FUNCTIONS
// =========================================================================

const getPublicUrlFromPath = (path: string | undefined): string => {
  if (!path) return "/placeholder.svg";
  const decodedPath = decodeURIComponent(path); 
  const { data } = supabase.storage
    .from("product-media") 
    .getPublicUrl(decodedPath);
  return data.publicUrl || "/placeholder.svg";
};

const getCompanyLogoUrlFromPath = (path: string | undefined): string => {
  if (!path) return "/placeholder.svg";
  const decodedPath = decodeURIComponent(path);
  const { data } = supabase.storage
    .from("company-documents")
    .getPublicUrl(decodedPath);
  return data.publicUrl || "/placeholder.svg";
};

// =========================================================================
//                              COMPONENT START
// =========================================================================

type ProductDetailsProps = {
  product: {
    id: string
    productName: string
    productDescription: string
    originalPrice: number
    discountPrice?: number
    productPhotoUrls?: string[]
    productVideoUrl?: string
    company: {
      name: string
      logo: string
    }
    nutrients?: {
      name: string
      value: string
    }[]
  }
}

// Updated Address Interface to match the new Modal structure
type Address = {
  id: string
  name: string
  addressLine1: string 
  addressLine2?: string
  addressLine3?: string
  city: string
  state: string
  pincode: string
  country: string
  primaryPhone: string
  isDefault: boolean
  lat?: number
  lng?: number
  // fallback for old data structure support
  houseNumber?: string
  street?: string
  area?: string
}

export default function ProductDetails({ product }: ProductDetailsProps) {
  const { toast } = useToast()
  const router = useRouter()
  
  const [quantity, setQuantity] = useState(1)
  const [showAuthPopup, setShowAuthPopup] = useState(false)
  const [isFavorite, setIsFavorite] = useState(false)
  const [inCart, setInCart] = useState(false)
  const [showCheckoutModal, setShowCheckoutModal] = useState(false)
  const [activeTab, setActiveTab] = useState<"description" | "reviews">("description")
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewText, setReviewText] = useState("")
  const [hasReviewed, setHasReviewed] = useState(false)
  const [reviews, setReviews] = useState<{ user_id: string; rating: number; comment: string; created_at: string }[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  
  // Delivery States
  const [userPincode, setUserPincode] = useState<string | null>(null)
  const [isDeliverable, setIsDeliverable] = useState<boolean | null>(null)
  const [isCheckingDelivery, setIsCheckingDelivery] = useState(false)
  
  const displayPrice = product.discountPrice ?? product.originalPrice
  
  // Image Logic
  const images = product.productPhotoUrls ?? []
  const resolvedImages = images.map(getPublicUrlFromPath).filter(url => url !== "/placeholder.svg");
  const [selectedImage, setSelectedImage] = useState(resolvedImages?.[0] ?? "/placeholder.svg")

  // --- MAIN USER DATA FETCH ---
  useEffect(() => {
    const fetchUserData = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const userId = session?.user?.id || null
      setCurrentUserId(userId)

      if (userId) {
        // 1. Check cart
        const { data: cartData } = await supabase
          .from("cart_items")
          .select("id, quantity")
          .eq("user_id", userId)
          .eq("product_id", product.id)
          .single()
          
        setInCart(!!cartData)
        if (cartData) setQuantity(cartData.quantity)
        else setQuantity(1)

        // 2. Check favorite
        const { data: favData } = await supabase
          .from("favorites")
          .select("id")
          .eq("user_id", userId)
          .eq("product_id", product.id)
          .single()
        setIsFavorite(!!favData)

        // 3. Check review
        const { data: reviewData } = await supabase
          .from("reviews")
          .select("id")
          .eq("user_id", userId)
          .eq("product_id", product.id)
          .single()
        setHasReviewed(!!reviewData)
        
        // 4. Fetch Pincode locally just for display purposes
        const { data: profileData } = await supabase
          .from('user_profiles')
          .select('addresses')
          .eq('id', userId)
          .single()

        if (profileData && profileData.addresses) {
            const addresses = profileData.addresses as Address[]
            const defaultAddress = addresses.find(addr => addr.isDefault) || (addresses.length > 0 ? addresses[0] : null)
            
            if (defaultAddress && defaultAddress.pincode) {
                const pin = defaultAddress.pincode.trim();
                setUserPincode(pin)
                // Trigger check automatically if we found a pincode
                checkDeliverability(pin);
            } else {
                setUserPincode(null)
            }
        } else {
            setUserPincode(null)
        }
      } else {
        // Reset if no user
        setInCart(false)
        setIsFavorite(false)
        setHasReviewed(false)
        setQuantity(1)
        setUserPincode(null)
        setIsDeliverable(null)
        setIsCheckingDelivery(false)
      }
    }

    fetchUserData()

    // Subscriptions
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUserId(session?.user?.id || null)
      fetchUserData()
    })
    
    // Cart changes
    const cartItemChannel = supabase.channel(`cart_item_${product.id}`).on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'cart_items', filter: `product_id=eq.${product.id}` },
      () => fetchUserData()
    ).subscribe()

    return () => {
      authListener.subscription.unsubscribe()
      supabase.removeChannel(cartItemChannel)
    }
  }, [product.id])


  // --- SECURE DELIVERY CHECK FUNCTION ---
  const checkDeliverability = async (pincodeOverride?: string) => {
    // If we are already checking, don't spam
    if (isCheckingDelivery) return;

    setIsCheckingDelivery(true)
    setIsDeliverable(null)

    try {
      // We call the Postgres function via RPC. 
      // We pass the pincode explicitly if we have it, otherwise the SQL function finds the default.
      const { data, error } = await supabase.rpc('check_delivery_status', { 
        pincode_arg: pincodeOverride || null 
      });

      if (error) throw error;

      if (data && data.success) {
        setIsDeliverable(data.deliverable);
        // If the API returned a pincode, ensure our state matches
        if (data.pincode && !userPincode) {
           setUserPincode(data.pincode);
        }
      } else {
        setIsDeliverable(false);
      }

    } catch (error: any) {
      console.error("Error checking delivery:", error);
      setIsDeliverable(false); 
      // Do not show error toast on auto-check, only if user explicitly requested maybe
    } finally {
      setIsCheckingDelivery(false);
    }
  };


  const reviewCount = reviews.length
  const averageRating =
    reviewCount > 0 ? (reviews.reduce((sum, review) => sum + review.rating, 0) / reviewCount).toFixed(1) : null

  const toggleFavorite = async () => {
    if (!currentUserId) {
      setShowAuthPopup(true)
      return
    }
    try {
      if (isFavorite) {
        const { error } = await supabase.from("favorites").delete().eq("user_id", currentUserId).eq("product_id", product.id)
        if (error) throw error
        setIsFavorite(false)
        toast({ title: "Removed from favorites", description: "Removed from your wishlist." })
      } else {
        const { error } = await supabase.from("favorites").insert({ user_id: currentUserId, product_id: product.id })
        if (error) throw error
        setIsFavorite(true)
        toast({ title: "Added to favorites!", description: "Added to your wishlist." })
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    }
  }

  const handleAddToCart = async () => {
    if (!currentUserId) {
      setShowAuthPopup(true)
      return
    }
    try {
      const { data: existingCartItem } = await supabase.from("cart_items").select("id").eq("user_id", currentUserId).eq("product_id", product.id).single()
      if (existingCartItem) {
        toast({ title: "Already in cart", description: "This product is already in your cart!" })
        return
      }
      const { error } = await supabase.from("cart_items").insert({
        user_id: currentUserId,
        product_id: product.id,
        quantity: quantity, 
        price_at_add: displayPrice,
      })
      if (error) throw error
      setInCart(true)
      toast({ title: "Added to cart!", description: "Product added to cart." })
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    }
  }

  const handleRemoveFromCart = async () => {
    if (!currentUserId) {
      setShowAuthPopup(true)
      return
    }
    try {
      const { error } = await supabase.from("cart_items").delete().eq("user_id", currentUserId).eq("product_id", product.id)
      if (error) throw error
      setInCart(false)
      setQuantity(1)
      toast({ title: "Removed from cart", description: "Product removed from cart." })
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    }
  }

  const handleDirectBuy = () => {
    if (!currentUserId) {
      setShowAuthPopup(true)
      return
    }
    setShowCheckoutModal(true)
  }

  const handleAuthSuccess = useCallback(() => {
    setShowAuthPopup(false)
    toast({ title: "Login Successful", description: "You are now logged in." })
  }, [toast])

  const updateQuantity = (newQuantity: number) => {
    if (newQuantity < 1) return
    setQuantity(newQuantity)
  }

  const handleReviewSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!currentUserId) {
      setShowAuthPopup(true)
      return
    }
    try {
      const { data: existingReview } = await supabase.from("reviews").select("id").eq("user_id", currentUserId).eq("product_id", product.id).single()
      if (existingReview) {
        toast({ title: "Already Reviewed", description: "You have already reviewed this product!" })
        return
      }
      const { error } = await supabase.from("reviews").insert({
        product_id: product.id,
        user_id: currentUserId,
        rating: reviewRating,
        comment: reviewText,
        created_at: new Date().toISOString(),
      })
      if (error) throw error
      setHasReviewed(true)
      toast({ title: "Review Submitted!", description: "Thank you for your review." })
      setShowReviewModal(false)
      setReviewRating(5)
      setReviewText("")
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    }
  }

  const handleOrderSuccess = () => {
    router.push("/orders")
  }

  useEffect(() => {
    const fetchReviews = async () => {
      const { data } = await supabase.from("reviews").select("user_id, rating, comment, created_at").eq("product_id", product.id).order("created_at", { ascending: false })
      setReviews(data || [])
    }
    fetchReviews()
    const channel = supabase.channel(`reviews_for_product_${product.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "reviews", filter: `product_id=eq.${product.id}` }, () => fetchReviews())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [product.id])

  // Logic for disabling buttons
  const isActionDisabled = 
    (!!currentUserId && isCheckingDelivery) ||
    (!!currentUserId && userPincode && isDeliverable === false);

  return (
    <div className="bg-white">
      {/* Breadcrumb */}
      <nav className="hidden sm:flex items-center text-sm text-gray-500 px-4 sm:px-6 lg:px-8 ">
        <Link href="/" className="hover:text-gray-900">Home</Link>
        <ChevronRight className="w-4 h-4 mx-2" />
        <Link href="/shop" className="hover:text-gray-900">Products</Link>
        <ChevronRight className="w-4 h-4 mx-2" />
        <span className="text-gray-900 font-medium">{product.productName}</span>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-0">
        <div className="lg:grid lg:grid-cols-2 lg:gap-x-12 xl:gap-x-16">
          
          {/* Product Images */}
          <div className="lg:max-w-lg lg:self-start">
            <div className="overflow-hidden rounded-2xl bg-gray-100 mb-4">
              {selectedImage && (
                <div className="relative aspect-square">
                  <Image src={selectedImage || "/placeholder.svg"} alt={product.productName} fill className="object-cover w-full h-full" sizes="(max-width: 768px) 100vw, 50vw" priority />
                </div>
              )}
            </div>
            {/* Gallery */}
            <div className="grid grid-cols-4 gap-3">
              {resolvedImages.map((imgUrl, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedImage(imgUrl)}
                  className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                    selectedImage === imgUrl ? "border-emerald-500 ring-2 ring-emerald-500/20" : "border-transparent hover:border-gray-300"
                  }`}
                >
                  <Image src={imgUrl || "/placeholder.svg"} alt={`Product image ${i + 1}`} fill className="object-cover" sizes="(max-width: 768px) 25vw, 12vw" />
                </button>
              ))}
              {product.productVideoUrl && (
                <button
                  onClick={() => window.open(getPublicUrlFromPath(product.productVideoUrl), "_blank")}
                  className="relative aspect-square rounded-lg overflow-hidden border-2 transition-all border-transparent hover:border-gray-300 flex items-center justify-center bg-gray-100"
                >
                  <Video className="w-8 h-8 text-gray-500" />
                </button>
              )}
            </div>
          </div>

          {/* Product Info */}
          <div className="mt-10 lg:mt-0 lg:col-start-2 lg:row-span-2 lg:self-start">
            <div className="flex items-center gap-4 mb-6">
              <div className="relative h-12 w-12 overflow-hidden rounded-full border border-gray-200">
                <Image src={getCompanyLogoUrlFromPath(product.company.logo) || "/placeholder.svg"} alt={product.company.name} fill className="object-cover" />
              </div>
              <div>
                <h4 className="text-base font-medium text-gray-900">{product.company.name}</h4>
                <div className="flex items-center mt-1">
                  <div className="flex items-center">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className={`w-4 h-4 ${averageRating && i < Math.round(Number(averageRating)) ? "fill-amber-400 text-amber-400" : "text-gray-300"}`} />
                    ))}
                  </div>
                  <span className="ml-2 text-sm text-gray-500">{averageRating ? `${averageRating} (${reviewCount} reviews)` : "No reviews yet"}</span>
                </div>
              </div>
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">{product.productName}</h1>

            {/* Price */}
            <div className="mt-6 flex items-center">
              <h2 className="sr-only">Product price</h2>
              <p className="text-3xl font-bold text-gray-900">₹{displayPrice}</p>
              {product.discountPrice && (
                <>
                  <p className="ml-3 text-lg text-gray-500 line-through">₹{product.originalPrice}</p>
                  <p className="ml-3 text-sm font-medium text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                    {Math.round(((product.originalPrice - displayPrice) / product.originalPrice) * 100)}% OFF
                  </p>
                </>
              )}
            </div>

            {/* Tabs */}
            <div className="mt-8 border-b border-gray-200">
              <div className="flex space-x-8">
                <button onClick={() => setActiveTab("description")} className={`pb-4 text-sm font-medium ${activeTab === "description" ? "border-b-2 border-emerald-500 text-emerald-600" : "text-gray-500 hover:text-gray-700"}`}>Description</button>
                <button onClick={() => setActiveTab("reviews")} className={`pb-4 text-sm font-medium flex items-center ${activeTab === "reviews" ? "border-b-2 border-emerald-500 text-emerald-600" : "text-gray-500 hover:text-gray-700"}`}>
                  Reviews {reviewCount > 0 && <span className="ml-2 bg-gray-100 text-gray-700 py-0.5 px-2 rounded-full text-xs">{reviewCount}</span>}
                </button>
              </div>
            </div>

            {/* Tab Content */}
            <div className="mt-6">
              {activeTab === "description" ? (
                <>
                  <div className="prose prose-sm max-w-none text-gray-700"><p>{product.productDescription}</p></div>
                  {product.nutrients && product.nutrients.length > 0 && (
                    <div className="mt-8">
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Nutritional Information</h3>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {product.nutrients.map((nutrient) => (
                          <div key={nutrient.name} className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <div className="font-semibold text-gray-900 text-lg">{nutrient.value}</div>
                            <div className="text-sm text-gray-600">{nutrient.name}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-6">
                  {!hasReviewed && (
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Share your thoughts</h3>
                      <p className="text-gray-600 text-sm mb-4">If you've used this product, share your thoughts with other customers</p>
                      <button onClick={() => setShowReviewModal(true)} className="w-full sm:w-auto bg-emerald-600 text-white py-2 px-4 rounded-lg hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2">
                        <MessageSquare className="w-4 h-4" /> Write a Review
                      </button>
                    </div>
                  )}
                  {reviews.length > 0 ? (
                    <div className="space-y-6">
                      {reviews.map((review) => (
                        <div key={review.user_id} className="p-5 rounded-lg bg-white border border-gray-200">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center">
                              {[...Array(5)].map((_, i) => (
                                <Star key={i} className={`w-4 h-4 ${i < review.rating ? "fill-amber-400 text-amber-400" : "text-gray-300"}`} />
                              ))}
                            </div>
                            <span className="text-xs text-gray-500">{new Date(review.created_at).toLocaleDateString()}</span>
                          </div>
                          <p className="text-gray-700">{review.comment}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <h3 className="text-lg font-medium text-gray-900 mb-1">No reviews yet</h3>
                      <p className="text-gray-500">Be the first to review this product</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Shipping Benefits */}
            <div className="mt-8 border-t border-gray-200 pt-8">
              <h3 className="text-sm font-medium text-gray-900 mb-4">Shipping & Benefits</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"><ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0" /><span className="text-sm text-gray-700">100% Organic Certified</span></div>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"><Truck className="w-5 h-5 text-emerald-600 flex-shrink-0" /><span className="text-sm text-gray-700">Free shipping over ₹1000</span></div>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"><Clock className="w-5 h-5 text-emerald-600 flex-shrink-0" /><span className="text-sm text-gray-700">24-48 hour delivery</span></div>
              </div>
            </div>

            {/* Add to Cart Section */}
            <div className="mt-8 border-t border-gray-200 pt-8">
              
              {/* Delivery Check Status */}
              <div className="mb-4 min-h-[1.5rem]">
                {currentUserId && isCheckingDelivery && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 animate-pulse">
                    <Clock className="w-4 h-4" /> Checking delivery to your pincode...
                  </div>
                )}
                {currentUserId && !isCheckingDelivery && userPincode && isDeliverable === true && (
                  <div className="flex items-center gap-2 text-sm font-medium text-emerald-600">
                    <Check className="w-5 h-5" /> Deliverable to {userPincode}
                  </div>
                )}
                {currentUserId && !isCheckingDelivery && userPincode && isDeliverable === false && (
                  <div className="flex items-center gap-2 text-sm font-medium text-red-600">
                    <X className="w-5 h-5" /> Not deliverable to {userPincode}
                  </div>
                )}
                {currentUserId && !isCheckingDelivery && !userPincode && (
                  <div className="flex items-center gap-2 text-sm font-medium text-yellow-700">
                    <Truck className="w-5 h-5" />
                    <Link href="/profile/addresses" className="hover:underline">Please add an address to check deliverability.</Link>
                  </div>
                )}
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Quantity */}
                <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
                  <button onClick={() => updateQuantity(quantity - 1)} className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors" disabled={quantity <= 1}><Minus className="w-4 h-4" /></button>
                  <div className="w-12 text-center font-medium">{quantity}</div>
                  <button onClick={() => updateQuantity(quantity + 1)} className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors"><Plus className="w-4 h-4" /></button>
                </div>
                {/* Buttons */}
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {inCart ? (
                    <button onClick={handleRemoveFromCart} className="flex items-center justify-center gap-2 bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-red-700 transition-colors">
                      <X className="w-4 h-4" /> Remove from Cart
                    </button>
                  ) : (
                    <button onClick={handleAddToCart} className="flex items-center justify-center gap-2 bg-emerald-600 text-white py-3 px-4 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" disabled={isActionDisabled}>
                      <Check className="w-4 h-4" /> Add to Cart
                    </button>
                  )}
                  <button onClick={handleDirectBuy} className="flex items-center justify-center gap-2 bg-gray-900 text-white py-3 px-4 rounded-lg hover:bg-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed" disabled={isActionDisabled}>
                    Buy Now • ₹{(displayPrice * quantity).toFixed(2)}
                  </button>
                </div>
              </div>

              {/* Wishlist */}
              <div className="flex items-center justify-between mt-4">
                <button onClick={toggleFavorite} className={`flex items-center gap-2 py-2 px-3 rounded-lg transition-colors ${isFavorite ? "text-red-600 bg-red-50" : "text-gray-700 hover:bg-gray-100"}`}>
                  <Heart className={`w-4 h-4 ${isFavorite ? "fill-red-600" : ""}`} />
                  <span className="text-sm font-medium">{isFavorite ? "Saved to Wishlist" : "Add to Wishlist"}</span>
                </button>
                <button className="flex items-center gap-2 py-2 px-3 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
                  <Share2 className="w-4 h-4" />
                  <span className="text-sm font-medium">Share</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Auth Popup */}
      {showAuthPopup && (<AuthPopup isOpen={showAuthPopup} onClose={() => setShowAuthPopup(false)} onSuccess={handleAuthSuccess} />)}

      {/* Review Modal */}
      {showReviewModal && (
        <Dialog open={showReviewModal} onOpenChange={setShowReviewModal}>
          <DialogContent className="sm:max-w-md p-0">
            <DialogHeader className="bg-gray-50 px-6 py-4 border-b">
              <DialogTitle className="text-xl font-bold text-gray-900 flex items-center gap-2"><MessageSquare className="w-5 h-5" /> Write a Review</DialogTitle>
              <DialogDescription className="sr-only">Share your experience.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleReviewSubmit} className="p-6">
              <div className="space-y-6">
                <div>
                  <Label className="block text-sm font-medium text-gray-700 mb-3">Your Rating</Label>
                  <div className="flex space-x-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button key={star} type="button" onClick={() => setReviewRating(star)} className="focus:outline-none transition-transform hover:scale-110">
                        <Star className={`w-8 h-8 ${star <= reviewRating ? "fill-amber-400 text-amber-400" : "text-gray-300"}`} />
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label htmlFor="reviewText" className="block text-sm font-medium text-gray-700 mb-2">Your Review</Label>
                  <Textarea id="reviewText" value={reviewText} onChange={(e) => setReviewText(e.target.value)} className="block w-full rounded-lg border border-gray-300 py-3 px-4 shadow-sm focus:border-emerald-500 focus:ring-emerald-500" rows={4} placeholder="Share your experience..." required />
                </div>
                <div className="flex justify-end space-x-3">
                  <Button type="button" variant="outline" onClick={() => setShowReviewModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">Cancel</Button>
                  <Button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors">Submit Review</Button>
                </div>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Checkout Modal */}
      {showCheckoutModal && (
        <CheckoutDetailsModal
          isOpen={showCheckoutModal}
          onClose={() => setShowCheckoutModal(false)}
          items={[{ productId: product.id, productName: product.productName, quantity: quantity, price_at_add: displayPrice }]}
          onOrderSuccess={handleOrderSuccess}
        />
      )}
    </div>
  )
}