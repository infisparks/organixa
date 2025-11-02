import ProductDetails from "./ProductDetails"
import { notFound } from "next/navigation"
import { supabase } from "../../../lib/supabase"
import Header from "@/components/Header"
import Footer from "@/components/Footer"

// 🎯 Define props for your dynamic route
interface ProductPageProps {
  params: {
    id: string
  }
}

// Generate static params (for SSG)
export async function generateStaticParams() {
  const { data, error } = await supabase
    .from("products")
    .select("id")
    .eq("is_approved", true)

  if (error) {
    console.error("Error fetching product IDs for static params:", error)
    return []
  }

  return data.map((product) => ({ id: product.id.toString() }))
}

// ✅ Ignore internal Next.js type mismatch warning
//ts-expect-error Next.js internal type system expects params as Promise, but runtime gives plain object
export default async function ProductPage({ params }: ProductPageProps) {
  // Fetch product details from Supabase, including company information
  const { data: productFound, error } = await supabase
    .from("products")
    .select(
      `
      *,
      company:companies(company_name, company_logo_url)
    `
    )
    .eq("id", params.id)
    .eq("is_approved", true)
    .single()

  if (error || !productFound) {
    console.error("Error fetching product:", error)
    return notFound()
  }

  // Map Supabase data to ProductDetails props
  const productDetailsProps = {
    id: productFound.id,
    productName: productFound.product_name,
    productDescription: productFound.product_description,
    originalPrice: productFound.original_price,
    discountPrice: productFound.discount_price,
    productPhotoUrls: productFound.product_photo_urls,
    productVideoUrl: productFound.product_video_url,
    company_id: productFound.company_id,
    company: {
      name: productFound.company?.company_name || "Unknown Company",
      logo: productFound.company?.company_logo_url || "/placeholder.svg",
    },
    nutrients: productFound.nutrients,
  }

  return (
    <>
      <Header />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <ProductDetails product={productDetailsProps} />
        </div>
      </div>
      <Footer />
    </>
  )
}
