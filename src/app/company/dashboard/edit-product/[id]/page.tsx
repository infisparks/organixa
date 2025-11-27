"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, useParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { AlertCircle, Edit, Loader2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { AddEditProductForm, type ProductFormData } from "@/components/company/add-edit-product-form"

// --- Interface Definitions (Kept the same) ---
interface ProductDataFromDB {
  id: string
  product_name: string
  product_description: string
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
  product_photo_urls: string[] // These now hold paths
  product_video_url: string | null // This now holds a path or null
  is_approved: boolean
  company_id: string
}

/**
 * Helper function to reconstruct the public URL from the stored path.
 * The paths are stored in the 'product-media' bucket.
 * @param path The relative path stored in the database (e.g., 'images/123/file.jpg')
 * @returns The full public URL string.
 */
const getPublicUrlFromPath = (path: string | undefined): string => {
    if (!path) {
        return ""; // Return empty string for optional fields
    }
    // Use the getPublicUrl method which correctly constructs the URL using the project config
    const { data } = supabase.storage
        .from("product-media")
        .getPublicUrl(path);

    // If data.publicUrl exists, return it, otherwise return an empty string
    return data.publicUrl || "";
};

/**
 * Helper function to extract the path from a full public URL.
 * @param url The full public URL (e.g., https://xyz.supabase.co/storage/v1/object/public/product-media/images/123/file.jpg)
 * @returns The relative path (e.g., 'images/123/file.jpg')
 */
const getPathFromPublicUrl = (url: string | undefined | null): string | null => {
    if (!url) return null;
    // Find the starting point after the bucket name (product-media/)
    const parts = url.split("product-media/");
    return parts.length > 1 ? parts[1] : null;
};


