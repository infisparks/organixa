"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { supabase } from "../../lib/supabase"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
// Assuming OrderStatusTimeline is a valid component
import OrderStatusTimeline from "@/components/OrderStatusTimeline" 
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, ShoppingBag, Phone, CalendarDays, Search, Truck, Eye, Utensils } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"

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
//                             TYPE DEFINITIONS
// =========================================================================

// Define the structure of an item within the order_items JSONB array
interface OrderItemJson {
    id: string
    product_id: string
    quantity: number
    price_at_purchase: number
    created_at: string
}

// Define the structure of an order item with product details
interface ProductDetailsForOrder {
    id: string
    product_name: string
    product_photo_urls: string[]
}

interface OrderItemWithProduct extends OrderItemJson {
    products: ProductDetailsForOrder | null
}

interface Order {
    id: string
    total_amount: number
    status: string
    purchase_time: string
    customer_name: string
    primary_phone: string
    secondary_phone: string | null
    country: string
    state: string
    city: string
    pincode: string
    area: string | null
    street: string | null
    house_number: string | null
    order_items: OrderItemJson[]
    resolved_order_items?: OrderItemWithProduct[]
}

// =========================================================================
//                             UTILITY FUNCTIONS
// =========================================================================

const getStatusBadgeClass = (status: string) => {
    switch (status) {
        case "pending": return "bg-yellow-100 text-yellow-700 border-yellow-300";
        case "confirmed": return "bg-blue-100 text-blue-700 border-blue-300";
        case "payment_accepted": return "bg-green-100 text-green-700 border-green-300";
        case "preparing": return "bg-orange-100 text-orange-700 border-orange-300";
        case "shipped": return "bg-purple-100 text-purple-700 border-purple-300";
        case "delivered": return "bg-emerald-100 text-emerald-700 border-emerald-300";
        case "cancelled": return "bg-red-100 text-red-700 border-red-300";
        default: return "bg-gray-100 text-gray-700 border-gray-300";
    }
};

// =========================================================================
//                             MAIN COMPONENT
// =========================================================================

