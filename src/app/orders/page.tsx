"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { supabase } from "../../lib/supabase"
import { getPublicUrlFromPath } from "@/lib/image-utils"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import OrderStatusTimeline from "@/components/OrderStatusTimeline"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { motion, AnimatePresence } from "framer-motion"
import { useToast } from "@/hooks/use-toast"
import { 
    Loader2, ShoppingBag, CalendarDays, Search, 
    Package, ChevronDown, ChevronUp, ExternalLink 
} from "lucide-react"

// =========================================================================
//                             TYPE DEFINITIONS
// =========================================================================

interface OrderItem {
    id: string
    product_id: string
    quantity: number
    unit_price: number
    total_price: number
    created_at: string
}

interface ProductDetailsForOrder {
    id: string
    product_name: string
    product_photo_urls: string[]
}

interface OrderItemWithProduct extends OrderItem {
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
    order_items: OrderItem[]
    resolved_order_items?: OrderItemWithProduct[]
}

// =========================================================================
//                             HELPER FUNCTIONS
// =========================================================================

const getStatusBadgeClass = (status: string) => {
    switch (status.toLowerCase()) {
        case "pending": return "bg-amber-50 text-amber-700 border-amber-200";
        case "confirmed": return "bg-blue-50 text-blue-700 border-blue-200";
        case "processing": return "bg-indigo-50 text-indigo-700 border-indigo-200";
        case "packed": return "bg-teal-50 text-teal-700 border-teal-200";
        case "shipped": return "bg-purple-50 text-purple-700 border-purple-200";
        case "delivered": return "bg-emerald-50 text-emerald-700 border-emerald-200";
        case "cancelled": return "bg-red-50 text-red-700 border-red-200";
        default: return "bg-slate-50 text-slate-700 border-slate-200";
    }
}

// =========================================================================
//                             COMPONENTS
// =========================================================================

function OrderSkeleton() {
    return (
        <div className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-5 flex flex-col gap-4">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <Skeleton className="w-10 h-10 rounded-xl" />
                    <div>
                        <Skeleton className="w-24 h-4 mb-2" />
                        <Skeleton className="w-32 h-3" />
                    </div>
                </div>
                <Skeleton className="w-16 h-8 rounded-lg" />
            </div>
        </div>
    )
}

