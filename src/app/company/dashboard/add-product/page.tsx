"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { AlertCircle, Loader2, Plus, ArrowLeft } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { AddEditProductForm, type ProductFormData } from "@/components/company/add-edit-product-form"
import { useDashboardStore } from "@/store/useDashboardStore"

export default function AddProductPage() {
  const router = useRouter()
  const { toast } = useToast()

  const companyStatus = useDashboardStore((state) => state.companyStatus)
  const setCompanyStatus = useDashboardStore((state) => state.setCompanyStatus)
  const setAddProductFormState = useDashboardStore((state) => state.setAddProductFormState)
  const clearAddProductFormState = useDashboardStore((state) => state.clearAddProductFormState)

  const [initialFormState] = useState<ProductFormData | undefined>(() => {
    const state = useDashboardStore.getState().addProductFormState
    if (!state) return undefined

    return {
      ...state,
      sku: state.sku || "",
      hsnCode: state.hsnCode || "",
      taxRate: state.taxRate || "",
      weightUnit: "kg", 
      dimensionUnit: "cm", 
    } as ProductFormData
  })

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
        .maybeSingle()

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

  const uploadFile = async (file: File, bucketName: string, folder: string) => {
    if (!companyStatus?.id) throw new Error("Company ID is missing for file upload.")

    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_")
    const uniqueFileName = `${folder}/${companyStatus.id}/${sanitizedFileName}-${crypto.randomUUID()}`

    const { error } = await supabase.storage.from(bucketName).upload(uniqueFileName, file, {
      cacheControl: "3600",
      upsert: false,
    })

    if (error) {
      throw error
    }

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
        sku: data.sku,
        hsn_code: data.hsnCode,
        tax_rate: data.taxRate ? Number.parseFloat(data.taxRate) : 0,
        original_price: Number.parseFloat(data.originalPrice),
        discount_price: Number.parseFloat(data.discountPrice),
        stock_quantity: Number.parseInt(data.stockQuantity, 10),
        weight: Number.parseFloat(data.weight),
        weight_unit: "kg", 
        length: Number.parseFloat(data.length),
        width: Number.parseFloat(data.width),
        height: Number.parseFloat(data.height),
        dimension_unit: "cm", 
        nutrients: data.nutrients,
        categories: data.categories,
        product_photo_urls: productPhotoPaths,
        product_video_url: productVideoPath,
        is_approved: true,
      }

      const { error: dbError } = await supabase.from("products").insert([productData])

      if (dbError) {
        throw dbError
      }

      toast({
        title: "Success",
        description: "Product added successfully.",
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

  // Loading State
  if (pageLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#fafafa]">
        <Loader2 className="h-5 w-5 animate-spin text-slate-900 mb-3" />
        <span className="text-xs font-medium text-slate-500 uppercase tracking-widest">Loading Workspace</span>
      </div>
    )
  }

  // Access Denied State
  if (!companyStatus?.is_approved) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#fafafa] p-4">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 text-center max-w-sm w-full">
          <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="h-5 w-5 text-red-600" />
          </div>
          <h1 className="text-base font-semibold text-slate-900 mb-1">Access Restricted</h1>
          <p className="text-xs text-slate-500 mb-6 leading-relaxed">
            Your company account is currently pending approval. You cannot add products at this time.
          </p>
          <Button onClick={() => router.push("/company/dashboard")} className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs h-9">
            Return to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  // Main UI
  return (
    <div className="min-h-screen bg-[#fafafa] font-sans text-slate-900 pb-20 selection:bg-slate-200">
      
      {/* Sticky Top Bar */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild className="h-8 w-8 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 -ml-2 transition-colors">
              <Link href="/company/dashboard/my-products">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-slate-900 text-white flex items-center justify-center shadow-sm">
                <Plus className="h-3.5 w-3.5" />
              </div>
              <h1 className="text-sm font-bold tracking-tight text-slate-900">Create New Product</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-8">
        
        {/* Page Context */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-slate-900 tracking-tight">Product Details</h2>
          <p className="text-xs text-slate-500 mt-1">Enter the necessary information to list your product in the catalog.</p>
        </div>

        {/* Error Alert */}
        {submissionError && (
          <Alert variant="destructive" className="mb-6 rounded-lg border-red-200 bg-red-50 text-red-800">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs font-medium ml-2">{submissionError}</AlertDescription>
          </Alert>
        )}

        {/* Form Container */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 sm:p-6 lg:p-8">
            <AddEditProductForm
              onSave={handleSaveProduct}
              isLoading={isSaving}
              initialProductData={initialFormState}
              onValuesChange={setAddProductFormState}
            />
          </div>
        </div>
      </main>
    </div>
  )
}