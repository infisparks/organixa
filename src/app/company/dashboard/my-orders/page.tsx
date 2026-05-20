"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { getPublicUrlFromPath } from "@/lib/image-utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
    Loader2, Phone, CalendarDays, Search,
    Truck, Box, MapPin, ShoppingCart, RefreshCw, 
    CheckCircle2, XCircle, CreditCard, PackageCheck, AlertCircle
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"

// =========================================================================
//                             TYPE DEFINITIONS
// =========================================================================

interface OrderItem {
    id: string
    product_id: string
    quantity: number
    unit_price: number
}

interface ProductDetailsForOrder {
    product_name: string
    product_photo_urls: string[]
    company_id: string
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
//                             CONSTANTS & HELPERS
// =========================================================================

const proTimelineSteps = [
    { label: "Confirmed", icon: ShoppingCart, status: "confirmed" },
    { label: "Processing", icon: RefreshCw, status: "processing" },
    { label: "Packed", icon: Box, status: "packed" },
    { label: "Shipped", icon: Truck, status: "shipped" },
    { label: "Delivered", icon: MapPin, status: "delivered" },
]

const statusOrder = ["confirmed", "processing", "packed", "shipped", "delivered"]

const getStatusBadgeClass = (status: string) => {
    switch (status.toLowerCase()) {
        case "pending": return "bg-amber-100 text-amber-800 border-amber-200";
        case "confirmed": return "bg-blue-100 text-blue-800 border-blue-200";
        case "processing": return "bg-indigo-100 text-indigo-800 border-indigo-200";
        case "packed": return "bg-teal-100 text-teal-800 border-teal-200";
        case "shipped": return "bg-purple-100 text-purple-800 border-purple-200";
        case "delivered": return "bg-emerald-100 text-emerald-800 border-emerald-200";
        case "cancelled": return "bg-red-100 text-red-800 border-red-200";
        default: return "bg-slate-100 text-slate-800 border-slate-200";
    }
};

// =========================================================================
//                             MODAL COMPONENT
// =========================================================================

interface UpdateStatusModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentOrder: Order;
    onUpdate: (orderId: string, newStatus: string) => void;
    isLoading: boolean;
}

