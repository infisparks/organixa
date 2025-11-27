import { create } from 'zustand'
import { supabase } from '@/lib/supabase'

export interface DashboardStats {
    companyName: string
    totalProducts: number
    totalSalesAmount: number
    totalOrders: number
    pendingOrders: number
    activeListings: number
    outOfStockProducts: number
    lowStockProducts: Array<{
        id: string
        product_name: string
        stock_quantity: number
        product_photo_urls: string[]
    }>
    allSellingProducts: Array<{
        product_id: string
        product_name: string
        units_sold: number
        revenue_generated: number
        product_photo_urls: string[]
    }>
    chartSalesData: number[]
    chartSalesLabels: string[]
    chartXAxisLabels: string[]
}

interface DashboardState {
    stats: DashboardStats | null
    loading: boolean
    error: string | null
    lastFetched: number | null
    fetchStats: (force?: boolean) => Promise<void>
}

// Cache duration in milliseconds (e.g., 5 minutes)
const CACHE_DURATION = 5 * 60 * 1000

export interface ProductFormData {
    productName: string
    productDescription: string
    originalPrice: string
    discountPrice: string
    stockQuantity: string
    weight: string
    weightUnit: string
    length: string
    width: string
    height: string
    dimensionUnit: string
    nutrients: Array<{ name: string; value: string }>
    categories: Array<{ main: string; sub: string }>
    // For existing files, we'll need to pass their URLs
    existingProductPhotoUrls?: string[]
    existingProductVideoUrl?: string | null
}

interface CompanyStatus {
    id: string
    is_approved: boolean
}

interface DashboardState {
    stats: DashboardStats | null
    loading: boolean
    error: string | null
    lastFetched: number | null

    // Add Product Page State
    companyStatus: CompanyStatus | null
    addProductFormState: ProductFormData | null