export default function MyOrdersPage() {
    const [orders, setOrders] = useState<Order[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState("")
    const router = useRouter()
    const { toast } = useToast()

    const fetchOrders = useCallback(async () => {
        setLoading(true)
        setError(null)

        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        if (sessionError || !session) {
            toast({ title: "Authentication Required", description: "Please log in to view your orders.", variant: "destructive" })
            router.push("/login")
            return
        }

        const userId = session.user.id

        // Fetch orders, including the order_items JSONB column
        const { data: ordersData, error: ordersError } = await supabase
            .from("orders")
            .select(
                `id, total_amount, status, purchase_time, customer_name, primary_phone, secondary_phone, country, state, city, pincode, area, street, house_number, order_items`
            )
            .eq("user_id", userId)
            .order("purchase_time", { ascending: false })

        if (ordersError) {
            console.error("Error fetching orders:", ordersError)
            setError("Failed to load orders. Please try again.")
            setOrders([])
            setLoading(false)
            return
        }

        if (!ordersData || ordersData.length === 0) {
            setOrders([])
            setLoading(false)
            return
        }

        // Extract all unique product_ids from all orders' order_items
        const allProductIds = new Set<string>()
        ordersData.forEach((order) => {
            if (Array.isArray(order.order_items)) {
                order.order_items.forEach((item: OrderItemJson) => {
                    allProductIds.add(item.product_id)
                })
            }
        })

        const productsMap = new Map<string, any>()
        if (allProductIds.size > 0) {
            const { data: productsData, error: productsError } = await supabase
                .from("products")
                .select("id, product_name, product_photo_urls")
                .in("id", Array.from(allProductIds))

            if (productsError) {
                console.error("Error fetching product details for orders:", productsError)
            } else if (productsData) {
                productsData.forEach((product) => {
                    productsMap.set(product.id, product)
                })
            }
        }

        // Map product details back to each order's items
        const resolvedOrders: Order[] = ordersData.map((order) => {
            const resolvedItems: OrderItemWithProduct[] = Array.isArray(order.order_items)
                ? order.order_items.map((item: OrderItemJson) => ({
                    ...item,
                    products: productsMap.get(item.product_id) || null,
                }))
                : []
            return {
                ...order,
                resolved_order_items: resolvedItems,
            }
        })

        setOrders(resolvedOrders)
        setLoading(false)
    }, [router, toast])

    useEffect(() => {
        fetchOrders()

        const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!session) { router.push("/login") } else { fetchOrders() }
        })
        
        // 🎯 Real-time listener for orders table to update status instantly
        const orderChannel = supabase.channel('customer_order_status').on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'orders' },
            (payload) => {
                // Check if the update belongs to one of the user's fetched orders
                const updatedStatus = payload.new.status as string;
                const updatedId = payload.new.id as string;
                
                setOrders(prevOrders => prevOrders.map(order => 
                    order.id === updatedId ? { ...order, status: updatedStatus } : order
                ));
            }
        ).subscribe();

        return () => {
            authListener.subscription.unsubscribe();
            supabase.removeChannel(orderChannel);
        }
    }, [fetchOrders, router])

    const filteredOrders = orders.filter((order) => {
        const matchesSearchTerm =
            order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.primary_phone.includes(searchTerm) ||
            order.resolved_order_items?.some((item) =>
                item.products?.product_name.toLowerCase().includes(searchTerm.toLowerCase()),
            )
        return matchesSearchTerm
    })

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col bg-gray-50">
                <Header showSearchBar={false} />
                <main className="flex-grow container mx-auto px-4 py-12 flex items-center justify-center">
                    <Loader2 className="h-10 w-10 animate-spin text-green-600" />
                    <span className="ml-3 text-xl text-green-700">Loading your order history...</span>
                </main>
                <Footer />
            </div>
        )
    }

    if (error) {
        return (
            <div className="min-h-screen flex flex-col bg-gray-50">
                <Header showSearchBar={false} />
                <main className="flex-grow container mx-auto px-4 py-8">
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl relative shadow-md" role="alert">
                        <strong className="font-bold">Order History Error:</strong>
                        <span className="block sm:inline"> {error}</span>
                    </div>
                </main>
                <Footer />
            </div>
        )
    }

    return (
        <div className="min-h-screen flex flex-col bg-gray-50">
            <Header showSearchBar={false} />
            <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
                <h1 className="text-3xl sm:text-4xl font-extrabold mb-8 text-gray-900 tracking-tight border-b pb-3">
                    Your Orders
                </h1>

                <div className="relative mb-8">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <Input
                        type="text"
                        placeholder="Search orders by ID, product name, or contact number..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2 border-2 border-gray-200 rounded-xl w-full focus:ring-green-500 focus:border-green-500 transition-all shadow-sm"
                    />
                </div>

                {filteredOrders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl shadow-lg border border-gray-200">
                        <ShoppingBag className="w-20 h-20 sm:w-24 sm:h-24 mb-6 text-green-300" />
                        <p className="text-xl sm:text-2xl font-semibold mb-3 text-gray-700">No orders found.</p>
                        <p className="text-gray-500 mb-6 text-center max-w-md">
                            It looks like you haven't placed any orders yet. Start your organic journey now!
                        </p>
                        <Button asChild className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-xl shadow-md transition-all">
                            <Link href="/shop">Explore Products</Link>
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {filteredOrders.map((order) => (
                            <Card 
                                key={order.id} 
                                className="shadow-lg rounded-xl border-2 border-gray-100 bg-white hover:border-green-300 transition-all duration-300"
                            >
                                <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 sm:p-6 border-b border-gray-100 bg-gray-50/50 rounded-t-xl">
                                    <div className="mb-2 sm:mb-0">
                                        <CardTitle className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
                                            Order ID: <span className="font-mono text-base text-green-700">#{order.id.substring(0, 8).toUpperCase()}</span>
                                        </CardTitle>
                                        <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                                            <CalendarDays className="w-4 h-4 text-green-500" />
                                            <span className="font-medium">Placed:</span> {new Date(order.purchase_time).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                                        </p>
                                    </div>
                                    <Badge className={`px-4 py-1.5 text-sm font-semibold border ${getStatusBadgeClass(order.status)} shadow-sm`}>
                                        {order.status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                                    </Badge>
                                </CardHeader>
                                
                                <CardContent className="space-y-6 p-4 sm:p-6">
                                    
                                    {/* STATUS TIMELINE */}
                                    {/* Assuming OrderStatusTimeline component exists and works */}
                                    <div className="pb-4 border-b border-gray-100">
                                        <OrderStatusTimeline currentStatus={order.status} />
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        {/* Order Summary */}
                                        <div className={`space-y-3 bg-green-50 rounded-xl shadow-inner p-4 border border-green-200`}>
                                            <h3 className="font-bold text-green-800 flex items-center gap-2">
                                                <Utensils className="w-5 h-5" /> Order Value
                                            </h3>
                                            <div className="flex justify-between text-sm text-gray-700 pt-1">
                                                <span className="font-medium">Total Items:</span>
                                                <span>{order.resolved_order_items?.reduce((sum, item) => sum + item.quantity, 0)}</span>
                                            </div>
                                            <div className="flex justify-between text-xl font-extrabold text-green-700 border-t border-green-200 pt-2">
                                                <span>Total Paid:</span>
                                                <span>₹{order.total_amount.toFixed(2)}</span>
                                            </div>
                                        </div>
                                        
                                        {/* Shipping Address */}
                                        <div className={`space-y-3 bg-white rounded-xl shadow-sm p-4 border border-gray-200 md:col-span-2`}>
                                            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                                <Truck className="w-5 h-5" /> Shipping Address
                                            </h3>
                                            <p className="text-sm text-gray-600 font-medium">
                                                {order.customer_name} <span className="font-normal text-xs text-gray-400 ml-2">({order.primary_phone})</span>
                                            </p>
                                            <p className="text-sm text-gray-700">
                                                {order.house_number}, {order.street}, {order.area}<br />
                                                {order.city} - {order.pincode}, {order.state}<br />
                                                {order.country}
                                            </p>
                                            
                                        </div>
                                    </div>

                                    <Separator className="bg-gray-200" />

                                    {/* Ordered Products */}
                                    <h3 className="font-bold text-gray-800 mb-4">Items ({order.resolved_order_items?.length})</h3>
                                    <div className="space-y-3">
                                        {order.resolved_order_items?.map((item) => (
                                            <div key={item.id} className="flex items-center justify-between gap-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
                                                
                                                {/* Product Info */}
                                                <Link href={`/product/${item.product_id}`} className="flex items-center gap-3 group min-w-0 flex-grow">
                                                    
                                                    {/* Product Image (FIX APPLIED) */}
                                                    <div className="relative w-14 h-14 flex-shrink-0 rounded-md overflow-hidden border border-gray-300">
                                                        <Image 
                                                            // FIX: Use the helper function to resolve the image path
                                                            src={getPublicUrlFromPath(item.products?.product_photo_urls?.[0])} 
                                                            alt={item.products?.product_name || "Product Image"} 
                                                            fill 
                                                            sizes="56px" 
                                                            className="object-cover" 
                                                        />
                                                    </div>
                                                    
                                                    {/* Name and Quantity */}
                                                    <div className="min-w-0">
                                                        <p className="text-md font-semibold text-gray-900 line-clamp-1 group-hover:text-green-600 transition-colors">
                                                            {item.products?.product_name || "Unknown Product"}
                                                        </p>
                                                        <p className="text-sm text-gray-500 font-medium">
                                                            Qty: {item.quantity} | Unit Price: ₹{item.price_at_purchase.toFixed(2)}
                                                        </p>
                                                    </div>
                                                </Link>
                                                
                                                {/* Product Amount and Button Container */}
                                                <div className="flex flex-col items-end space-y-2 flex-shrink-0">
                                                    <span className="font-extrabold text-lg text-green-700 whitespace-nowrap">
                                                        ₹{(item.price_at_purchase * item.quantity).toFixed(2)}
                                                    </span>
                                                    <Button asChild variant="outline" size="sm" className="h-8 text-xs px-3 border-green-500 text-green-600 hover:bg-green-50">
                                                        <Link href={`/product/${item.product_id}`} className="flex items-center gap-1">
                                                            <Eye className="w-3 h-3" />
                                                            Details
                                                        </Link>
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </main>
            <Footer />
        </div>
    )
}