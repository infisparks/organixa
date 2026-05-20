"use client"

import { useEffect, useState } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { 
    Loader2, Package, DollarSign, ShoppingCart, 
    AlertTriangle, TrendingUp, Plus, ArrowRight, 
    Edit2, ShoppingBag, LayoutGrid
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import { useDashboardStore } from "@/store/useDashboardStore"
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
    const { stats, loading, error, fetchStats } = useDashboardStore()
    const { toast } = useToast()
    
    // Local state for fetching recent products to show directly on the dashboard
    const [recentProducts, setRecentProducts] = useState<any[]>([])
    const [fetchingProducts, setFetchingProducts] = useState(true)

    useEffect(() => {
        const loadDashboardData = async () => {
            await fetchStats()
            
            // Fetch recent products for the dashboard view
            const { data: { session } } = await supabase.auth.getSession()
            if (session) {
                const { data: companyData } = await supabase
                    .from("companies")
                    .select("id")
                    .eq("user_id", session.user.id)
                    .maybeSingle()

                if (companyData) {
                    const { data: products } = await supabase
                        .from("products")
                        .select("*")
                        .eq("company_id", companyData.id)
                        .order("created_at", { ascending: false })
                        .limit(8)
                    
                    setRecentProducts(products || [])
                }
            }
            setFetchingProducts(false)
        }

        loadDashboardData()
    }, [fetchStats])

    if (loading || fetchingProducts) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-[#fafafa]">
                <Loader2 className="h-6 w-6 animate-spin text-slate-900 mb-3" />
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest animate-pulse">Loading Workspace</span>
            </div>
        )
    }

    if (error) {
        return (
            <div className="p-6 max-w-4xl mx-auto mt-10">
                <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl shadow-sm text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-semibold">Error:</span> {error}
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#fafafa] font-sans text-slate-900 pb-20 selection:bg-blue-200">
            
            {/* Header */}
            <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center">
                            <LayoutGrid className="h-4 w-4" />
                        </div>
                        <div>
                            <h1 className="text-sm font-bold tracking-tight text-slate-900 leading-none">Command Center</h1>
                            <p className="text-[10px] font-medium text-slate-500 mt-1">Welcome back, {stats?.companyName || "Partner"}</p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
                
                {/* 1. QUICK ACTIONS PANEL */}
                <div className="mb-8">
                    <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Quick Actions</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                        
                        <Link href="/company/dashboard/add-product" className="group block">
                            <Card className="rounded-xl border-slate-200 shadow-sm bg-white hover:border-blue-300 hover:shadow-md transition-all h-full">
                                <CardContent className="p-4 flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-600 transition-colors">
                                        <Plus className="h-5 w-5 text-blue-600 group-hover:text-white transition-colors" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-900">Add New Product</h3>
                                        <p className="text-[11px] font-medium text-slate-500 mt-0.5">List a new item in your catalog</p>
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>

                        <Link href="/company/dashboard/my-orders" className="group block">
                            <Card className="rounded-xl border-slate-200 shadow-sm bg-white hover:border-emerald-300 hover:shadow-md transition-all h-full">
                                <CardContent className="p-4 flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-600 transition-colors">
                                        <ShoppingCart className="h-5 w-5 text-emerald-600 group-hover:text-white transition-colors" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-900">Manage Orders</h3>
                                        <p className="text-[11px] font-medium text-slate-500 mt-0.5">Fulfill and track customer purchases</p>
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>

                        <Link href="/company/dashboard/my-products" className="group block">
                            <Card className="rounded-xl border-slate-200 shadow-sm bg-white hover:border-violet-300 hover:shadow-md transition-all h-full">
                                <CardContent className="p-4 flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0 group-hover:bg-violet-600 transition-colors">
                                        <Package className="h-5 w-5 text-violet-600 group-hover:text-white transition-colors" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-900">View Full Inventory</h3>
                                        <p className="text-[11px] font-medium text-slate-500 mt-0.5">Manage stock, prices, and details</p>
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>

                    </div>
                </div>

                {/* 2. KEY METRICS */}
                <div className="mb-8">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                        <Card className="rounded-xl border-slate-200 shadow-sm bg-white">
                            <CardContent className="p-4 flex flex-col gap-3">
                                <div className="flex justify-between items-start">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Revenue</p>
                                    <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                                </div>
                                <h3 className="text-xl sm:text-2xl font-black text-slate-900">
                                    ₹{stats?.totalSalesAmount?.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) || "0"}
                                </h3>
                            </CardContent>
                        </Card>

                        <Card className="rounded-xl border-slate-200 shadow-sm bg-white">
                            <CardContent className="p-4 flex flex-col gap-3">
                                <div className="flex justify-between items-start">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total Orders</p>
                                    <ShoppingCart className="h-3.5 w-3.5 text-blue-500" />
                                </div>
                                <h3 className="text-xl sm:text-2xl font-black text-slate-900">{stats?.totalOrders || 0}</h3>
                            </CardContent>
                        </Card>

                        <Card className="rounded-xl border-slate-200 shadow-sm bg-white">
                            <CardContent className="p-4 flex flex-col gap-3">
                                <div className="flex justify-between items-start">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Active Items</p>
                                    <Package className="h-3.5 w-3.5 text-violet-500" />
                                </div>
                                <h3 className="text-xl sm:text-2xl font-black text-slate-900">{stats?.activeListings || 0}</h3>
                            </CardContent>
                        </Card>

                        <Card className="rounded-xl border-slate-200 shadow-sm bg-white">
                            <CardContent className="p-4 flex flex-col gap-3">
                                <div className="flex justify-between items-start">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Out of Stock</p>
                                    <AlertTriangle className={`h-3.5 w-3.5 ${(stats?.outOfStockProducts || 0) > 0 ? 'text-amber-500' : 'text-slate-300'}`} />
                                </div>
                                <h3 className={`text-xl sm:text-2xl font-black ${(stats?.outOfStockProducts || 0) > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
                                    {stats?.outOfStockProducts || 0}
                                </h3>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* 3. MY PRODUCTS PREVIEW */}
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Recent Products</h2>
                        <Button variant="ghost" size="sm" asChild className="h-8 text-xs font-bold text-blue-600 hover:bg-blue-50 hover:text-blue-700">
                            <Link href="/company/dashboard/my-products">View All <ArrowRight className="w-3.5 h-3.5 ml-1" /></Link>
                        </Button>
                    </div>

                    {recentProducts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 bg-white border border-dashed border-slate-200 rounded-xl text-center">
                            <Package className="h-8 w-8 text-slate-300 mb-3" />
                            <p className="text-sm font-bold text-slate-800 mb-1">No products found</p>
                            <p className="text-[11px] text-slate-500 mb-4">You haven't listed any products yet.</p>
                            <Button asChild className="h-8 px-4 text-xs font-bold bg-slate-900 text-white rounded-lg">
                                <Link href="/company/dashboard/add-product">Add Your First Product</Link>
                            </Button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                            {recentProducts.map((product) => (
                                <div
                                    key={product.id}
                                    className="group flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden hover:border-slate-300 hover:shadow-md transition-all duration-200"
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
                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide shadow-sm backdrop-blur-md ${
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
                                            <h3 className="text-xs font-bold text-slate-900 line-clamp-2 leading-tight mb-1.5 group-hover:text-blue-600 transition-colors">
                                                {product.product_name}
                                            </h3>
                                            <div className="flex items-baseline gap-1.5">
                                                <span className="text-sm font-black text-slate-900">
                                                    ₹{product.discount_price.toFixed(2)}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                                            <div className="flex items-center gap-1 text-[10px] font-medium">
                                                <span className="text-slate-400 uppercase">Stock:</span>
                                                <span className={`${product.stock_quantity > 0 ? "text-slate-700 font-bold" : "text-red-500 font-bold"}`}>
                                                    {product.stock_quantity}
                                                </span>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                asChild
                                                className="h-6 px-2 rounded text-[10px] font-bold bg-slate-50 text-slate-600 hover:bg-slate-900 hover:text-white transition-colors"
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