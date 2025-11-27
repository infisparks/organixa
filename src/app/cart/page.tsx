"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { supabase } from "../../lib/supabase"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Minus, Plus, Trash2, PackageX, ShoppingCart, Truck, Check } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Separator } from "@/components/ui/separator"
import CheckoutDetailsModal from "@/components/checkout-details-modal"

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
//                             COMPONENT START
// =========================================================================

// ✅ UPDATED CartItem interface to make product fields optional since 'products' can be null
interface CartItem {
  id: string
  product_id: string
  quantity: number
  price_at_add: number
  products: {
    product_name?: string // Made optional
    discount_price?: number // Made optional
    original_price?: number // Made optional
    product_photo_urls?: string[] // Made optional
  } | null
}

export default function CartPage() {
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCheckoutModal, setShowCheckoutModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState<string>("")
  const router = useRouter()
  const { toast } = useToast()

  const fetchCartItems = useCallback(async () => {
    setLoading(true)
    setError(null)

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError || !session) {
      toast({
        title: "Please log in to view your cart.",
        variant: "destructive",
      })
      router.push("/login")
      return
    }

    const userId = session.user.id

    const { data, error: cartError } = await supabase
      .from("cart_items")
      .select(
        `
      id,
      product_id,
      quantity,
      price_at_add,
      products (
        product_name,
        discount_price,
        original_price,
        product_photo_urls
      )
    `,
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (cartError) {
      setError("Failed to load cart items. Please try again.")
      setCartItems([])
    } else {
      // Defensive: handle array/object/null for products
      const fixedData: CartItem[] =
        data?.map((item: any) => {
          let prod = item.products
          if (Array.isArray(prod)) prod = prod[0] ?? null
          return {
            id: item.id,
            product_id: item.product_id,
            quantity: item.quantity,
            price_at_add: item.price_at_add,
            products: prod, // prod can be null if product was deleted
          }
        }) ?? []
      setCartItems(fixedData)
    }
    setLoading(false)
  }, [router, toast])

  useEffect(() => {
    fetchCartItems()

    // Listen for auth state changes to re-fetch cart items
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.push("/login")
      } else {
        fetchCartItems()
      }
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [fetchCartItems, router])

  // Added real-time listener for cart item updates (quantity changes)
  useEffect(() => {
    const channel = supabase
      .channel("cart_items_realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cart_items",
        },
        () => {
          // Re-fetch cart items whenever any change occurs in the table
          fetchCartItems()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchCartItems])


  const handleQuantityChange = async (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) return

    const {
      data: { session },
    } = await supabase.auth.getSession()
    const userId = session?.user?.id

    if (!userId) {
      toast({
        title: "Please log in to update cart quantity.",
        variant: "destructive",
      })
      return
    }

    try {
      const { error } = await supabase
        .from("cart_items")
        .update({ quantity: newQuantity })
        .eq("id", itemId)
        .eq("user_id", userId)

      if (error) throw error

      // Optimistic UI update for immediate response
      setCartItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, quantity: newQuantity } : item)))
    } catch (error: any) {
      toast({
        title: error.message || "Failed to update product quantity.",
        variant: "destructive",
      })
    }
  }

  const handleRemoveItem = async (itemId: string, productName: string) => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const userId = session?.user?.id

    if (!userId) {
      toast({
        title: "Please log in to remove items from cart.",
        variant: "destructive",
      })
      return
    }

    try {
      const { error } = await supabase.from("cart_items").delete().eq("id", itemId).eq("user_id", userId)

      if (error) throw error

      setCartItems((prev) => prev.filter((item) => item.id !== itemId))
      toast({
        title: `${productName} has been removed from your cart.`,
        variant: "default",
      })
    } catch (error: any) {
      toast({
        title: error.message || "Failed to remove product from cart.",
        variant: "destructive",
      })
    }
  }

  // Filter cart items based on search term
  const filteredCartItems = cartItems.filter((item) =>
    item.products?.product_name?.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  // 🎯 CORE CALCULATION: Subtotal includes quantity for each item
  const subtotal = filteredCartItems.reduce((sum, item) => {
    const price = item.products?.discount_price ?? item.products?.original_price ?? item.price_at_add
    return sum + price * item.quantity
  }, 0)
  
  const shippingFee = subtotal > 0 && subtotal < 1000 ? 99 : 0
  const total = subtotal + shippingFee

  const handleProceedToCheckout = () => {
    if (filteredCartItems.length === 0) {
      toast({
        title: "Please add items to your cart before proceeding to checkout.",
        variant: "destructive",
      })
      return
    }
    setShowCheckoutModal(true)
  }

  const handleOrderSuccess = async () => {
    // Clear the cart after successful order
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const userId = session?.user?.id
    if (userId) {
      const { error } = await supabase.from("cart_items").delete().eq("user_id", userId)
      if (!error) setCartItems([])
    }
    setShowCheckoutModal(false);
    router.push("/orders")
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Header showSearchBar={true} onSearch={setSearchTerm} />
        <main className="flex-grow container mx-auto px-4 py-8 flex items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-green-600" />
          <span className="ml-3 text-xl text-green-700">Fetching your cart contents...</span>
        </main>
        <Footer />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Header showSearchBar={true} onSearch={setSearchTerm} />
        <main className="flex-grow container mx-auto px-4 py-8">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl relative shadow-md" role="alert">
            <strong className="font-bold">Cart Error:</strong>
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
      <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <h1 className="text-3xl sm:text-4xl font-extrabold mb-8 text-gray-900 tracking-tight">
          Your Shopping Cart ({filteredCartItems.length})
        </h1>

        {filteredCartItems.length === 0 && cartItems.length > 0 && searchTerm !== "" ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl shadow-lg border border-gray-200">
            <ShoppingCart className="w-20 h-20 mb-4 text-gray-300" />
            <p className="text-xl font-medium mb-2">No items match your search term.</p>
            <p className="text-md mb-6 text-gray-500">Try a different search or clear the search bar to see all items.</p>
            <Button onClick={() => setSearchTerm("")} className="bg-green-600 hover:bg-green-700">
                Clear Search
            </Button>
          </div>
        ) : filteredCartItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl shadow-lg border border-gray-200">
            <PackageX className="w-20 h-20 sm:w-24 sm:h-24 mb-6 text-green-300" />
            <p className="text-xl sm:text-2xl font-semibold mb-3 text-gray-700">Your cart is empty!</p>
            <p className="text-gray-500 mb-6 text-center max-w-md">
              Start adding organic products to your cart.
            </p>
            <Button asChild className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-xl shadow-md transition-all">
              <Link href="/shop">Start Shopping</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Cart Items List */}
            <div className="lg:col-span-2 space-y-4">
              {filteredCartItems.map((item) => {
                  const unitPrice = item.products?.discount_price ?? item.products?.original_price ?? item.price_at_add;
                  const itemSubtotal = unitPrice * item.quantity;
                  const productName = item.products?.product_name || "Unknown Product";
                  
                  return (
                    <Card key={item.id} className="flex flex-col sm:flex-row p-4 rounded-xl shadow-md transition-shadow hover:shadow-lg border border-gray-200 bg-white">
                      
                      {/* Image Link (Fixed 96x96 size) */}
                      <Link
                        href={`/product/${item.product_id}`}
                        className="relative w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden border border-gray-100 mx-auto sm:mx-0 mb-4 sm:mb-0"
                      >
                        {/* ✅ Use helper function for image resolution */}
                        <Image
                          src={getPublicUrlFromPath(item.products?.product_photo_urls?.[0])}
                          alt={productName}
                          fill
                          sizes="96px"
                          className="object-cover"
                        />
                      </Link>
                      
                      {/* Product Details & Actions */}
                      <div className="ml-0 sm:ml-4 flex-grow flex flex-col justify-between w-full">
                        
                        {/* Top Row: Name, Unit Price, Total Price */}
                        <div className="flex flex-col sm:flex-row justify-between sm:items-start w-full">
                          
                          {/* Name and Unit Price */}
                          <div className="mb-2 sm:mb-0 sm:w-3/5 text-center sm:text-left">
                            <h2 className="text-lg font-bold text-gray-900 line-clamp-2">
                              <Link href={`/product/${item.product_id}`} className="hover:text-green-600 transition-colors">
                                {productName}
                              </Link>
                            </h2>
                            <p className="text-gray-600 text-sm mt-1">
                              Unit Price: ₹{unitPrice.toFixed(2)}
                            </p>
                          </div>

                          {/* Item Subtotal (Large) */}
                          <div className="sm:w-2/5 flex flex-col items-center sm:items-end">
                            <p className="text-xl font-extrabold text-green-700">
                                ₹{itemSubtotal.toFixed(2)}
                            </p>
                            <p className="text-xs font-medium text-gray-500">
                                Item Subtotal
                            </p>
                          </div>
                        </div>

                        {/* Bottom Row: Quantity & Remove Button */}
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                          
                          {/* Quantity Selector */}
                          <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 bg-transparent hover:bg-gray-100"
                              onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                              disabled={item.quantity <= 1}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <span className="mx-3 text-md font-medium text-gray-900">{item.quantity}</span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 bg-transparent hover:bg-gray-100"
                              onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                          
                          {/* Remove Button */}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:bg-red-50 hover:text-red-600 gap-1 font-medium"
                            onClick={() => handleRemoveItem(item.id, productName)}
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="hidden sm:inline">Remove</span>
                          </Button>
                        </div>
                      </div>
                    </Card>
                  )
              })}
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <Card className="sticky top-24 shadow-2xl rounded-xl border-green-200 border-2 bg-white">
                <CardHeader className="border-b border-gray-100 bg-green-50/50 rounded-t-xl">
                  <CardTitle className="text-xl font-extrabold text-green-800 flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5" /> Cart Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 py-6">
                  <div className="flex justify-between text-gray-700 text-base">
                    <span>Subtotal ({filteredCartItems.reduce((acc, item) => acc + item.quantity, 0)} items)</span>
                    <span className="font-semibold">₹{subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-gray-700 text-base">
                    <span className="flex items-center gap-2">
                      <Truck className="w-4 h-4 text-green-600"/> Shipping
                    </span>
                    <span className={`font-semibold ${shippingFee === 0 ? 'text-green-600' : 'text-gray-700'}`}>
                        {shippingFee === 0 ? <span className="font-extrabold">FREE</span> : `₹${shippingFee.toFixed(2)}`}
                    </span>
                  </div>
                  {shippingFee !== 0 && (
                      <p className="text-xs text-green-600 bg-green-50 p-2 rounded-lg text-center font-medium">
                          Add ₹{(1000 - subtotal).toFixed(2)} more for free shipping!
                      </p>
                  )}
                  <Separator className="bg-green-100" />
                  <div className="flex justify-between font-extrabold text-xl text-gray-900">
                    <span>Order Total</span>
                    <span>₹{total.toFixed(2)}</span>
                  </div>
                  <Button
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg text-lg font-bold shadow-xl transition-all hover:shadow-2xl"
                    onClick={handleProceedToCheckout}
                  >
                    <Check className="w-5 h-5 mr-2" /> Proceed to Checkout
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </main>
      <Footer />
      {showCheckoutModal && (
        <CheckoutDetailsModal
          isOpen={showCheckoutModal}
          onClose={() => setShowCheckoutModal(false)}
          // 🎯 Pass the correctly mapped and calculated item details to the modal
          items={filteredCartItems.map((item) => {
            const unitPrice = item.products?.discount_price ?? item.products?.original_price ?? item.price_at_add;
            return {
              productId: item.product_id,
              productName: item.products?.product_name || "Unknown Product",
              quantity: item.quantity,
              // Use the actual unit price, the modal calculates the total from this
              price_at_add: unitPrice, 
            }
          })}
          onOrderSuccess={handleOrderSuccess}
        />
      )}
    </div>
  )
}