    fetchStats: (force?: boolean) => Promise<void>
    setCompanyStatus: (status: CompanyStatus) => void
    setAddProductFormState: (data: ProductFormData) => void
    clearAddProductFormState: () => void
}
export const useDashboardStore = create<DashboardState>((set, get) => ({
    stats: null,
    loading: true,
    error: null,
    lastFetched: null,

    companyStatus: null,
    addProductFormState: null,

    setCompanyStatus: (status) => set({ companyStatus: status }),
    setAddProductFormState: (data) => set({ addProductFormState: data }),
    clearAddProductFormState: () => set({ addProductFormState: null }),

    fetchStats: async (force = false) => {
        const { stats, lastFetched, loading } = get()
        const now = Date.now()

        // If data is already loaded and fresh enough, and not forced, don't re-fetch
        if (!force && stats && lastFetched && (now - lastFetched < CACHE_DURATION)) {
            // If we have stats, ensure loading is false
            if (loading) set({ loading: false })
            return
        }

        // If we have stats (stale or not), we can keep showing them while fetching in background
        // Only set loading to true if we have NO data
        if (!stats) {
            set({ loading: true, error: null })
        }

        try {
            const {
                data: { session },
                error: sessionError,
            } = await supabase.auth.getSession()

            if (sessionError || !session) {
                set({ error: "Authentication required.", loading: false })
                return
            }

            const userId = session.user.id

            // 1. Get company_id and company_name for the logged-in user
            const { data: companyData, error: companyError } = await supabase
                .from("companies")
                .select("id, company_name")
                .eq("user_id", userId)
                .single()

            if (companyError || !companyData) {
                set({ error: "Company not found or not approved.", loading: false })
                return
            }
            const companyId = companyData.id
            const companyName = companyData.company_name

            // 2. Fetch products for this company
            const { data: productsData, error: productsError } = await supabase
                .from("products")
                .select("id, product_name, discount_price, original_price, stock_quantity, is_approved, product_photo_urls")
                .eq("company_id", companyId)

            if (productsError) {
                console.error("Error fetching products for dashboard:", productsError)
                set({ error: "Failed to load product data.", loading: false })
                return
            }

            const totalProducts = productsData?.length || 0
            const activeListings = productsData?.filter((p) => p.is_approved).length || 0
            const outOfStockProducts = productsData?.filter((p) => p.stock_quantity === 0).length || 0

            // Low Stock threshold: 0 < stock < 10
            const lowStockProducts = productsData?.filter((p) => p.stock_quantity > 0 && p.stock_quantity < 10) || []

            const companyProductIds = new Set(productsData?.map((p) => p.id))
            const productDetailsMap = new Map(productsData?.map((p) => [p.id, p]))

            // 3. Fetch all orders and filter client-side for company-specific orders
            const { data: allOrdersData, error: ordersError } = await supabase
                .from("orders")
                .select("id, total_amount, status, order_items, purchase_time")

            if (ordersError) {
                console.error("Error fetching orders for dashboard:", ordersError)
                set({ error: "Failed to load order data.", loading: false })
                return
            }

            let totalSalesAmount = 0
            let totalOrders = 0
            let pendingOrders = 0
            const productSales: { [key: string]: { units: number; revenue: number } } = {}

            // 4. Setup Sales Aggregation for Chart (Last 7 Days)
            const salesByDate = new Map<string, number>();
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Initialize map with last 7 days
            for (let i = 6; i >= 0; i--) {
                const date = new Date(today);
                date.setDate(today.getDate() - i);
                salesByDate.set(date.toISOString().split('T')[0], 0);
            }


            if (allOrdersData) {
                allOrdersData.forEach((order) => {
                    let hasCompanyProductInOrder = false
                    let companySpecificOrderAmount = 0

                    if (Array.isArray(order.order_items)) {
                        order.order_items.forEach((item: any) => {
                            if (companyProductIds.has(item.product_id)) {
                                hasCompanyProductInOrder = true
                                companySpecificOrderAmount += item.price_at_purchase * item.quantity

                                // Aggregate for all selling products
                                if (!productSales[item.product_id]) {
                                    productSales[item.product_id] = { units: 0, revenue: 0 }
                                }
                                productSales[item.product_id].units += item.quantity
                                productSales[item.product_id].revenue += item.price_at_purchase * item.quantity
                            }
                        })
                    }

                    if (hasCompanyProductInOrder) {
                        totalOrders += 1
                        totalSalesAmount += companySpecificOrderAmount // Sum only company-relevant sales
                        if (order.status === "pending" || order.status === "confirmed") {
                            pendingOrders += 1
                        }

                        // Aggregate for chart data
                        const orderDate = new Date(order.purchase_time);
                        orderDate.setHours(0, 0, 0, 0);
                        const dateKey = orderDate.toISOString().split('T')[0];

                        if (salesByDate.has(dateKey)) {
                            salesByDate.set(dateKey, salesByDate.get(dateKey)! + 1);
                        }
                    }
                })
            }

            // Prepare dynamic chart data
            const sortedSalesData = Array.from(salesByDate.entries()).sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime());
            const chartSalesData = sortedSalesData.map(([date, count]) => count);

            // Full date label for tooltips
            const chartSalesLabels = sortedSalesData.map(([date]) => new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric' }));

            // Short day label for X-axis
            const chartXAxisLabels = sortedSalesData.map(([date]) => new Date(date).toLocaleDateString('en-US', { weekday: 'short' }));


            // 5. All selling products (use full list)
            const allSellingProducts = Object.entries(productSales)
                .map(([productId, data]) => {
                    const productInfo = productDetailsMap.get(productId)
                    return {
                        product_id: productId,
                        product_name: productInfo?.product_name || "Unknown Product",
                        units_sold: data.units,
                        revenue_generated: data.revenue,
                        product_photo_urls: productInfo?.product_photo_urls || [],
                    }
                })
                .sort((a, b) => b.units_sold - a.units_sold)


            set({
                stats: {
                    companyName,
                    totalProducts,
                    totalSalesAmount,
                    totalOrders,
                    pendingOrders,
                    activeListings,
                    outOfStockProducts,
                    lowStockProducts,
                    allSellingProducts,
                    chartSalesData,
                    chartSalesLabels,
                    chartXAxisLabels,
                },
                loading: false,
                error: null,
                lastFetched: Date.now()
            })

        } catch (error: any) {
            console.error("Error in dashboard store:", error)
            set({ error: error.message || "An unexpected error occurred", loading: false })
        }
    }
}))
