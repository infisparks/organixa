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
    payment_method?: string | null
    payment_status?: string | null
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
//                             SHIPPING LABEL / DELIVERY INVOICE COMPONENT
// =========================================================================

interface ShippingLabelModalProps {
    isOpen: boolean;
    onClose: () => void;
    order: Order;
    company: {
        company_name: string;
        company_address: string;
        mobile_number: string;
        email: string;
        gst_number: string;
    } | null;
}

const BarcodeSVG = ({ value }: { value: string }) => {
    const chars = value.split("");
    return (
        <svg viewBox="0 0 100 20" className="w-full h-8" preserveAspectRatio="none">
            {chars.map((char, index) => {
                const width = (char.charCodeAt(0) % 3) + 1;
                const gap = (char.charCodeAt(0) % 2) + 1;
                return (
                    <rect
                        key={index}
                        x={index * 6}
                        y="0"
                        width={width}
                        height="20"
                        fill="black"
                    />
                );
            })}
        </svg>
    );
};

const ShippingLabelModal: React.FC<ShippingLabelModalProps> = ({ isOpen, onClose, order, company }) => {
    const [downloading, setDownloading] = useState(false);

    const handlePrint = () => {
        window.print();
    };

    const handleDownloadPDF = async () => {
        const labelElt = document.getElementById("shipping-label-print-area");
        if (!labelElt) return;
        setDownloading(true);
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
                canvas = await html2canvas(labelElt, {
                    scale: 3,
                    useCORS: true,
                    logging: false,
                    backgroundColor: "#ffffff",
                    windowWidth: labelElt.scrollWidth,
                    windowHeight: labelElt.scrollHeight
                });
            } finally {
                window.getComputedStyle = originalGetComputedStyle;
            }

            const imgData = canvas.toDataURL("image/png");
            const pdf = new jsPDF("p", "mm", [105, 148]);
            pdf.addImage(imgData, "PNG", 2, 2, 101, 144);
            pdf.save(`shipping_label_${order.id.substring(0, 8)}.pdf`);
        } catch (err) {
            console.error("Error downloading shipping label:", err);
        } finally {
            setDownloading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-lg w-[95vw] rounded-xl p-6 max-h-[90vh] overflow-y-auto font-sans">
                <DialogHeader className="mb-4">
                    <DialogTitle className="text-lg font-bold text-slate-900">Print Shipping Label / Invoice</DialogTitle>
                    <DialogDescription className="text-xs text-slate-500">
                        Print this box-label to stick on the product package.
                    </DialogDescription>
                </DialogHeader>

                <style dangerouslySetInnerHTML={{ __html: `
                    @media print {
                        body * {
                            visibility: hidden !important;
                        }
                        #shipping-label-print-area, #shipping-label-print-area * {
                            visibility: visible !important;
                        }
                        #shipping-label-print-area {
                            position: absolute !important;
                            left: 0 !important;
                            top: 0 !important;
                            width: 105mm !important;
                            height: 148mm !important;
                            border: none !important;
                            margin: 0 !important;
                            padding: 10px !important;
                            background: white !important;
                        }
                    }
                ` }} />

                <div className="flex justify-center p-4 bg-slate-100/50 border rounded-xl mb-4 overflow-x-auto">
                    <div 
                        id="shipping-label-print-area"
                        className="bg-white border-2 border-black w-[100mm] min-h-[140mm] p-4 flex flex-col justify-between font-mono text-[9px] leading-tight text-black"
                    >
                        <div id="shipping-label-box" className="flex flex-col h-full justify-between gap-3">
                            
                            <div className="border-b border-black pb-2 text-center">
                                <h2 className="text-[11px] font-bold tracking-tight">DELIVERY CHALLAN / SHIPPING LABEL</h2>
                                <p className="text-[6px] text-slate-500 mt-0.5 uppercase tracking-wider font-semibold">Indian Standard E-Commerce Format</p>
                            </div>

                            <div className="border-b border-black py-2 grid grid-cols-4 gap-2 items-center">
                                <div className="col-span-2 flex flex-col gap-1 pr-1">
                                    <BarcodeSVG value={order.id} />
                                    <span className="text-[6px] text-center tracking-wider font-bold">{order.id.toUpperCase()}</span>
                                </div>
                                <div className="border-l border-black pl-2 flex flex-col items-center justify-center">
                                    <img 
                                        src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(order.id)}`} 
                                        alt="QR" 
                                        className="w-10 h-10 object-contain"
                                    />
                                    <span className="text-[5px] text-slate-500 font-bold uppercase mt-0.5">SCAN QR</span>
                                </div>
                                <div className="border-l border-black pl-2 flex flex-col items-center justify-center">
                                    <span className="text-[6px] font-bold text-slate-500 uppercase">PINCODE</span>
                                    <span className="text-xs font-black tracking-tight mt-0.5">{order.pincode}</span>
                                </div>
                            </div>

                            <div className="border-b border-black py-2 grid grid-cols-2 gap-2 divide-x divide-black text-[8px]">
                                <div className="pr-1">
                                    <p className="font-bold border-b border-black pb-0.5 mb-1 uppercase tracking-wider text-[7px]">From (Sender)</p>
                                    <p className="font-bold text-slate-900">{company?.company_name || "Merchant Store"}</p>
                                    <p className="text-slate-600 leading-normal mt-0.5">{company?.company_address || "Registered Vendor Office"}</p>
                                    {company?.gst_number && <p className="font-bold mt-1 text-[7px]">GSTIN: {company.gst_number}</p>}
                                    {company?.mobile_number && <p className="text-[7px] mt-0.5">Mob: {company.mobile_number}</p>}
                                </div>
                                <div className="pl-2">
                                    <p className="font-bold border-b border-black pb-0.5 mb-1 uppercase tracking-wider text-[7px]">To (Recipient)</p>
                                    <p className="font-bold text-slate-900">{order.customer_name}</p>
                                    <p className="text-slate-600 leading-normal mt-0.5">{order.house_number}, {order.street}</p>
                                    <p>{order.area}</p>
                                    <p className="font-bold text-slate-900">{order.city}, {order.state} - {order.pincode}</p>
                                    <p className="font-bold mt-1 text-[7px]">Mob: {order.primary_phone}</p>
                                </div>
                            </div>

                            <div className="border-b border-black py-2 text-center bg-slate-50/50">
                                {order.payment_method === "cod" ? (
                                    <div className="border border-black p-2 bg-slate-100 rounded">
                                        <p className="text-[7px] font-bold text-slate-500 uppercase tracking-widest">CASH ON DELIVERY</p>
                                        <p className="text-base font-black text-black tracking-tight mt-0.5">COLLECT CASH: ₹{order.total_amount.toFixed(2)}</p>
                                    </div>
                                ) : (
                                    <div className="border border-black p-2 bg-slate-100 rounded">
                                        <p className="text-[7px] font-bold text-slate-500 uppercase tracking-widest">ONLINE PREPAID</p>
                                        <p className="text-base font-black text-emerald-800 tracking-tight mt-0.5">PREPAID - DO NOT COLLECT CASH</p>
                                    </div>
                                )}
                            </div>

                            <div className="border-b border-black py-2 text-[7px] leading-normal flex-grow">
                                <p className="font-bold border-b border-black pb-0.5 mb-1 uppercase tracking-wider text-[7px]">Package Contents ({order.resolved_order_items?.length || 0} Items)</p>
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b border-slate-200">
                                            <th className="font-bold pb-0.5">Item Description</th>
                                            <th className="font-bold pb-0.5 text-center">Qty</th>
                                            <th className="font-bold pb-0.5 text-right">Price</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {order.resolved_order_items?.map((item, idx) => (
                                            <tr key={idx} className="border-b border-slate-100">
                                                <td className="py-1 truncate max-w-[120px]">{item.products?.product_name}</td>
                                                <td className="py-1 text-center font-bold">{item.quantity}</td>
                                                <td className="py-1 text-right">₹{item.unit_price}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="pt-2 text-[6px] text-slate-500 text-center leading-normal">
                                <p className="font-semibold text-[7px] text-slate-700">Order ID: {order.id.substring(0, 18).toUpperCase()}</p>
                                <p className="mt-0.5">Declaration: The goods sold are intended for end-consumption. This is a computer generated document, no signature is required.</p>
                            </div>

                        </div>
                    </div>
                </div>

                <div className="flex gap-3 mt-4">
                    <Button 
                        onClick={handleDownloadPDF} 
                        disabled={downloading}
                        className="flex-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg h-10 font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm"
                    >
                        {downloading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                        )}
                        {downloading ? "Downloading..." : "Download Label"}
                    </Button>
                    <Button 
                        onClick={handlePrint} 
                        variant="outline" 
                        className="flex-1 border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg h-10 font-semibold text-xs flex items-center justify-center gap-1.5"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/></svg>
                        Print Label
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default function CompanyMyOrdersPage() {
    const [orders, setOrders] = useState<Order[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState("")
    const [isUpdating, setIsUpdating] = useState(false)
    const [modalOpen, setModalOpen] = useState(false)
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
    const [company, setCompany] = useState<any>(null)
    const [labelOpen, setLabelOpen] = useState(false)
    const [selectedOrderForLabel, setSelectedOrderForLabel] = useState<Order | null>(null)
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
            .select("id, company_name, company_address, mobile_number, email, gst_number")
            .eq("user_id", userId)
            .maybeSingle()

        if (companyError || !companyData) {
            setError("Company record not found.")
            setLoading(false)
            return
        }

        setCompany(companyData)

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

                                    <div className="flex items-center gap-2 w-full sm:w-auto">
                                        <Button 
                                            variant="outline" 
                                            onClick={() => { setSelectedOrderForLabel(order); setLabelOpen(true); }}
                                            className="h-9 px-3 text-xs font-medium text-slate-700 border-slate-200 hover:bg-slate-50 rounded-lg flex items-center gap-1.5"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-printer"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/></svg>
                                            Delivery Challan
                                        </Button>

                                        {order.status !== "delivered" && order.status !== "cancelled" && (
                                            <Button 
                                                variant="default" 
                                                onClick={() => { setSelectedOrder(order); setModalOpen(true); }}
                                                className="h-9 px-4 text-xs font-medium bg-slate-900 text-white hover:bg-slate-800 rounded-lg shadow-sm"
                                            >
                                                <RefreshCw className="w-3.5 h-3.5 mr-2" /> Update Status
                                            </Button>
                                        )}
                                    </div>
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

            {selectedOrderForLabel && (
                <ShippingLabelModal
                    isOpen={labelOpen}
                    onClose={() => setLabelOpen(false)}
                    order={selectedOrderForLabel}
                    company={company}
                />
            )}
        </div>
    );
}