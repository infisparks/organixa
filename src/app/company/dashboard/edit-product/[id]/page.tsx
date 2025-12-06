"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, useParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { AlertCircle, Edit, Loader2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { AddEditProductForm, type ProductFormData } from "@/components/company/add-edit-product-form"

// --- Interface Definitions ---
interface ProductDataFromDB {
  id: string
  product_name: string
  product_description: string
  
  // New Fields for Delivery API
  sku: string | null
  hsn_code: string | null
  tax_rate: number | null

  original_price: number
  discount_price: number
  stock_quantity: number
  
  weight: number
  weight_unit: string
  length: number
  width: number
  height: number
  dimension_unit: string
  
  nutrients: Array<{ name: string; value: string }>
  categories: Array<{ main: string; sub: string }>
  product_photo_urls: string[] 
  product_video_url: string | null
  is_approved: boolean
  company_id: string
}

/**
 * Helper: Reconstruct public URL from path
 */
const getPublicUrlFromPath = (path: string | undefined): string => {
    if (!path) return ""; 
    const { data } = supabase.storage.from("product-media").getPublicUrl(path);
    return data.publicUrl || "";
};

/**
 * Helper: Extract path from public URL
 */
const getPathFromPublicUrl = (url: string | undefined | null): string | null => {
    if (!url) return null;
    const parts = url.split("product-media/");
    return parts.length > 1 ? parts[1] : null;
};

