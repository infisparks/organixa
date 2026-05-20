"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Loader2, PackageX, AlertCircle, Camera, Package, Plus } from "lucide-react"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertDescription } from "@/components/ui/alert"

// =========================================================================
//                             TYPE DEFINITIONS
// =========================================================================

interface Product {
  id: string
  product_name: string
  product_description: string
  original_price: number
  discount_price: number
  stock_quantity: number
  product_photo_urls: string[]
  is_approved: boolean
  created_at: string
}

// =========================================================================
//                             HELPER FUNCTIONS
// =========================================================================

const getPublicUrlFromPath = (path: string | undefined): string => {
  if (!path) return "/placeholder.svg";

  if (path.startsWith('http')) {
    if (path.includes('/storage/v1/object/public/') && path.split('/storage/v1/object/public/').length > 2) {
      return path.split('/storage/v1/object/public/').pop()?.startsWith('http')
        ? path.split('/storage/v1/object/public/').pop()!
        : path;
    }
    return path;
  }

  const decodedPath = decodeURIComponent(path);
  const { data } = supabase.storage
    .from("product-media")
    .getPublicUrl(decodedPath);
  return data.publicUrl || "/placeholder.svg";
};

// =========================================================================
//                             COMPONENTS
// =========================================================================

function ProductSkeleton() {
  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col">
      <Skeleton className="aspect-square w-full rounded-none bg-slate-100" />
      <div className="p-3 flex flex-col gap-2">
        <Skeleton className="h-3 w-full bg-slate-100" />
        <Skeleton className="h-3 w-2/3 bg-slate-100" />
        <div className="mt-2 pt-2 border-t border-slate-50 flex justify-between">
          <Skeleton className="h-3 w-1/3 bg-slate-100" />
          <Skeleton className="h-6 w-12 rounded bg-slate-100" />
        </div>
      </div>
    </div>
  )
}

export default function MyProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true)
      setError(null)

      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError || !session) {
        setError("User not authenticated.")
        setLoading(false)
        return
      }

      const userId = session.user.id

      const { data: companyData, error: companyError } = await supabase
        .from("companies")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle()

      if (companyError || !companyData) {
        setError("Company record not found for this user.")
        setLoading(false)
        return
      }

      const { data, error: productsError } = await supabase
        .from("products")
        .select("*")
        .eq("company_id", companyData.id)
        .order("created_at", { ascending: false })

      if (productsError) {
        console.error("Error fetching products:", productsError)
        setError("Failed to load products. Please try again.")
      } else {
        setProducts(data || [])
      }
      setLoading(false)
    }

    fetchProducts()
  }, [toast])

  if (error) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Alert variant="destructive" className="rounded-lg border-red-200 bg-red-50 text-red-800">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs font-medium">{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#fafafa] font-sans text-slate-900 pb-20">
      
      {/* Dashboard Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-slate-900 text-white flex items-center justify-center">
              <Package className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-slate-900 leading-none">Product Inventory</h1>
              <p className="text-[10px] font-medium text-slate-500 mt-0.5">Manage your catalog</p>
            </div>
          </div>
          <Button asChild className="h-8 px-3 text-xs bg-slate-900 hover:bg-slate-800 text-white rounded shadow-sm font-medium">
            <Link href="/company/dashboard/add-product" className="flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5" /> New Product
            </Link>
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        
        {/* Toolbar & Stats */}
        {!loading && products.length > 0 && (
          <div className="flex items-center justify-between mb-4">
            <div className="text-xs font-semibold text-slate-500">
              Total Products: <span className="text-slate-900">{products.length}</span>
            </div>
          </div>
        )}

        {/* Product Grid */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
            {/* THIS IS THE FIXED LINE */}
            {Array(8).fill(0).map((_, i) => <ProductSkeleton key={i} />)}
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 bg-white border border-dashed border-slate-200 rounded-lg text-center">
            <PackageX className="h-8 w-8 text-slate-300 mb-3" />
            <p className="text-sm font-semibold text-slate-800 mb-1">No products found</p>
            <p className="text-[11px] text-slate-500 mb-5 max-w-[220px]">Your inventory is currently empty. Add your first product to get started.</p>
            <Button asChild className="h-8 px-4 text-xs bg-slate-900 hover:bg-slate-800 text-white rounded font-medium">
              <Link href="/company/dashboard/add-product">Add Product</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
            {products.map((product) => (
              <div
                key={product.id}
                className="group flex flex-col bg-white border border-slate-200 rounded-lg overflow-hidden hover:border-slate-300 hover:shadow-sm transition-all duration-200"
              >
                {/* Image Section */}
                <div className="relative aspect-square bg-slate-50 overflow-hidden border-b border-slate-100">
                  {product.product_photo_urls && product.product_photo_urls.length > 0 ? (
                    <img
                      src={getPublicUrlFromPath(product.product_photo_urls[0])}
                      alt={product.product_name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      crossOrigin="anonymous"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-slate-300">
                      <Camera className="h-6 w-6" />
                    </div>
                  )}
                  
                  {/* Status Badge Overlaid */}
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
                    <h3 className="text-xs font-semibold text-slate-900 line-clamp-2 leading-tight mb-1.5 group-hover:text-blue-600 transition-colors">
                      {product.product_name}
                    </h3>
                    
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-sm font-bold text-slate-900">
                        ₹{product.discount_price.toFixed(2)}
                      </span>
                      {product.original_price > product.discount_price && (
                        <span className="text-[9px] text-slate-400 line-through">
                          ₹{product.original_price.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-1 text-[10px] font-medium">
                      <span className="text-slate-400 uppercase">Stock:</span>
                      <span className={`${product.stock_quantity > 0 ? "text-slate-700" : "text-red-500"}`}>
                        {product.stock_quantity}
                      </span>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                      className="h-6 px-2 rounded text-[10px] font-semibold bg-slate-50 text-slate-600 hover:bg-slate-900 hover:text-white transition-colors"
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
    </div>
  )
}