"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { getPublicUrlFromPath } from "@/lib/image-utils"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { Button } from "@/components/ui/button"
import {
    Loader2, ArrowLeft, Printer, MapPin, 
    Phone, CalendarDays, Box, CreditCard, CheckCircle2,
    Truck, RefreshCw, ShoppingCart, Info
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"

// =========================================================================
//                             TYPE DEFINITIONS
// =========================================================================

interface OrderItem {
    id: string
    product_id: string
    quantity: number
    unit_price: number
    total_price?: number
}

interface ProductDetailsForOrder {
    product_name: string
    product_photo_urls: string[]
    company: { company_name: string } | null
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
    country: string
    state: string
    city: string
    pincode: string
    area: string | null
    street: string | null
    house_number: string | null
    order_items: OrderItem[]
    resolved_order_items?: OrderItemWithProduct[]
    payment_method?: string | null
    payment_status?: string | null
}

// =========================================================================
//                             HELPERS
// =========================================================================

const timelineSteps = [
    { label: "Confirmed", icon: ShoppingCart, status: "confirmed" },
    { label: "Processing", icon: RefreshCw, status: "processing" },
    { label: "Packed", icon: Box, status: "packed" },
    { label: "Shipped", icon: Truck, status: "shipped" },
    { label: "Delivered", icon: MapPin, status: "delivered" },
]

const statusOrder = ["confirmed", "processing", "packed", "shipped", "delivered"]

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
//                             MAIN COMPONENT
// =========================================================================

export default function OrderDetailsPage() {
    const params = useParams()
    const router = useRouter()
    const { toast } = useToast()
    
    const [order, setOrder] = useState<Order | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [downloadLoading, setDownloadLoading] = useState(false)
    const [cancelling, setCancelling] = useState(false)

    const handleCancelOrder = async () => {
        if (!order) return;
        if (!confirm("Are you sure you want to cancel this order?")) return;

        setCancelling(true);
        try {
            const { error: cancelError } = await supabase
                .from("orders")
                .update({ status: "cancelled" })
                .eq("id", order.id);

            if (cancelError) throw cancelError;

            setOrder(prev => prev ? { ...prev, status: "cancelled" } : null);
            toast({
                title: "Order Cancelled",
                description: "Your order has been cancelled successfully.",
            });
        } catch (err: any) {
            console.error("Cancellation error:", err);
            toast({
                title: "Error",
                description: err.message || "Failed to cancel order.",
                variant: "destructive",
            });
        } finally {
            setCancelling(false);
        }
    };

    const handleDownloadPDF = async () => {
        if (!order) return;
        const invoiceElement = document.getElementById("invoice-container");
        if (!invoiceElement) return;

        setDownloadLoading(true);
        try {
            const html2canvas = (await import("html2canvas")).default;
            const jsPDF = (await import("jspdf")).default;

            const originalGetComputedStyle = window.getComputedStyle;
            
            const resolveColorToStandard = (colorStr: string): string => {
                if (!colorStr) return colorStr;
                if (!colorStr.includes("oklch") && !colorStr.includes("lab")) return colorStr;
                try {
                    const canvas = document.createElement("canvas");
                    canvas.width = 1;
                    canvas.height = 1;
                    const ctx = canvas.getContext("2d");
                    if (ctx) {
                        ctx.fillStyle = colorStr;
                        return ctx.fillStyle; 
                    }
                } catch (e) {
                    console.error("Color conversion failed:", e);
                }
                return "rgb(255, 255, 255)"; 
            };

            window.getComputedStyle = (elt, pseudoElt) => {
                const style = originalGetComputedStyle(elt, pseudoElt);
                return new Proxy(style, {
                    get(target, prop) {
                        const val = target[prop as keyof CSSStyleDeclaration];
                        if (typeof val === "string" && (val.includes("oklch") || val.includes("lab"))) {
                            return resolveColorToStandard(val);
                        }
                        return typeof val === "function" ? val.bind(target) : val;
                    }
                }) as unknown as CSSStyleDeclaration;
            };

            let canvas;
            try {
                canvas = await html2canvas(invoiceElement, {
                    scale: 2,
                    useCORS: true,
                    logging: false,
                    backgroundColor: "#ffffff",
                    windowWidth: invoiceElement.scrollWidth,
                    windowHeight: invoiceElement.scrollHeight
                });
            } finally {
                window.getComputedStyle = originalGetComputedStyle;
            }

            const imgData = canvas.toDataURL("image/png");
            const pdf = new jsPDF("p", "mm", "a4");
            const imgWidth = 210;
            const pageHeight = 297;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;

            while (heightLeft >= 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }

            pdf.save(`invoice_${order.id.substring(0, 12)}.pdf`);
        } catch (err) {
            console.error("Error generating PDF:", err);
        } finally {
            setDownloadLoading(false);
        }
    };

    useEffect(() => {
        const fetchOrderDetails = async () => {
            if (!params.id) return;
            setLoading(true);
            setError(null);

            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
                router.push("/login")
                return
            }

            try {
                const { data, error: fetchError } = await supabase
                    .from("orders")
                    .select(`
                        *,
                        order_items (*, products (*, company:companies(company_name)))
                    `)
                    .eq("id", params.id)
                    .single()

                if (fetchError) throw fetchError

                const resolvedOrder: Order = {
                    ...data,
                    resolved_order_items: data.order_items.map((item: any) => ({
                        ...item,
                        products: item.products
                    }))
                }

                setOrder(resolvedOrder)
            } catch (err: any) {
                console.error("Error fetching order:", err)
                setError("Order not found or you do not have permission to view it.")
            } finally {
                setLoading(false)
            }
        }

        fetchOrderDetails()
    }, [params.id, router])

    const handlePrint = () => {
        window.print();
    }

    if (loading) {
        return (
            <div className="flex flex-col min-h-screen items-center justify-center bg-[#fafafa]">
                <Loader2 className="h-8 w-8 animate-spin text-slate-800 mb-4" />
                <p className="text-xs font-bold tracking-widest uppercase text-slate-500">Retrieving Order...</p>
            </div>
        )
    }

    if (error || !order) {
        return (
            <div className="min-h-screen bg-[#fafafa] flex flex-col items-center justify-center p-4">
                <Info className="w-12 h-12 text-slate-300 mb-4" />
                <h1 className="text-lg font-semibold text-slate-900 mb-2">Order Not Found</h1>
                <p className="text-sm text-slate-500 mb-6">{error || "The link might be broken or expired."}</p>
                <Button asChild variant="outline" className="h-10 px-6 rounded-lg text-xs font-medium">
                    <Link href="/orders">Return to My Orders</Link>
                </Button>
            </div>
        )
    }

    // --- ACCURATE MATH CALCULATIONS ---
    const subtotal = (order.resolved_order_items || []).reduce((sum, item) => {
        return sum + (Number(item.unit_price) * Number(item.quantity))
    }, 0)
    
    const grandTotal = Number(order.total_amount)
    
    // Dynamic Shipping Calculation: If DB total is 349 and items are 250, shipping is 99.
    const calculatedShipping = grandTotal - subtotal
    const shipping = calculatedShipping > 0 ? calculatedShipping : 0

    return (
        <div className="min-h-screen bg-[#fafafa] font-sans selection:bg-slate-200 pb-20">
            {/* Hide Header on Print */}
            <div className="print:hidden">
                <Header showSearchBar={false} />
            </div>

            <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 print:p-0 print:m-0 print:max-w-none">
                
                {/* Top Actions (Hidden on Print) */}
                <div className="print:hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <Button variant="ghost" asChild className="h-9 px-3 -ml-3 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg text-xs font-medium">
                        <Link href="/orders"><ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Orders</Link>
                    </Button>
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                        {(order.status === "confirmed" || order.status === "processing" || order.status === "pending") && (
                            <Button 
                                onClick={handleCancelOrder}
                                disabled={cancelling}
                                variant="destructive"
                                className="h-9 px-5 rounded-lg text-xs font-semibold shadow-sm w-full sm:w-auto flex items-center justify-center gap-2"
                            >
                                {cancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                                Cancel Order
                            </Button>
                        )}
                        <Button 
                            onClick={handleDownloadPDF} 
                            disabled={downloadLoading}
                            className="h-9 px-5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-medium shadow-sm flex items-center justify-center gap-2 w-full sm:w-auto"
                        >
                            {downloadLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-download"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                            )}
                            {downloadLoading ? "Generating PDF..." : "Download Invoice"}
                        </Button>
                        <Button onClick={handlePrint} variant="outline" className="h-9 px-5 border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-medium shadow-sm w-full sm:w-auto flex items-center justify-center gap-2">
                            <Printer className="w-4 h-4" /> Print Invoice
                        </Button>
                    </div>
                </div>

                {/* Printable Invoice Container */}
                <div id="invoice-container" className="bg-white rounded-2xl shadow-sm border border-slate-200 print:shadow-none print:border-none print:rounded-none overflow-hidden">
                    
                    {/* Invoice Header */}
                    <div className="p-6 sm:p-8 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start gap-4 bg-slate-50/50 print:bg-transparent print:border-b-2 print:border-slate-800">
                        <div>
                            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Order Invoice</h1>
                            <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                <span className="text-sm font-mono font-semibold text-slate-600 uppercase">#{order.id.substring(0, 12)}</span>
                                <Badge className={`px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded ${getStatusBadgeClass(order.status)} print:border-slate-300 print:text-slate-800`}>
                                    {order.status}
                                </Badge>
                                <Badge className={`px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded ${
                                    order.payment_method === 'cod' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-purple-50 text-purple-700 border-purple-200'
                                } print:border-slate-300 print:text-slate-800`}>
                                    {order.payment_method === 'cod' ? 'COD' : 'ONLINE'}
                                </Badge>
                            </div>
                        </div>
                        <div className="text-left sm:text-right mt-2 sm:mt-0">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Purchased On</p>
                            <p className="text-sm font-medium text-slate-800 flex items-center gap-1.5 sm:justify-end">
                                <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                                {new Date(order.purchase_time).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </p>
                        </div>
                    </div>

                    {/* Order Status Timeline (Hidden on Print) */}
                    {order.status !== 'cancelled' && (
                        <div className="p-6 sm:p-8 border-b border-slate-100 print:hidden bg-white">
                            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-5">Order Tracking</h3>
                            <div className="relative max-w-2xl mx-auto">
                                <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-slate-100 -translate-y-1/2 -z-0" />
                                <div className="flex justify-between relative z-10">
                                    {timelineSteps.map((step) => {
                                        const currentStatusIdx = statusOrder.indexOf(order.status)
                                        const thisStepIdx = statusOrder.indexOf(step.status)
                                        const isCompleted = thisStepIdx <= currentStatusIdx
                                        const isActive = thisStepIdx === currentStatusIdx

                                        return (
                                            <div key={step.label} className="flex flex-col items-center gap-2">
                                                <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all border-2 bg-white ${
                                                    isCompleted ? "border-emerald-500 text-emerald-500" : "border-slate-200 text-slate-300"
                                                    } ${isActive ? "ring-4 ring-emerald-50 shadow-sm scale-110" : ""}`}>
                                                    {isCompleted ? <CheckCircle2 className="w-3.5 h-3.5" /> : <step.icon className="w-3 h-3" />}
                                                </div>
                                                <span className={`text-[9px] font-bold uppercase tracking-wider hidden sm:block ${
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
                    )}

                    {/* Main Details Grid */}
                    <div className="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-2 gap-8 border-b border-slate-100 bg-white">
                        
                        {/* Shipping details */}
                        <div>
                            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                <MapPin className="w-3 h-3" /> Shipping Information
                            </h3>
                            <div className="text-sm text-slate-600 leading-relaxed bg-slate-50/50 p-4 rounded-xl border border-slate-100 print:border-none print:p-0 print:bg-transparent">
                                <p className="text-sm font-bold text-slate-900 mb-1">{order.customer_name}</p>
                                <p>{order.house_number}, {order.street}</p>
                                <p>{order.area}</p>
                                <p>{order.city}, {order.state} - <span className="font-semibold text-slate-900">{order.pincode}</span></p>
                                <p>{order.country}</p>
                                
                                <div className="mt-3 pt-3 border-t border-slate-200/60 print:border-slate-300">
                                    <p className="text-xs font-medium text-slate-800 flex items-center gap-2">
                                        <Phone className="w-3.5 h-3.5 text-slate-400" /> {order.primary_phone}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Payment / Summary details */}
                        <div>
                            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                <CreditCard className="w-3 h-3" /> Payment Breakdown
                            </h3>
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 print:border-none print:p-0 print:bg-transparent">
                                <div className="space-y-2.5 text-sm">
                                    <div className="flex justify-between items-center text-slate-600">
                                        <span>Item Subtotal</span>
                                        <span className="font-medium text-slate-900">₹{subtotal.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-slate-600">
                                        <span>Shipping & Handling</span>
                                        <span className="font-medium text-slate-900">{shipping === 0 ? "Free" : `₹${shipping.toFixed(2)}`}</span>
                                    </div>
                                    <div className="pt-3 mt-3 border-t border-slate-200 flex justify-between items-center">
                                        <span className="font-bold text-slate-900 text-base">Grand Total</span>
                                        <span className="text-lg font-black text-purple-700 tracking-tight">₹{grandTotal.toFixed(2)}</span>
                                    </div>
                                </div>
                                <Separator className="my-3" />
                                <div className="space-y-1.5 text-xs text-slate-600">
                                    <div className="flex justify-between">
                                        <span>Payment Method:</span>
                                        <span className="font-semibold text-slate-800">
                                            {order.payment_method === 'cod' ? 'Cash on Delivery (COD)' : order.payment_method === 'razorpay' ? 'Online Payment (Razorpay)' : 'Online Payment'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span>Payment Status:</span>
                                        {order.payment_method === 'cod' ? (
                                            order.status === 'delivered' || order.payment_status === 'paid' ? (
                                                <span className="text-[9px] uppercase tracking-wider bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-bold">Paid (Collected)</span>
                                            ) : (
                                                <span className="text-[9px] uppercase tracking-wider bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded font-bold">Pay on Delivery</span>
                                            )
                                        ) : (
                                            order.payment_status === 'paid' ? (
                                                <span className="text-[9px] uppercase tracking-wider bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-bold">Paid Successfully</span>
                                            ) : (
                                                <span className="text-[9px] uppercase tracking-wider bg-red-50 text-red-700 px-1.5 py-0.5 rounded font-bold">Pending Payment</span>
                                            )
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Products List */}
                    <div className="p-6 sm:p-8 bg-white">
                        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                            <Box className="w-3 h-3" /> Purchased Items
                        </h3>
                        
                        <div className="overflow-x-auto rounded-xl border border-slate-100 print:border-none">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/80 border-b border-slate-100 print:bg-transparent print:border-slate-800">
                                        <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Product</th>
                                        <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Qty</th>
                                        <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Price</th>
                                        <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {/* FIX APPLIED HERE: Explicitly typed to avoid 'never' error */}
                                    {(order.resolved_order_items || []).map((item: OrderItemWithProduct) => {
                                        const itemTotal = Number(item.unit_price) * Number(item.quantity);
                                        return (
                                            <tr key={item.id} className="group hover:bg-slate-50/50 transition-colors print:hover:bg-transparent">
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded border border-slate-200 bg-white overflow-hidden flex-shrink-0 print:hidden">
                                                            <img
                                                                src={getPublicUrlFromPath(item.products?.product_photo_urls?.[0])}
                                                                alt={item.products?.product_name || "Product"}
                                                                className="w-full h-full object-cover"
                                                            />
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-bold text-slate-900">{item.products?.product_name}</p>
                                                            {item.products?.company && (
                                                                <p className="text-[9px] font-semibold text-slate-500 uppercase mt-0.5 tracking-wider">
                                                                    By: {item.products.company.company_name}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-center text-xs font-medium text-slate-700">
                                                    {item.quantity}
                                                </td>
                                                <td className="px-4 py-3 text-right text-xs font-medium text-slate-700">
                                                    ₹{Number(item.unit_price).toFixed(2)}
                                                </td>
                                                <td className="px-4 py-3 text-right text-xs font-bold text-slate-900">
                                                    ₹{itemTotal.toFixed(2)}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Print Footer Details */}
                    <div className="px-6 py-4 bg-slate-900 text-slate-300 text-[10px] font-medium tracking-wide text-center uppercase print:bg-transparent print:text-slate-500 print:border-t print:border-slate-800">
                        Thank you for your order! Contact support for any assistance.
                    </div>

                </div>
            </main>

            {/* Hide Footer on Print */}
            <div className="print:hidden">
                <Footer />
            </div>
        </div>
    )
}