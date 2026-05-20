"use client"

import { useEffect } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { 
    Loader2, Package, DollarSign, ShoppingCart, 
    AlertTriangle, ShoppingBag, TrendingUp, 
    PackageCheck, ArrowUpRight, SearchX 
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import Chart from "react-apexcharts"
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

    useEffect(() => {
        fetchStats()
    }, [fetchStats])

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-[#fafafa]">
                <Loader2 className="h-6 w-6 animate-spin text-slate-900 mb-3" />
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Loading Dashboard</span>
            </div>
        )
    }

    if (error) {
        return (
            <div className="p-6 max-w-4xl mx-auto mt-10">
                <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl shadow-sm text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-semibold">Error loading dashboard:</span> {error}
                </div>
            </div>
        )
    }

    // Safely fallback for completed orders depending on what your store returns
    const completedOrdersCount = stats?.completedOrders || stats?.deliveredOrders || 0;

    return (
        <div className="min-h-screen bg-[#fafafa] font-sans text-slate-900 pb-20 selection:bg-slate-200">
            
            {/* Header */}
            <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-slate-900 text-white flex items-center justify-center">
                            <TrendingUp className="h-4 w-4" />
                        </div>
                        <div>
                            <h1 className="text-sm font-bold tracking-tight text-slate-900 leading-none">Dashboard Overview</h1>
                            <p className="text-[10px] font-medium text-slate-500 mt-1">Welcome back, {stats?.companyName || "Partner"}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" asChild className="hidden sm:flex h-8 px-3 text-xs font-medium border-slate-200 text-slate-600 hover:text-slate-900">
                            <Link href="/company/dashboard/my-products"><Package className="h-3.5 w-3.5 mr-1.5" /> Inventory</Link>
                        </Button>
                        <Button size="sm" asChild className="h-8 px-3 text-xs font-medium bg-slate-900 text-white hover:bg-slate-800">
                            <Link href="/company/dashboard/my-orders"><ShoppingCart className="h-3.5 w-3.5 mr-1.5" /> Orders</Link>
                        </Button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
                
                {/* Metrics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-6">
                    
                    {/* Revenue Card */}
                    <Card className="rounded-xl border-slate-200 shadow-sm bg-white hover:shadow-md transition-shadow">
                        <CardContent className="p-4 sm:p-5 flex flex-col justify-between h-full gap-4">
                            <div className="flex justify-between items-start">
                                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Gross Revenue</p>
                                <div className="w-6 h-6 rounded-full bg-emerald-50 flex items-center justify-center">
                                    <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
                                </div>
                            </div>
                            <div>
                                <h3 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                                    ₹{stats?.totalSalesAmount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "0.00"}
                                </h3>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Total Orders Card */}
                    <Card className="rounded-xl border-slate-200 shadow-sm bg-white hover:shadow-md transition-shadow">
                        <CardContent className="p-4 sm:p-5 flex flex-col justify-between h-full gap-4">
                            <div className="flex justify-between items-start">
                                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Orders</p>
                                <div className="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center">
                                    <ShoppingCart className="h-3.5 w-3.5 text-blue-600" />
                                </div>
                            </div>
                            <div>
                                <h3 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">{stats?.totalOrders || 0}</h3>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Completed Orders Card (FIX ADDED HERE) */}
                    <Card className="rounded-xl border-slate-200 shadow-sm bg-white hover:shadow-md transition-shadow">
                        <CardContent className="p-4 sm:p-5 flex flex-col justify-between h-full gap-4">
                            <div className="flex justify-between items-start">
                                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Completed</p>
                                <div className="w-6 h-6 rounded-full bg-indigo-50 flex items-center justify-center">
                                    <PackageCheck className="h-3.5 w-3.5 text-indigo-600" />
                                </div>
                            </div>
                            <div>
                                <h3 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">{completedOrdersCount}</h3>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Total Products Card */}
                    <Card className="rounded-xl border-slate-200 shadow-sm bg-white hover:shadow-md transition-shadow">
                        <CardContent className="p-4 sm:p-5 flex flex-col justify-between h-full gap-4">
                            <div className="flex justify-between items-start">
                                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Catalog Items</p>
                                <div className="w-6 h-6 rounded-full bg-purple-50 flex items-center justify-center">
                                    <Package className="h-3.5 w-3.5 text-purple-600" />
                                </div>
                            </div>
                            <div>
                                <h3 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">{stats?.totalProducts || 0}</h3>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Out of Stock Card */}
                    <Card className="rounded-xl border-slate-200 shadow-sm bg-white hover:shadow-md transition-shadow">
                        <CardContent className="p-4 sm:p-5 flex flex-col justify-between h-full gap-4">
                            <div className="flex justify-between items-start">
                                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Out of Stock</p>
                                <div className="w-6 h-6 rounded-full bg-amber-50 flex items-center justify-center">
                                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                                </div>
                            </div>
                            <div>
                                <h3 className={`text-xl sm:text-2xl font-bold tracking-tight ${(stats?.outOfStockProducts || 0) > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
                                    {stats?.outOfStockProducts || 0}
                                </h3>
                            </div>
                        </CardContent>
                    </Card>

                </div>

                {/* Main Content Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    {/* Sales Chart Section */}
                    <div className="lg:col-span-2 flex flex-col gap-4">
                        <Card className="rounded-xl border-slate-200 shadow-sm bg-white h-full flex flex-col">
                            <CardHeader className="px-5 py-4 border-b border-slate-100 flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle className="text-sm font-semibold text-slate-900">Order Volume</CardTitle>
                                    <p className="text-[10px] font-medium text-slate-500 mt-0.5">Performance over the last 7 days</p>
                                </div>
                            </CardHeader>
                            <CardContent className="p-4 flex-grow flex items-center justify-center min-h-[300px]">
                                {stats?.chartSalesData && stats.chartSalesData.length > 0 ? (
                                    <div className="w-full h-full -ml-2">
                                        <Chart
                                            options={{
                                                chart: {
                                                    id: "sales-chart",
                                                    toolbar: { show: false },
                                                    fontFamily: 'inherit',
                                                    parentHeightOffset: 0,
                                                },
                                                xaxis: {
                                                    categories: stats.chartXAxisLabels,
                                                    labels: { style: { colors: '#64748b', fontSize: '10px', fontWeight: 500 } },
                                                    axisBorder: { show: false },
                                                    axisTicks: { show: false },
                                                },
                                                yaxis: {
                                                    labels: { 
                                                        formatter: (val) => Math.floor(val).toString(),
                                                        style: { colors: '#64748b', fontSize: '10px', fontWeight: 500 } 
                                                    },
                                                },
                                                tooltip: {
                                                    theme: 'light',
                                                    x: { formatter: (val, { dataPointIndex }) => stats.chartSalesLabels[dataPointIndex] },
                                                    y: { formatter: (val) => `${val} Orders` }
                                                },
                                                colors: ["#0f172a"], // slate-900
                                                dataLabels: { enabled: false },
                                                stroke: { curve: "smooth", width: 2 },
                                                grid: { borderColor: "#f1f5f9", strokeDashArray: 4 },
                                                markers: { size: 4, strokeWidth: 0, hover: { size: 6 } }
                                            }}
                                            series={[{ name: "Orders", data: stats.chartSalesData }]}
                                            type="area"
                                            height="100%"
                                            width="100%"
                                        />
                                    </div>
                                ) : (
                                    <div className="text-center flex flex-col items-center">
                                        <TrendingUp className="h-8 w-8 text-slate-200 mb-2" />
                                        <p className="text-sm font-medium text-slate-500">No sales data recorded yet.</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Low Stock Alerts Section */}
                    <div className="lg:col-span-1 flex flex-col gap-4">
                        <Card className="rounded-xl border-slate-200 shadow-sm bg-white h-full flex flex-col">
                            <CardHeader className="px-5 py-4 border-b border-slate-100 flex flex-row items-center justify-between">
                                <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                    Inventory Alerts
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0 flex-grow overflow-y-auto max-h-[350px]">
                                {stats?.lowStockProducts && stats.lowStockProducts.length > 0 ? (
                                    <ul className="divide-y divide-slate-100">
                                        {stats.lowStockProducts.map((product) => (
                                            <li key={product.id} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="w-10 h-10 rounded bg-slate-100 overflow-hidden flex-shrink-0 border border-slate-200">
                                                        <Image
                                                            src={getPublicUrlFromPath(product.product_photo_urls?.[0])}
                                                            alt={product.product_name}
                                                            className="object-cover w-full h-full"
                                                            width={40} height={40}
                                                        />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-[11px] font-semibold text-slate-900 truncate">{product.product_name}</p>
                                                        <p className="text-[10px] font-medium text-amber-600 mt-0.5">Stock: {product.stock_quantity} left</p>
                                                    </div>
                                                </div>
                                                <Button variant="outline" size="icon" asChild className="h-7 w-7 rounded-md border-slate-200 flex-shrink-0">
                                                    <Link href={`/company/dashboard/edit-product/${product.id}`}>
                                                        <ArrowUpRight className="h-3.5 w-3.5 text-slate-500" />
                                                    </Link>
                                                </Button>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <div className="text-center py-12 flex flex-col items-center">
                                        <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center mb-2">
                                            <PackageCheck className="h-5 w-5 text-emerald-500" />
                                        </div>
                                        <p className="text-xs font-medium text-slate-500">Inventory levels look good.</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* Top Selling Products Table */}
                <div className="mt-6">
                    <Card className="rounded-xl border-slate-200 shadow-sm bg-white overflow-hidden">
                        <CardHeader className="px-5 py-4 border-b border-slate-100">
                            <CardTitle className="text-sm font-semibold text-slate-900">Product Performance</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {stats?.allSellingProducts && stats.allSellingProducts.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                                <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">Product</th>
                                                <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap text-right">Units Sold</th>
                                                <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap text-right">Revenue</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {stats.allSellingProducts.map((product) => (
                                                <tr key={product.product_id} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-5 py-3">
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-8 w-8 rounded border border-slate-200 overflow-hidden flex-shrink-0 bg-white">
                                                                <img
                                                                    className="h-full w-full object-cover"
                                                                    src={getPublicUrlFromPath(product.product_photo_urls?.[0])}
                                                                    alt={product.product_name}
                                                                />
                                                            </div>
                                                            <span className="text-xs font-semibold text-slate-900 truncate max-w-[200px] sm:max-w-xs">{product.product_name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-3 text-xs font-medium text-slate-600 text-right">
                                                        {product.units_sold}
                                                    </td>
                                                    <td className="px-5 py-3 text-xs font-semibold text-slate-900 text-right">
                                                        ₹{product.revenue_generated.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="text-center py-12 flex flex-col items-center">
                                    <SearchX className="h-8 w-8 text-slate-200 mb-2" />
                                    <p className="text-sm font-medium text-slate-500">No sales data available yet.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

            </main>
        </div>
    )
}