function OrderCard({ order }: { order: Order }) {
    const [isExpanded, setIsExpanded] = useState(false)

    return (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden font-poppins">
            {/* Compact Header (Always Visible) */}
            <div 
                className="p-4 sm:p-5 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100 flex-shrink-0">
                        <Package className="w-5 h-5 text-slate-600" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-sm text-slate-900 tracking-tight">
                                #{order.id.substring(0, 8).toUpperCase()}
                            </span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${getStatusBadgeClass(order.status)}`}>
                                {order.status.replace('_', ' ')}
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
                            <CalendarDays className="w-3.5 h-3.5" />
                            {new Date(order.purchase_time).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </p>
                    </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto border-t border-slate-50 pt-3 sm:border-t-0 sm:pt-0">
                    <div className="text-left sm:text-right">
                        <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold mb-0.5">Total</p>
                        <p className="text-sm font-bold text-slate-900">₹{order.total_amount.toLocaleString()}</p>
                    </div>
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 px-2 text-xs font-medium text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg"
                        onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
                    >
                        {isExpanded ? (
                            <span className="flex items-center gap-1">Close <ChevronUp className="w-3.5 h-3.5" /></span>
                        ) : (
                            <span className="flex items-center gap-1">Products <ChevronDown className="w-3.5 h-3.5" /></span>
                        )}
                    </Button>
                </div>
            </div>

            {/* Expandable Details Area */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                        className="overflow-hidden border-t border-slate-50 bg-slate-50/50"
                    >
                        <div className="p-4 sm:p-6">
                            {/* Actions Header */}
                            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
                                <span className="text-xs font-semibold text-slate-800 tracking-wide uppercase">Order Status</span>
                                <Button asChild variant="outline" size="sm" className="h-7 px-3 text-[10px] font-semibold rounded-md border-slate-200">
                                    <Link href={`/orders/${order.id}`} className="flex items-center gap-1.5">
                                        Full Details <ExternalLink className="w-3 h-3" />
                                    </Link>
                                </Button>
                            </div>

                            {/* Minimal Timeline */}
                            <div className="mb-6 transform scale-[0.85] sm:scale-90 origin-top-left -ml-2">
                                <OrderStatusTimeline currentStatus={order.status} />
                            </div>

                            {/* Product List Grid */}
                            <h4 className="text-xs font-semibold text-slate-400 tracking-widest uppercase mb-3">Items ({order.resolved_order_items?.length || 0})</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {order.resolved_order_items?.map((item) => (
                                    <div key={item.id} className="flex gap-3 p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                                        <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-slate-50 flex-shrink-0 border border-slate-50">
                                            <Image
                                                src={getPublicUrlFromPath(item.products?.product_photo_urls?.[0])}
                                                alt={item.products?.product_name || "Product"}
                                                fill className="object-cover"
                                            />
                                        </div>
                                        <div className="flex flex-col justify-center flex-grow min-w-0">
                                            <p className="text-xs font-semibold text-slate-900 line-clamp-1 mb-0.5">
                                                {item.products?.product_name}
                                            </p>
                                            <div className="flex items-center justify-between">
                                                <p className="text-[10px] text-slate-500 font-medium">Qty: {item.quantity}</p>
                                                <p className="text-xs font-semibold text-slate-900">₹{(item.unit_price * item.quantity).toLocaleString()}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

// =========================================================================
//                             MAIN PAGE COMPONENT
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
            toast({ title: "Authentication Required", description: "Please log in.", variant: "destructive" })
            router.push("/login")
            return
        }

        const userId = session.user.id

        const { data: ordersWithItems, error: ordersError } = await supabase
            .from("orders")
            .select(`*, order_items (*, products (*))`)
            .eq("user_id", userId)
            .order("purchase_time", { ascending: false })

        if (ordersError) {
            setError("Failed to load orders.")
            setOrders([])
            setLoading(false)
            return
        }

        const resolvedOrders: Order[] = (ordersWithItems || []).map((order: any) => ({
            ...order,
            resolved_order_items: order.order_items.map((item: any) => ({
                ...item,
                products: item.products
            }))
        }))

        setOrders(resolvedOrders)
        setLoading(false)
    }, [router, toast])

    useEffect(() => {
        fetchOrders()
        const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!session) router.push("/login"); else fetchOrders();
        })

        const orderChannel = supabase.channel('customer_order_status').on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'orders' },
            (payload) => {
                const updatedStatus = payload.new.status as string;
                const updatedId = payload.new.id as string;
                setOrders(prev => prev.map(order => order.id === updatedId ? { ...order, status: updatedStatus } : order));
            }
        ).subscribe();

        return () => {
            authListener.subscription.unsubscribe();
            supabase.removeChannel(orderChannel);
        }
    }, [fetchOrders, router])

    const filteredOrders = orders.filter((order) => {
        return order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
               order.resolved_order_items?.some((item) =>
                   item.products?.product_name.toLowerCase().includes(searchTerm.toLowerCase()),
               )
    })

    if (error) {
        return (
            <div className="min-h-screen flex flex-col bg-slate-50 font-poppins">
                <Header showSearchBar={false} />
                <main className="flex-grow container mx-auto px-4 py-8">
                    <div className="bg-red-50 text-red-600 text-sm p-4 rounded-xl border border-red-100 text-center">
                        <span className="font-semibold">Error:</span> {error}
                    </div>
                </main>
                <Footer />
            </div>
        )
    }

    return (
        <div className="min-h-screen flex flex-col bg-[#fafafa] font-poppins selection:bg-slate-200">
            <Header showSearchBar={false} />
            
            <main className="flex-grow container mx-auto px-4 sm:px-6 py-8 sm:py-12 max-w-4xl">
                {/* Minimal Header */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4 border-b border-slate-200 pb-6">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight mb-1">My Orders</h1>
                        <p className="text-xs sm:text-sm text-slate-500 font-medium">Manage and track your recent purchases.</p>
                    </div>
                    {!loading && (
                        <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm self-start sm:self-auto text-xs font-semibold text-slate-600">
                            {orders.length} Total Orders
                        </div>
                    )}
                </div>

                {/* Search Bar */}
                <div className="relative mb-6">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <Input
                        type="text"
                        placeholder="Search by order ID or product..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 h-11 border-slate-200 bg-white rounded-xl w-full focus:ring-slate-900 focus:border-slate-900 text-sm shadow-sm"
                    />
                </div>

                {/* Feed */}
                {loading ? (
                    <div className="space-y-4">
                        <OrderSkeleton />
                        <OrderSkeleton />
                        <OrderSkeleton />
                    </div>
                ) : filteredOrders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-slate-200">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                            <ShoppingBag className="w-6 h-6 text-slate-300" />
                        </div>
                        <p className="text-sm font-semibold mb-1 text-slate-800">No orders found</p>
                        <p className="text-xs text-slate-500 mb-6 text-center max-w-xs">
                            {searchTerm ? "No orders match your search criteria." : "You haven't placed any orders yet."}
                        </p>
                        <Button asChild variant="outline" className="h-9 px-6 text-xs font-semibold rounded-lg">
                            <Link href="/shop">Browse Shop</Link>
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-4 pb-20">
                        {filteredOrders.map((order) => (
                            <OrderCard key={order.id} order={order} />
                        ))}
                    </div>
                )}
            </main>
            <Footer />
        </div>
    )
}