const UpdateStatusModal: React.FC<UpdateStatusModalProps> = ({ isOpen, onClose, currentOrder, onUpdate, isLoading }) => {
    const currentStatusIndex = statusOrder.indexOf(currentOrder.status);
    const availableSteps = proTimelineSteps.filter((step) => statusOrder.indexOf(step.status) > currentStatusIndex);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md w-[95vw] rounded-xl p-0 overflow-hidden border-slate-200 shadow-xl font-sans">
                <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100 bg-white">
                    <DialogTitle className="text-lg font-semibold text-slate-900">Update Order Status</DialogTitle>
                    <DialogDescription className="text-sm mt-1">
                        Advance order <span className="font-mono font-medium text-slate-900 bg-slate-100 px-1 py-0.5 rounded">#{currentOrder.id.substring(0, 8).toUpperCase()}</span> to the next stage.
                    </DialogDescription>
                </DialogHeader>
                <div className="p-6 bg-slate-50 flex flex-col gap-3">
                    {availableSteps.length > 0 ? (
                        availableSteps.map((step) => (
                            <Button
                                key={step.status}
                                onClick={() => onUpdate(currentOrder.id, step.status)}
                                disabled={isLoading}
                                className="w-full justify-between bg-white border border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50/50 h-14 rounded-xl transition-all shadow-sm"
                                variant="outline"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin text-slate-500" /> : <step.icon className="h-4 w-4 text-slate-500" />}
                                    </div>
                                    <span className="font-semibold text-sm">Mark as {step.label}</span>
                                </div>
                                <div className="w-6 h-6 rounded-full bg-slate-50 flex items-center justify-center">
                                    <CheckCircle2 className="h-4 w-4 text-slate-300" />
                                </div>
                            </Button>
                        ))
                    ) : (
                        <div className="text-center py-8 bg-white rounded-xl border border-dashed border-slate-200">
                            <PackageCheck className="w-8 h-8 mx-auto text-emerald-400 mb-2" />
                            <p className="text-sm font-medium text-slate-900">Order is fully processed</p>
                            <p className="text-xs text-slate-500 mt-1">No further status updates required.</p>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

// =========================================================================
//                             MAIN COMPONENT
// =========================================================================

export default function CompanyMyOrdersPage() {
    const [orders, setOrders] = useState<Order[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState("")
    const [isUpdating, setIsUpdating] = useState(false)
    const [modalOpen, setModalOpen] = useState(false)
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
    const router = useRouter()
    const { toast } = useToast()

    const fetchCompanyOrders = useCallback(async () => {
        setLoading(true)
        setError(null)

        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        if (sessionError || !session) {
            router.push("/login")
            return
        }

        const userId = session.user.id
        const { data: companyData, error: companyError } = await supabase
            .from("companies")
            .select("id")
            .eq("user_id", userId)
            .maybeSingle()

        if (companyError || !companyData) {
            setError("Company record not found.")
            setLoading(false)
            return
        }

        const companyId = companyData.id
        const { data: ordersWithItems, error: fetchError } = await supabase
            .from("orders")
            .select(`*, order_items!inner (*, products!inner (*))`)
            .eq("order_items.products.company_id", companyId)
            .order("purchase_time", { ascending: false })

        if (fetchError) {
            setError("Failed to load orders.")
            setLoading(false)
            return
        }

        const resolvedOrders = (ordersWithItems || []).map((order: any) => ({
            ...order,
            resolved_order_items: order.order_items.map((item: any) => ({
                ...item,
                products: item.products
            }))
        }))

        setOrders(resolvedOrders)
        setLoading(false)
    }, [router])

    useEffect(() => {
        fetchCompanyOrders()

        const orderChannel = supabase.channel('order_status_updates').on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'orders' },
            (payload) => {
                setOrders(prevOrders => prevOrders.map(order =>
                    order.id === payload.new.id ? { ...order, status: payload.new.status } : order
                ));
            }
        ).subscribe();

        return () => { supabase.removeChannel(orderChannel); }
    }, [fetchCompanyOrders])

    const handleStatusUpdate = async (orderId: string, newStatus: string) => {
        setIsUpdating(true);
        try {
            const { error: updateError } = await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
            if (updateError) throw updateError;

            toast({ title: "Status Updated", description: `Order moved to ${newStatus}.` });
            setModalOpen(false);
            setOrders(prevOrders => prevOrders.map(order => order.id === orderId ? { ...order, status: newStatus } : order));
        } catch (error) {
            toast({ title: "Update Failed", description: "Could not update order status.", variant: "destructive" });
        } finally {
            setIsUpdating(false);
        }
    };

    // --- Search & Filtering ---
    const filteredOrders = orders.filter((order) => {
        const search = searchTerm.toLowerCase();
        return (
            order.id.toLowerCase().includes(search) ||
            order.customer_name.toLowerCase().includes(search) ||
            order.primary_phone.includes(search) ||
            order.resolved_order_items?.some(item => item.products?.product_name.toLowerCase().includes(search))
        )
    })

    // --- Metrics Calculations ---
    const totalOrders = filteredOrders.length;
    const deliveredOrders = filteredOrders.filter(o => o.status === 'delivered').length;
    const activeOrders = filteredOrders.filter(o => !['delivered', 'cancelled'].includes(o.status)).length;
    const totalRevenue = filteredOrders
        .filter(o => o.status !== 'cancelled')
        .reduce((acc, order) => acc + order.total_amount, 0);


    if (loading) {
        return (
            <div className="flex flex-col min-h-screen items-center justify-center bg-[#f8f9fa]">
                <Loader2 className="h-6 w-6 animate-spin text-slate-800" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#f8f9fa] font-sans text-slate-900 pb-20">
            
            {/* Header */}
            <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
                    <div>
                        <h1 className="text-lg font-semibold tracking-tight text-slate-900">Order Management</h1>
                        <p className="text-xs text-slate-500 font-medium hidden sm:block">Track and fulfill your customer orders.</p>
                    </div>
                    <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-full">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span className="text-xs font-semibold text-emerald-700">Live Sync</span>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <Card className="rounded-xl border-slate-200 shadow-sm bg-white">
                        <CardContent className="p-4 sm:p-5 flex flex-col justify-between h-full">
                            <div className="flex justify-between items-start mb-2">
                                <p className="text-xs sm:text-sm font-medium text-slate-500">Total Orders</p>
                                <ShoppingCart className="h-4 w-4 text-slate-400" />
                            </div>
                            <h3 className="text-2xl font-semibold text-slate-900">{totalOrders}</h3>
                        </CardContent>
                    </Card>

                    <Card className="rounded-xl border-slate-200 shadow-sm bg-white">
                        <CardContent className="p-4 sm:p-5 flex flex-col justify-between h-full">
                            <div className="flex justify-between items-start mb-2">
                                <p className="text-xs sm:text-sm font-medium text-slate-500">Active (Pending)</p>
                                <RefreshCw className="h-4 w-4 text-blue-400" />
                            </div>
                            <h3 className="text-2xl font-semibold text-slate-900">{activeOrders}</h3>
                        </CardContent>
                    </Card>

                    <Card className="rounded-xl border-slate-200 shadow-sm bg-white">
                        <CardContent className="p-4 sm:p-5 flex flex-col justify-between h-full">
                            <div className="flex justify-between items-start mb-2">
                                <p className="text-xs sm:text-sm font-medium text-slate-500">Completed</p>
                                <PackageCheck className="h-4 w-4 text-emerald-400" />
                            </div>
                            <h3 className="text-2xl font-semibold text-slate-900">{deliveredOrders}</h3>
                        </CardContent>
                    </Card>

                    <Card className="rounded-xl border-slate-200 shadow-sm bg-white">
                        <CardContent className="p-4 sm:p-5 flex flex-col justify-between h-full">
                            <div className="flex justify-between items-start mb-2">
                                <p className="text-xs sm:text-sm font-medium text-slate-500">Revenue (Gross)</p>
                                <CreditCard className="h-4 w-4 text-slate-400" />
                            </div>
                            <h3 className="text-2xl font-semibold text-slate-900">₹{totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                        </CardContent>
                    </Card>
                </div>

                {/* Toolbar */}
                <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
                    <div className="relative w-full sm:w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                        <Input
                            placeholder="Search by Order ID, Customer, or Phone..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 h-10 rounded-lg bg-white border-slate-200 text-sm focus:border-slate-400 focus:ring-0 shadow-sm w-full"
                        />
                    </div>
                </div>

                {/* Orders List */}
                <div className="space-y-4">
                    {filteredOrders.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-200">
                            <Search className="w-10 h-10 mx-auto mb-4 text-slate-300" />
                            <h3 className="text-base font-semibold text-slate-900">No Orders Found</h3>
                            <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">We couldn't find any orders matching your search criteria. Try adjusting your filters.</p>
                        </div>
                    ) : (
                        filteredOrders.map((order) => (
                            <Card key={order.id} className="rounded-xl border-slate-200 shadow-sm overflow-hidden bg-white">
                                
                                {/* Order Header */}
                                <div className="bg-white border-b border-slate-100 px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-3 mb-1">
                                            <span className="text-base font-semibold text-slate-900 tracking-tight">
                                                Order #{order.id.substring(0, 8).toUpperCase()}
                                            </span>
                                            <Badge variant="outline" className={`px-2 py-0.5 text-xs font-semibold uppercase tracking-wider rounded-md border ${getStatusBadgeClass(order.status)}`}>
                                                {order.status}
                                            </Badge>
                                        </div>
                                        <span className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
                                            <CalendarDays className="w-3.5 h-3.5" />
                                            Placed on {new Date(order.purchase_time).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>

                                    {order.status !== 'delivered' && order.status !== 'cancelled' && (
                                        <Button 
                                            variant="default" 
                                            onClick={() => { setSelectedOrder(order); setModalOpen(true); }}
                                            className="h-9 px-4 text-xs font-medium bg-slate-900 text-white hover:bg-slate-800 rounded-lg shadow-sm w-full sm:w-auto"
                                        >
                                            <RefreshCw className="w-3.5 h-3.5 mr-2" /> Update Status
                                        </Button>
                                    )}
                                </div>

                                <CardContent className="p-0">
                                    <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-slate-100">
                                        
                                        {/* Shipping Info */}
                                        <div className="md:col-span-4 p-4 sm:p-6 bg-slate-50/30">
                                            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                                                <MapPin className="w-4 h-4 text-slate-400" /> Customer Details
                                            </h4>
                                            <div className="text-sm text-slate-600 space-y-1">
                                                <p className="font-semibold text-slate-900">{order.customer_name}</p>
                                                <p>{order.house_number}, {order.street}</p>
                                                <p>{order.area}</p>
                                                <p>{order.city}, {order.state} - {order.pincode}</p>
                                                <div className="flex items-center gap-2 mt-3 text-slate-900 font-medium">
                                                    <Phone className="w-4 h-4 text-slate-400" /> {order.primary_phone}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Order Items */}
                                        <div className="md:col-span-8 p-4 sm:p-6 flex flex-col">
                                            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                                                <Box className="w-4 h-4 text-slate-400" /> Items Summary
                                            </h4>
                                            <div className="space-y-3 flex-grow">
                                                {order.resolved_order_items?.map((item) => (
                                                    <div key={item.id} className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-md overflow-hidden bg-slate-100 border border-slate-200 flex-shrink-0">
                                                            <img
                                                                src={getPublicUrlFromPath(item.products?.product_photo_urls?.[0]) || "/placeholder.svg"}
                                                                alt={item.products?.product_name}
                                                                className="object-cover w-full h-full"
                                                            />
                                                        </div>
                                                        <div className="flex-grow min-w-0">
                                                            <p className="text-sm font-medium text-slate-900 truncate">{item.products?.product_name}</p>
                                                            <p className="text-xs text-slate-500 mt-0.5">Qty: {item.quantity} × ₹{item.unit_price}</p>
                                                        </div>
                                                        <span className="text-sm font-semibold text-slate-900 flex-shrink-0">
                                                            ₹{(item.unit_price * item.quantity).toFixed(2)}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                            
                                            {/* Subtotal & Timeline Footer */}
                                            <div className="mt-6 pt-4 border-t border-slate-100">
                                                <div className="flex justify-between items-center mb-6">
                                                    <span className="text-sm font-semibold text-slate-500">Total Amount</span>
                                                    <span className="text-lg font-bold text-slate-900">
                                                        ₹{order.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </span>
                                                </div>

                                                {/* Clean Horizontal Timeline */}
                                                <div className="relative">
                                                    <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-slate-100 -translate-y-1/2 -z-0" />
                                                    <div className="flex justify-between relative z-10">
                                                        {proTimelineSteps.map((step) => {
                                                            const currentStatusIdx = statusOrder.indexOf(order.status)
                                                            const thisStepIdx = statusOrder.indexOf(step.status)
                                                            const isCompleted = thisStepIdx <= currentStatusIdx
                                                            const isActive = thisStepIdx === currentStatusIdx

                                                            return (
                                                                <div key={step.label} className="flex flex-col items-center gap-2">
                                                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all border-2 bg-white ${
                                                                        isCompleted ? "border-emerald-500" : "border-slate-200"
                                                                        } ${isActive ? "ring-4 ring-emerald-50" : ""}`}>
                                                                        {isCompleted ? (
                                                                          <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                                                        ) : null}
                                                                    </div>
                                                                    <span className={`text-[10px] font-semibold uppercase tracking-wider hidden sm:block ${
                                                                        isActive ? "text-slate-900" : isCompleted ? "text-slate-600" : "text-slate-400"
                                                                        }`}>
                                                                        {step.label}
                                                                    </span>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                </div>

                                            </div>
                                        </div>

                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            </div>

            {selectedOrder && (
                <UpdateStatusModal
                    isOpen={modalOpen}
                    onClose={() => setModalOpen(false)}
                    currentOrder={selectedOrder}
                    onUpdate={handleStatusUpdate}
                    isLoading={isUpdating}
                />
            )}
        </div>
    );
}