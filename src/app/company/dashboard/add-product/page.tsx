"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { AlertCircle, Loader2, PlusCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { AddEditProductForm, type ProductFormData } from "@/components/company/add-edit-product-form"
import { useDashboardStore } from "@/store/useDashboardStore"

export default function AddProductPage() {
  const router = useRouter()
  const { toast } = useToast()

  const companyStatus = useDashboardStore((state) => state.companyStatus)
  const setCompanyStatus = useDashboardStore((state) => state.setCompanyStatus)
  const setAddProductFormState = useDashboardStore((state) => state.setAddProductFormState)
  const clearAddProductFormState = useDashboardStore((state) => state.clearAddProductFormState)

  const [initialFormState] = useState(() => useDashboardStore.getState().addProductFormState)

  const [pageLoading, setPageLoading] = useState(!companyStatus)
  const [submissionError, setSubmissionError] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const checkAuthAndCompanyStatus = async () => {
      if (companyStatus) {
        setPageLoading(false)
        return
      }

      setPageLoading(true)
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError || !session) {
        toast({
          title: "Authentication Required",
          description: "Please log in to add products.",
          variant: "destructive",
        })
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
        console.error("Error fetching company data:", companyError)
        toast({
          title: "Company Not Found",
          description: "Your company record could not be found or is not approved.",
          variant: "destructive",
        })
        router.push("/")
        return
      }

      if (!companyData.is_approved) {
        toast({
          title: "Approval Pending",
          description: "Your company must be approved to add products.",
          variant: "destructive",
        })
        router.push("/company/dashboard")
        return
      }

      setCompanyStatus(companyData)
      setPageLoading(false)
    }

    checkAuthAndCompanyStatus()
  }, [router, toast, companyStatus, setCompanyStatus])

  // UPDATED: Now returns only the storage path (uniqueFileName) instead of the full URL
  const uploadFile = async (file: File, bucketName: string, folder: string) => {
    if (!companyStatus?.id) throw new Error("Company ID is missing for file upload.")
    
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_")
    // This path is what will be saved to the DB
    const uniqueFileName = `${folder}/${companyStatus.id}/${sanitizedFileName}-${crypto.randomUUID()}`
    
    const { error } = await supabase.storage.from(bucketName).upload(uniqueFileName, file, {
      cacheControl: "3600",
      upsert: false,
    })

    if (error) {
      throw error
    }

    // We simply return the path (e.g., "images/123/my-image-uuid.jpg")
    return uniqueFileName
  }

  const handleSaveProduct = async (
    data: ProductFormData,
    newImages: File[],
    newVideo: File | null,
    removedImageUrls: string[],
  ) => {
    if (!companyStatus?.id || !companyStatus?.is_approved) {
      setSubmissionError("Company not approved or ID missing. Cannot add product.")
      return
    }

    if (newImages.length < 1) {
      setSubmissionError("Please upload at least 1 product image.")
      return
    }

    setIsSaving(true)
    setSubmissionError("")

    try {
      // These will now receive paths, not full URLs
      const uploadImagePromises = newImages.map((file) => uploadFile(file, "product-media", "images"))
      const productPhotoPaths = await Promise.all(uploadImagePromises)

      let productVideoPath: string | null = null
      if (newVideo) {
        productVideoPath = await uploadFile(newVideo, "product-media", "videos")
      }

      const productData = {
        company_id: companyStatus.id,
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
        // Saving paths only
        product_photo_urls: productPhotoPaths, 
        product_video_url: productVideoPath,
        is_approved: false,
      }

      const { error: dbError } = await supabase.from("products").insert([productData])

      if (dbError) {
        throw dbError
      }

      toast({
        title: "Success!",
        description: "Product added successfully. It is pending approval.",
        variant: "default",
      })
      clearAddProductFormState()
      router.push("/company/dashboard/my-products")
    } catch (error: any) {
      console.error("Error adding product:", error)
      setSubmissionError(error.message || "Error adding product. Please try again.")
    } finally {
      setIsSaving(false)
    }
  }

  if (pageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-10 w-10 animate-spin text-green-600" />
        <span className="ml-3 text-lg text-green-700">Loading form...</span>
      </div>
    )
  }

  if (!companyStatus?.is_approved) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center max-w-md w-full">
          <h1 className="text-3xl font-bold text-red-700 mb-4">Access Denied</h1>
          <p className="text-gray-700 mb-6">
            Your company is not yet approved to add products. Please wait for approval.
          </p>
          <Button onClick={() => router.push("/company/dashboard")}>Go to Dashboard</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-100">
      <nav className="w-full h-16 px-6 flex items-center bg-gradient-to-r from-blue-100 via-green-50 to-green-100 shadow-sm rounded-b-2xl mb-8 font-[Inter,sans-serif]">
        <div className="flex items-center gap-3">
          <PlusCircle className="h-7 w-7 text-green-500" />
          <span className="text-xl md:text-2xl font-semibold tracking-tight text-gray-800">Add Product</span>
        </div>
      </nav>
      <div className="container mx-auto px-4 py-8">
        {submissionError && (
          <Alert variant="destructive" className="mb-4 rounded-xl shadow-md bg-red-50 border-red-200">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <AlertDescription className="text-red-700">{submissionError}</AlertDescription>
          </Alert>
        )}
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full border border-green-100">
          <AddEditProductForm
            onSave={handleSaveProduct}
            isLoading={isSaving}
            initialProductData={initialFormState || undefined}
            onValuesChange={setAddProductFormState}
          />
        </div>
      </div>
    </div>
  )
}