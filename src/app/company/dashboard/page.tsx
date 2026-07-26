"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { 
    Loader2, Package, ShoppingCart, 
    AlertTriangle, Plus, ArrowRight, 
    LayoutGrid
} from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase" 

// =========================================================================
//                             HELPER FUNCTIONS
// =========================================================================

const getPublicUrlFromPath = (path: string | undefined): string => {
    if (!path) return "/placeholder.svg";
    if (path.startsWith('http')) return path;
    const { data } = supabase.storage.from("product-media").getPublicUrl(path);
    return data.publicUrl || "/placeholder.svg";
};

// =========================================================================
//                             MAIN COMPONENT
// =========================================================================

export default function DashboardPage() {
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [recentProducts, setRecentProducts] = useState<any[]>([])
    
    // Local Metrics State (Bypassing the buggy store)
    const [metrics, setMetrics] = useState({
        companyName: "Partner",
        totalOrders: 0,
        activeListings: 0,
        outOfStock: 0
    })

    useEffect(() => {
        const loadDashboardData = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession()
                
                if (!session) {
                    setError("User not authenticated.")
                    setLoading(false)
                    return
                }

                // 1. Get Company Details
                const { data: companyData, error: companyError } = await supabase
                    .from("companies")
                    .select("id, company_name")
                    .eq("user_id", session.user.id)
                    .maybeSingle()

                if (companyError || !companyData) {
                    setError("Company profile not found.")
                    setLoading(false)
                    return
                }

                // 2. Fetch all products for metrics and recent preview
                const { data: products } = await supabase
                    .from("products")
                    .select("*")
                    .eq("company_id", companyData.id)
                    .order("created_at", { ascending: false })

                const productList = products || []
                setRecentProducts(productList.slice(0, 8)) // Only show 8 on dashboard

                // 3. Calculate Product Metrics
                const active = productList.filter(p => p.is_approved).length;
                const outOfStock = productList.filter(p => p.stock_quantity <= 0).length;

                // 4. Fetch Accurate Order Count
                // We use an inner join to only get orders that contain this company's products
                const { data: orderData } = await supabase
                    .from("orders")
                    .select(`id, order_items!inner (products!inner (company_id))`)
                    .eq("order_items.products.company_id", companyData.id)

                // Deduplicate orders (in case an order has multiple items from this company)
                const uniqueOrdersCount = new Set(orderData?.map(o => o.id)).size;

                setMetrics({
                    companyName: companyData.company_name || "Partner",
                    totalOrders: uniqueOrdersCount,
                    activeListings: active,
                    outOfStock: outOfStock
                })

            } catch (err: any) {
                console.error(err)
                setError("Failed to load dashboard data.")
            } finally {
                setLoading(false)
            }
        }

        loadDashboardData()
    }, [])

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[80vh] bg-[#fafafa]">
                <Loader2 className="h-6 w-6 animate-spin text-slate-900 mb-3" />
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest animate-pulse">
                    Loading Workspace
                </span>
            </div>
        )
    }

    if (error) {
        return (
            <div className="p-6 max-w-4xl mx-auto mt-10">
                <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl shadow-sm text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-semibold">Notice:</span> {error}
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#F5F6F8] font-sans text-slate-900 pb-20 selection:bg-indigo-100">
            
            {/* Minimal Sticky Header */}
            <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                            <LayoutGrid className="h-4 w-4" />
                        </div>
                        <div>
                            <h1 className="text-sm font-semibold tracking-tight text-slate-900 leading-none">Command Center</h1>
                            <p className="text-[11px] font-medium text-slate-500 mt-0.5">Welcome back, {metrics.companyName}</p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
                
                {/* 1. QUICK ACTIONS PANEL */}
                <div className="mb-8">
                    <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Quick Actions</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                        
                        <Link href="/company/dashboard/add-product" className="group block">
                            <Card className="rounded-2xl border-slate-200 shadow-xs bg-white hover:border-indigo-300 hover:shadow-md transition-all h-full">
                                <CardContent className="p-4 flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-600 transition-colors">
                                        <Plus className="h-5 w-5 text-indigo-600 group-hover:text-white transition-colors" />
                                    </div>
                                    <div>
                                        <h3 className="text-xs font-semibold text-slate-900">Add New Product</h3>
                                        <p className="text-[11px] font-medium text-slate-500 mt-0.5">List a new item in your catalog</p>
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>

                        <Link href="/company/dashboard/my-orders" className="group block">
                            <Card className="rounded-2xl border-slate-200 shadow-xs bg-white hover:border-emerald-300 hover:shadow-md transition-all h-full">
                                <CardContent className="p-4 flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-600 transition-colors">
                                        <ShoppingCart className="h-5 w-5 text-emerald-600 group-hover:text-white transition-colors" />
                                    </div>
                                    <div>
                                        <h3 className="text-xs font-semibold text-slate-900">Manage Orders</h3>
                                        <p className="text-[11px] font-medium text-slate-500 mt-0.5">Fulfill and track customer purchases</p>
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>

                        <Link href="/company/dashboard/my-products" className="group block">
                            <Card className="rounded-2xl border-slate-200 shadow-xs bg-white hover:border-violet-300 hover:shadow-md transition-all h-full">
                                <CardContent className="p-4 flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0 group-hover:bg-violet-600 transition-colors">
                                        <Package className="h-5 w-5 text-violet-600 group-hover:text-white transition-colors" />
                                    </div>
                                    <div>
                                        <h3 className="text-xs font-semibold text-slate-900">View Full Inventory</h3>
                                        <p className="text-[11px] font-medium text-slate-500 mt-0.5">Manage stock, prices, and details</p>
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>

                    </div>
                </div>

                {/* 2. KEY METRICS */}
                <div className="mb-8">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                        
                        <Card className="rounded-2xl border-slate-200 shadow-xs bg-white">
                            <CardContent className="p-5 flex flex-col gap-3">
                                <div className="flex justify-between items-start">
                                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Orders</p>
                                    <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
                                        <ShoppingCart className="h-3.5 w-3.5 text-indigo-600" />
                                    </div>
                                </div>
                                <h3 className="text-2xl sm:text-3xl font-semibold text-slate-900">{metrics.totalOrders}</h3>
                            </CardContent>
                        </Card>

                        <Card className="rounded-2xl border-slate-200 shadow-xs bg-white">
                            <CardContent className="p-5 flex flex-col gap-3">
                                <div className="flex justify-between items-start">
                                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Active Items</p>
                                    <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                                        <Package className="h-3.5 w-3.5 text-emerald-600" />
                                    </div>
                                </div>
                                <h3 className="text-2xl sm:text-3xl font-semibold text-slate-900">{metrics.activeListings}</h3>
                            </CardContent>
                        </Card>

                        <Card className="rounded-2xl border-slate-200 shadow-xs bg-white">
                            <CardContent className="p-5 flex flex-col gap-3">
                                <div className="flex justify-between items-start">
                                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Out of Stock</p>
                                    <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
                                        <AlertTriangle className={`h-3.5 w-3.5 ${metrics.outOfStock > 0 ? 'text-amber-600' : 'text-slate-400'}`} />
                                    </div>
                                </div>
                                <h3 className={`text-2xl sm:text-3xl font-semibold ${metrics.outOfStock > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
                                    {metrics.outOfStock}
                                </h3>
                            </CardContent>
                        </Card>

                    </div>
                </div>

                {/* 3. MY PRODUCTS PREVIEW */}
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Recent Products</h2>
                        <Button variant="ghost" size="sm" asChild className="h-8 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg">
                            <Link href="/company/dashboard/my-products">View All <ArrowRight className="w-3.5 h-3.5 ml-1" /></Link>
                        </Button>
                    </div>

                    {recentProducts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 bg-white border border-dashed border-slate-200 rounded-2xl text-center">
                            <Package className="h-8 w-8 text-slate-300 mb-3" />
                            <p className="text-sm font-semibold text-slate-800 mb-1">No products found</p>
                            <p className="text-xs text-slate-500 mb-4">You haven't listed any products yet.</p>
                            <Button asChild className="h-9 px-4 text-xs font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-xs">
                                <Link href="/company/dashboard/add-product">Add Your First Product</Link>
                            </Button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                            {recentProducts.map((product) => (
                                <div
                                    key={product.id}
                                    className="group flex flex-col bg-white border border-slate-200 rounded-2xl overflow-hidden hover:border-slate-300 hover:shadow-sm transition-all duration-200"
                                >
                                    {/* Image Section */}
                                    <div className="relative aspect-square bg-slate-50 overflow-hidden border-b border-slate-100">
                                        <img
                                            src={getPublicUrlFromPath(product.product_photo_urls?.[0])}
                                            alt={product.product_name}
                                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                            crossOrigin="anonymous"
                                        />
                                        <div className="absolute top-2 right-2">
                                            <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider shadow-xs backdrop-blur-md ${
                                                product.is_approved 
                                                    ? "bg-emerald-500/90 text-white" 
                                                    : "bg-amber-500/90 text-white"
                                            }`}>
                                                {product.is_approved ? "Live" : "Pending"}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Content Section */}
                                    <div className="p-3 flex flex-col flex-grow justify-between">
                                        <div>
                                            <h3 className="text-xs font-semibold text-slate-900 line-clamp-2 leading-snug mb-1.5 group-hover:text-indigo-600 transition-colors">
                                                {product.product_name}
                                            </h3>
                                            <div className="flex items-baseline gap-1.5">
                                                <span className="text-sm font-semibold text-slate-900">
                                                    ₹{product.discount_price.toFixed(2)}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                                            <div className="flex items-center gap-1 text-[10px] font-medium">
                                                <span className="text-slate-400 uppercase">Stock:</span>
                                                <span className={`${product.stock_quantity > 0 ? "text-slate-700 font-semibold" : "text-rose-500 font-semibold"}`}>
                                                    {product.stock_quantity}
                                                </span>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                asChild
                                                className="h-6 px-2.5 rounded-lg text-[10px] font-semibold bg-slate-50 text-slate-600 hover:bg-indigo-600 hover:text-white transition-colors"
                                            >
                                                <Link href={`/company/dashboard/edit-product/${product.id}`}>
                                                    Edit
                                                </Link>
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

            </main>
        </div>
    )
}