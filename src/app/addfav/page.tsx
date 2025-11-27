"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { supabase } from "../../lib/supabase"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardTitle } from "@/components/ui/card"
import { Loader2, HeartCrack, Trash2, ShoppingCart, Check, Tag } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

// =========================================================================
//                             HELPER FUNCTIONS (FIXED)
// =========================================================================

/**
 * Helper function to reconstruct the public URL from the stored path (product-media bucket).
 * FIX APPLIED: Uses decodeURIComponent to prevent double-encoding of special characters.
 * @param path The relative path stored in the database (e.g., 'images/123/file.jpg')
 * @returns The full public URL string.
 */
const getPublicUrlFromPath = (path: string | undefined): string => {
    if (!path) {
        return "/placeholder.svg"; // Default placeholder if path is missing
    }
    // FIX: Decode the path to handle pre-encoded characters
    const decodedPath = decodeURIComponent(path); 

    const { data } = supabase.storage
        .from("product-media") 
        .getPublicUrl(decodedPath);

    return data.publicUrl || "/placeholder.svg";
};

// =========================================================================
//                             COMPONENT DEFINITION
// =========================================================================

interface FavoriteItem {
  id: string
  productId: string
  productName: string
  price: number
  originalPrice?: number
  thumbnail: string
  isInCart: boolean
}

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState<string>("")
  const router = useRouter()
  const { toast } = useToast()

  // --- Data Fetching and Listener Setup ---
  useEffect(() => {
    const fetchFavorites = async () => {
      setLoading(true)
      setError(null)

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError || !session) {
        toast({
          title: "Authentication Required",
          description: "Please log in to view your favorites.",
          variant: "destructive",
        })
        router.push("/login")
        return
      }

      const userId = session.user.id

      // Fetch cart items to check for existence
      const { data: cartData } = await supabase
        .from("cart_items")
        .select("product_id")
        .eq("user_id", userId)

      const cartProductIds = new Set(cartData?.map((item) => item.product_id) || [])

      // Fetch favorites with joined product data
      const { data, error: favError } = await supabase
        .from("favorites")
        .select(
          `
          id,
          product_id,
          products (
            product_name,
            discount_price,
            original_price,
            product_photo_urls
          )
        `
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })

      if (favError) {
        setError("Failed to load favorites. Please try again.")
        setFavorites([])
      } else {
        const fetchedFavorites: FavoriteItem[] =
          data?.map((fav) => {
            // Handle array or single object structure returned by join
            const prod = Array.isArray(fav.products) ? fav.products[0] : fav.products
            const productId = fav.product_id || ""

            return {
              id: fav.id,
              productId: productId,
              productName: prod?.product_name || "Unknown Product",
              price: prod?.discount_price ?? prod?.original_price ?? 0,
              originalPrice: prod?.original_price,
              thumbnail: prod?.product_photo_urls?.[0] || "/placeholder.svg",
              isInCart: cartProductIds.has(productId),
            }
          }) || []
        setFavorites(fetchedFavorites)
      }
      setLoading(false)
    }

    fetchFavorites()

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.push("/login")
      } else {
        fetchFavorites()
      }
    })

    const cartChangesListener = supabase
      .channel("favorites_page_cart_updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cart_items" },
        () => {
          fetchFavorites()
        }
      )
      .subscribe()

    return () => {
      authListener.subscription.unsubscribe()
      supabase.removeChannel(cartChangesListener)
    }
  }, [router, toast])

  // --- Handlers ---

  const handleRemove = async (favId: string, productName: string) => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const userId = session?.user?.id

    if (!userId) {
      toast({
        title: "Error",
        description: "Please log in to remove favorites.",
        variant: "destructive",
      })
      return
    }

    try {
      const { error } = await supabase.from("favorites").delete().eq("id", favId).eq("user_id", userId)
      if (error) throw error

      setFavorites((prev) => prev.filter((item) => item.id !== favId))
      toast({
        title: "Removed from Wishlist",
        description: `${productName} has been removed from your wishlist.`,
        variant: "default",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to remove product from favorites.",
        variant: "destructive",
      })
    }
  }

  const handleAddToCart = async (productId: string, productName: string, price: number) => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const userId = session?.user?.id

    if (!userId) {
      toast({
        title: "Error",
        description: "Please log in to add products to your cart.",
        variant: "destructive",
      })
      return
    }

    try {
      const { data: existingCartItem, error: fetchError } = await supabase
        .from("cart_items")
        .select("id")
        .eq("user_id", userId)
        .eq("product_id", productId)
        .single()

      if (fetchError && fetchError.code !== "PGRST116") {
        throw fetchError
      }

      if (existingCartItem) {
        toast({
          title: "Already in Cart",
          description: `${productName} is already in your cart!`,
          variant: "default",
        })
        setFavorites((prev) =>
          prev.map((item) => (item.productId === productId ? { ...item, isInCart: true } : item))
        )
        return
      }

      const { error } = await supabase.from("cart_items").insert({
        user_id: userId,
        product_id: productId,
        quantity: 1,
        price_at_add: price,
      })

      if (error) throw error

      toast({
        title: "Added to Cart!",
        description: `${productName} has been added to your cart.`,
        variant: "default",
      })
      setFavorites((prev) =>
        prev.map((item) => (item.productId === productId ? { ...item, isInCart: true } : item))
      )
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add product to cart.",
        variant: "destructive",
      })
    }
  }

  const handleGoToCart = () => {
    router.push("/cart")
  }

  const filteredFavorites = favorites.filter((item) =>
    item.productName.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // --- Rendering UI States ---

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header showSearchBar={true} onSearch={setSearchTerm} />
        <main className="flex-grow container mx-auto px-4 py-8 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-green-600" />
          <span className="ml-3 text-lg text-green-700">Loading your organic wishlist...</span>
        </main>
        <Footer />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header showSearchBar={true} onSearch={setSearchTerm} />
        <main className="flex-grow container mx-auto px-4 py-8">
          <div
            className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl relative shadow-md"
            role="alert"
          >
            <strong className="font-bold">Wishlist Error:</strong>
            <span className="block sm:inline"> {error}</span>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header showSearchBar={true} onSearch={setSearchTerm} />
      <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <h1 className="text-3xl sm:text-4xl font-extrabold mb-8 text-gray-900 tracking-tight border-b pb-3">
          My Organic Wishlist ({filteredFavorites.length})
        </h1>

        {filteredFavorites.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl shadow-lg border border-gray-200">
            <HeartCrack className="w-20 h-20 sm:w-24 sm:h-24 mb-6 text-green-300" />
            <p className="text-xl sm:text-2xl font-semibold mb-3 text-gray-700">Your wishlist is empty!</p>
            <p className="text-gray-500 mb-6 text-center max-w-md">
              Start adding products you love to your list. Find your next favorite organic item!
            </p>
            <Button asChild className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-xl shadow-md transition-all">
              <Link href="/shop">Explore Products</Link>
            </Button>
          </div>
        ) : (
          <div
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6"
          >
            {filteredFavorites.map((item) => {
              const discountPercent = item.originalPrice && item.originalPrice > item.price
                ? Math.round(((item.originalPrice - item.price) / item.originalPrice) * 100)
                : 0;

              return (
                <Card
                  key={item.id}
                  className="flex flex-col h-full group transition-all duration-300 overflow-hidden rounded-xl border-2 border-gray-100 hover:border-green-400 hover:shadow-2xl shadow-lg bg-white p-0"
                >
                  {/* Image & Badges */}
                  <Link
                    href={`/product/${item.productId}`}
                    className="relative w-full aspect-[3/4] sm:aspect-square overflow-hidden bg-gray-100 block"
                  >
                    <Image
                      // FIX: Use the helper function to resolve the image path
                      src={getPublicUrlFromPath(item.thumbnail)}
                      alt={item.productName}
                      fill
                      sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    
                    {/* Discount Badge */}
                    {discountPercent > 0 && (
                      <div className="absolute top-3 left-3 bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1">
                        <Tag className="w-3 h-3" />
                        {discountPercent}% OFF
                      </div>
                    )}
                  </Link>

                  {/* Content */}
                  <CardContent className="p-3 sm:p-4 flex flex-col flex-grow">
                    <CardTitle className="text-base sm:text-lg font-bold mb-2 line-clamp-2">
                      <Link
                        href={`/product/${item.productId}`}
                        className="hover:text-green-600 transition-colors"
                      >
                        {item.productName}
                      </Link>
                    </CardTitle>

                    {/* Price */}
                    <div className="flex items-baseline gap-2 mb-4 mt-1">
                      <p className="text-xl sm:text-2xl font-extrabold text-gray-900">
                        ₹{item.price.toFixed(2)}
                      </p>
                      {item.originalPrice && item.originalPrice > item.price && (
                        <p className="text-sm text-gray-400 line-through">
                          ₹{item.originalPrice.toFixed(2)}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="mt-auto flex flex-col gap-2">
                      
                      {item.isInCart ? (
                        <Button
                          size="sm"
                          className="w-full bg-green-500/20 text-green-700 hover:bg-green-500/30 font-semibold transition-all"
                          onClick={handleGoToCart}
                        >
                          <Check className="w-4 h-4 mr-2" /> In Cart (Go to Cart)
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className="w-full bg-green-600 hover:bg-green-700 transition-all font-semibold"
                          onClick={() =>
                            handleAddToCart(
                              item.productId,
                              item.productName,
                              item.price
                            )
                          }
                        >
                          <ShoppingCart className="w-4 h-4 mr-2" /> Add to Cart
                        </Button>
                      )}

                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full bg-transparent text-red-600 hover:bg-red-50 border-red-300 border-dashed transition-all"
                        onClick={() => handleRemove(item.id, item.productName)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" /> Remove
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}