export default function EditProductPage() {
  const router = useRouter()
  const params = useParams()
  // Safely extract ID and ensure it is a string
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id 
  const { toast } = useToast()

  const [initialProductData, setInitialProductData] = useState<ProductFormData | undefined>(undefined)
  const [pageLoading, setPageLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [submissionError, setSubmissionError] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  // Tracker to prevent duplicate fetching
  const lastFetchedId = useRef<string | null>(null)

  useEffect(() => {
    // 1. Validation
    if (!id) {
      setFetchError("Product ID is missing.")
      setPageLoading(false)
      return
    }

    // 2. Optimization: If we have data, DO NOT fetch again.
    if (initialProductData || lastFetchedId.current === id) {
      setPageLoading(false)
      return
    }

    const fetchProductAndAuth = async () => {
      lastFetchedId.current = id
      setPageLoading(true)
      setFetchError(null)

      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession()

        if (sessionError || !session) {
          toast({
            title: "Authentication Required",
            description: "Please log in to edit products.",
            variant: "destructive",
          })
          router.push("/login")
          return
        }

        const userId = session.user.id

        // Get company_id 
        const { data: companyData, error: companyError } = await supabase
          .from("companies")
          .select("id, is_approved")
          .eq("user_id", userId)
          .single()

        if (companyError || !companyData) {
          console.error("Error fetching company data:", companyError)
          setFetchError("Company record not found or not approved for this user.")
          setPageLoading(false)
          return
        }

        if (!companyData.is_approved) {
          toast({
            title: "Approval Pending",
            description: "Your company must be approved to edit products.",
            variant: "destructive",
          })
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
          console.error("Error fetching product:", productError)
          setFetchError("Product not found or you don't have permission to edit it.")
        } else {
          // --- FIX APPLIED HERE: Convert stored paths to full public URLs for the form ---
          const existingProductPhotoUrls = productData.product_photo_urls
            ? productData.product_photo_urls.map(getPublicUrlFromPath).filter(url => url !== "")
            : [];
          
          const existingProductVideoUrl = productData.product_video_url
            ? getPublicUrlFromPath(productData.product_video_url)
            : null;

          const mappedData: ProductFormData = {
            productName: productData.product_name,
            productDescription: productData.product_description,
            originalPrice: productData.original_price.toString(),
            discountPrice: productData.discount_price.toString(),
            stockQuantity: productData.stock_quantity.toString(),
            weight: productData.weight.toString(),
            weightUnit: productData.weight_unit,
            length: productData.length.toString(),
            width: productData.width.toString(),
            height: productData.height.toString(),
            dimensionUnit: productData.dimension_unit,
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
  }, [id, router, toast, initialProductData]) // Added initialProductData to deps

  // General file upload function
  // FIX APPLIED HERE: Now returns the storage path (uniqueFileName), not the full URL
  const uploadFile = async (file: File, bucketName: string, folder: string, companyId: string) => {
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_")
    const uniqueFileName = `${folder}/${companyId}/${sanitizedFileName}-${crypto.randomUUID()}`
    
    const { error } = await supabase.storage.from(bucketName).upload(uniqueFileName, file, {
      cacheControl: "3600",
      upsert: false,
    })

    if (error) throw error
    
    return uniqueFileName // Return the path for database storage
  }

  const handleSaveProduct = async (
    data: ProductFormData,
    newImages: File[],
    newVideo: File | null,
    removedImageUrls: string[], // These are full public URLs from the form
  ) => {
    setIsSaving(true)
    setSubmissionError("")

    const { data: { session }, error: sessionError } = await supabase.auth.getSession()

    if (sessionError || !session) {
      setSubmissionError("Authentication required to save changes.")
      setIsSaving(false)
      return
    }

    const userId = session.user.id
    const { data: companyData } = await supabase.from("companies").select("id").eq("user_id", userId).single()

    if (!companyData?.id) {
      setSubmissionError("Company ID not found. Cannot save product.")
      setIsSaving(false)
      return
    }
    const companyId = companyData.id

    try {
      // 1. Delete removed images (Paths must be extracted from the URLs)
      const deleteImagePromises = removedImageUrls.map((url) => {
        const path = getPathFromPublicUrl(url); // FIX APPLIED HERE: Use helper to get path
        if (path) {
            return supabase.storage.from("product-media").remove([path])
        }
        return Promise.resolve({ data: null, error: null }); // Resolve if path is null
      })
      await Promise.all(deleteImagePromises)

      // 2. Upload new images (These now return paths)
      const uploadImagePromises = newImages.map((file) => uploadFile(file, "product-media", "images", companyId))
      const newProductPhotoPaths = await Promise.all(uploadImagePromises) // These are paths

      // 3. Construct the list of existing, kept paths
      const existingKeptPaths = (initialProductData?.existingProductPhotoUrls || [])
        .filter((url) => !removedImageUrls.includes(url)) // Filter URLs that were NOT removed
        .map(url => getPathFromPublicUrl(url)) // Convert remaining URLs back to paths
        .filter((path): path is string => !!path); // Ensure paths are valid strings

      // 4. Combine existing kept paths and new paths
      const finalProductPhotoPaths = [
        ...existingKeptPaths,
        ...newProductPhotoPaths,
      ]

      // 5. Handle video
      let finalProductVideoPath: string | null = null;
      let existingVideoPath = getPathFromPublicUrl(initialProductData?.existingProductVideoUrl);

      if (newVideo) {
        // Upload new video, result is a path
        finalProductVideoPath = await uploadFile(newVideo, "product-media", "videos", companyId) 
        // Delete old video if it exists
        if (existingVideoPath) {
          await supabase.storage.from("product-media").remove([existingVideoPath])
        }
      } else if (newVideo === null && initialProductData?.existingProductVideoUrl) {
        // User explicitly removed video (newVideo is null, but existing URL was present)
        if (existingVideoPath) {
          await supabase.storage.from("product-media").remove([existingVideoPath])
        }
        finalProductVideoPath = null
      } else {
          // No change to video, keep the existing path (or null)
          finalProductVideoPath = existingVideoPath;
      }


      const productUpdateData = {
        product_name: data.productName,
        product_description: data.productDescription,
        original_price: Number.parseFloat(data.originalPrice),
        discount_price: Number.parseFloat(data.discountPrice),
        stock_quantity: Number.parseInt(data.stockQuantity, 10),
        weight: Number.parseFloat(data.weight),
        weight_unit: data.weightUnit,
        length: Number.parseFloat(data.length),
        width: Number.parseFloat(data.width),
        height: Number.parseFloat(data.height),
        dimension_unit: data.dimensionUnit,
        nutrients: data.nutrients,
        categories: data.categories,
        // FIX APPLIED HERE: Save paths to the database
        product_photo_urls: finalProductPhotoPaths,
        product_video_url: finalProductVideoPath,
      }

      const { error: dbError } = await supabase
        .from("products")
        .update(productUpdateData)
        .eq("id", id)
        .eq("company_id", companyId)

      if (dbError) throw dbError

      toast({
        title: "Success!",
        description: "Product updated successfully.",
        variant: "default",
      })
      
      router.push("/company/dashboard/my-products") 
    } catch (error: any) {
      console.error("Error updating product:", error)
      setSubmissionError(error.message || "Error updating product. Please try again.")
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
          <Button onClick={() => router.back()} className="mt-4">
            Go Back
          </Button>
        </Alert>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-white to-yellow-100">
      <nav className="w-full h-16 px-6 flex items-center bg-gradient-to-r from-blue-100 via-green-50 to-green-100 shadow-sm rounded-b-2xl mb-8 font-[Inter,sans-serif]">
        <div className="flex items-center gap-3">
          <Edit className="h-7 w-7 text-yellow-500" />
          <span className="text-xl md:text-2xl font-semibold tracking-tight text-gray-800">Edit Product</span>
        </div>
      </nav>
      <div className="container mx-auto px-4 py-8">
        {submissionError && (
          <Alert variant="destructive" className="mb-4 rounded-xl shadow-md bg-red-50 border-red-200">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <AlertDescription className="text-red-700">{submissionError}</AlertDescription>
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