export default function EditProductPage() {
  const router = useRouter()
  const params = useParams()
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id 
  const { toast } = useToast()

  const [initialProductData, setInitialProductData] = useState<ProductFormData | undefined>(undefined)
  const [pageLoading, setPageLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [submissionError, setSubmissionError] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  const lastFetchedId = useRef<string | null>(null)

  useEffect(() => {
    if (!id) {
      setFetchError("Product ID is missing.")
      setPageLoading(false)
      return
    }

    if (initialProductData || lastFetchedId.current === id) {
      setPageLoading(false)
      return
    }

    const fetchProductAndAuth = async () => {
      lastFetchedId.current = id
      setPageLoading(true)
      setFetchError(null)

      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        if (sessionError || !session) {
          toast({ title: "Authentication Required", description: "Please log in.", variant: "destructive" })
          router.push("/login")
          return
        }

        const userId = session.user.id

        const { data: companyData, error: companyError } = await supabase
          .from("companies")
          .select("id, is_approved")
          .eq("user_id", userId)
          .single()

        if (companyError || !companyData) {
          setFetchError("Company record not found.")
          setPageLoading(false)
          return
        }

        if (!companyData.is_approved) {
          toast({ title: "Approval Pending", description: "Company must be approved.", variant: "destructive" })
          router.push("/company/dashboard")
          setPageLoading(false)
          return
        }

        const companyId = companyData.id

        // Fetch product
        const { data: productData, error: productError } = await supabase
          .from("products")
          .select("*")
          .eq("id", id)
          .eq("company_id", companyId)
          .single()

        if (productError || !productData) {
          setFetchError("Product not found.")
        } else {
          // Convert stored paths to full public URLs
          const existingProductPhotoUrls = productData.product_photo_urls
            ? productData.product_photo_urls.map(getPublicUrlFromPath).filter(url => url !== "")
            : [];
          
          const existingProductVideoUrl = productData.product_video_url
            ? getPublicUrlFromPath(productData.product_video_url)
            : null;

          // Map DB data to Form Data
          const mappedData: ProductFormData = {
            productName: productData.product_name,
            productDescription: productData.product_description,
            
            // --- NEW FIELDS MAPPED HERE ---
            sku: productData.sku || "",
            hsnCode: productData.hsn_code || "",
            taxRate: productData.tax_rate ? productData.tax_rate.toString() : "",
            // ------------------------------

            originalPrice: productData.original_price.toString(),
            discountPrice: productData.discount_price.toString(),
            stockQuantity: productData.stock_quantity.toString(),
            
            weight: productData.weight.toString(),
            // Enforce 'kg' on edit load to match new standard
            weightUnit: "kg", 
            
            length: productData.length.toString(),
            width: productData.width.toString(),
            height: productData.height.toString(),
            // Enforce 'cm' on edit load to match new standard
            dimensionUnit: "cm", 

            nutrients: productData.nutrients || [],
            categories: productData.categories || [],
            existingProductPhotoUrls: existingProductPhotoUrls,
            existingProductVideoUrl: existingProductVideoUrl,
          }
          setInitialProductData(mappedData)
        }
      } catch (error) {
        console.error("Unexpected error:", error)
        setFetchError("An unexpected error occurred.")
      } finally {
        setPageLoading(false)
      }
    }

    fetchProductAndAuth()
  }, [id, router, toast, initialProductData])

  const uploadFile = async (file: File, bucketName: string, folder: string, companyId: string) => {
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_")
    const uniqueFileName = `${folder}/${companyId}/${sanitizedFileName}-${crypto.randomUUID()}`
    
    const { error } = await supabase.storage.from(bucketName).upload(uniqueFileName, file, {
      cacheControl: "3600",
      upsert: false,
    })

    if (error) throw error
    return uniqueFileName
  }

  const handleSaveProduct = async (
    data: ProductFormData,
    newImages: File[],
    newVideo: File | null,
    removedImageUrls: string[],
  ) => {
    setIsSaving(true)
    setSubmissionError("")

    const { data: { session }, error: sessionError } = await supabase.auth.getSession()

    if (sessionError || !session) {
      setSubmissionError("Authentication required.")
      setIsSaving(false)
      return
    }

    const userId = session.user.id
    const { data: companyData } = await supabase.from("companies").select("id").eq("user_id", userId).single()

    if (!companyData?.id) {
      setSubmissionError("Company ID not found.")
      setIsSaving(false)
      return
    }
    const companyId = companyData.id

    try {
      // 1. Delete removed images
      const deleteImagePromises = removedImageUrls.map((url) => {
        const path = getPathFromPublicUrl(url); 
        if (path) return supabase.storage.from("product-media").remove([path])
        return Promise.resolve({ data: null, error: null });
      })
      await Promise.all(deleteImagePromises)

      // 2. Upload new images
      const uploadImagePromises = newImages.map((file) => uploadFile(file, "product-media", "images", companyId))
      const newProductPhotoPaths = await Promise.all(uploadImagePromises)

      // 3. Keep existing paths
      const existingKeptPaths = (initialProductData?.existingProductPhotoUrls || [])
        .filter((url) => !removedImageUrls.includes(url))
        .map(url => getPathFromPublicUrl(url))
        .filter((path): path is string => !!path);

      const finalProductPhotoPaths = [...existingKeptPaths, ...newProductPhotoPaths]

      // 4. Handle video
      let finalProductVideoPath: string | null = null;
      let existingVideoPath = getPathFromPublicUrl(initialProductData?.existingProductVideoUrl);

      if (newVideo) {
        finalProductVideoPath = await uploadFile(newVideo, "product-media", "videos", companyId) 
        if (existingVideoPath) await supabase.storage.from("product-media").remove([existingVideoPath])
      } else if (newVideo === null && initialProductData?.existingProductVideoUrl) {
        if (existingVideoPath) await supabase.storage.from("product-media").remove([existingVideoPath])
        finalProductVideoPath = null
      } else {
          finalProductVideoPath = existingVideoPath;
      }

      const productUpdateData = {
        product_name: data.productName,
        product_description: data.productDescription,
        
        // --- NEW FIELDS SAVED HERE ---
        sku: data.sku,
        hsn_code: data.hsnCode,
        tax_rate: data.taxRate ? Number.parseFloat(data.taxRate) : 0,
        // -----------------------------

        original_price: Number.parseFloat(data.originalPrice),
        discount_price: Number.parseFloat(data.discountPrice),
        stock_quantity: Number.parseInt(data.stockQuantity, 10),
        
        // --- ENFORCED UNITS SAVED HERE ---
        weight: Number.parseFloat(data.weight),
        weight_unit: "kg", // Forced
        length: Number.parseFloat(data.length),
        width: Number.parseFloat(data.width),
        height: Number.parseFloat(data.height),
        dimension_unit: "cm", // Forced
        // ---------------------------------

        nutrients: data.nutrients,
        categories: data.categories,
        product_photo_urls: finalProductPhotoPaths,
        product_video_url: finalProductVideoPath,
        is_approved: false, // Reset approval on edit
      }

      const { error: dbError } = await supabase
        .from("products")
        .update(productUpdateData)
        .eq("id", id)
        .eq("company_id", companyId)

      if (dbError) throw dbError

      toast({
        title: "Success!",
        description: "Product updated successfully. Pending re-approval.",
        variant: "default",
      })
      
      router.push("/company/dashboard/my-products") 
    } catch (error: any) {
      console.error("Error updating product:", error)
      setSubmissionError(error.message || "Error updating product.")
    } finally {
      setIsSaving(false)
    }
  }

  if (pageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-10 w-10 animate-spin text-green-600" />
        <span className="ml-3 text-lg text-green-700">Loading product details...</span>
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
        <Alert variant="destructive" className="max-w-md w-full">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{fetchError}</AlertDescription>
          <Button onClick={() => router.back()} className="mt-4">Go Back</Button>
        </Alert>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-white to-yellow-100">
      <nav className="w-full h-16 px-6 flex items-center bg-white shadow-sm mb-8">
        <div className="flex items-center gap-3">
          <Edit className="h-7 w-7 text-yellow-500" />
          <span className="text-xl font-semibold">Edit Product</span>
        </div>
      </nav>
      <div className="container mx-auto px-4 py-8">
        {submissionError && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{submissionError}</AlertDescription>
          </Alert>
        )}
        {initialProductData && (
          <div className="bg-white rounded-2xl shadow-xl p-8 w-full border border-yellow-100">
            <AddEditProductForm
              initialProductData={initialProductData}
              onSave={handleSaveProduct}
              isEditMode={true}
              isLoading={isSaving}
            />
          </div>
        )}
      </div>
    </div>
  )
}