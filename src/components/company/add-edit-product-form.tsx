"use client"

import React, { useState, useEffect } from "react"
import { useForm, useFieldArray, Controller } from "react-hook-form"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { AlertCircle, Plus, Upload, X, Loader2, Camera, Video, CheckCircle2, Eye } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

const availableNutrients = ["Protein", "Fat", "Carbs", "Fiber", "Calcium", "Iron", "Vitamin C", "Vitamin D"]

const categoryOptions: { [key: string]: string[] } = {
  "Organic Groceries & Superfoods": [
    "Organic Staples & Grains",
    "Cold-Pressed Oils & Ghee",
    "Organic Spices & Condiments",
    "Superfoods & Immunity Boosters",
    "Natural Sweeteners",
    "Organic Snacks & Beverages",
    "Dairy & Plant-Based Alternatives",
  ],
  "Herbal & Natural Personal Care": [
    "Organic Skincare",
    "Herbal Haircare",
    "Natural Oral Care",
    "Chemical-Free Cosmetics",
    "Organic Fragrances",
  ],
  "Health & Wellness Products": [
    "Ayurvedic & Herbal Supplements",
    "Nutritional Supplements",
    "Detox & Gut Health",
    "Immunity Boosters",
    "Essential Oils & Aromatherapy",
  ],
  "Sustainable Home & Eco-Friendly Living": [
    "Organic Cleaning Products",
    "Reusable & Biodegradable Kitchen Essentials",
    "Organic Gardening",
    "Sustainable Home Décor",
  ],
  "Sustainable Fashion & Accessories": [
    "Organic Cotton & Hemp Clothing",
    "Eco-Friendly Footwear",
    "Bamboo & Wooden Accessories",
    "Handmade & Sustainable Jewelry",
  ],
  "Organic Baby & Kids Care": [
    "Organic Baby Food",
    "Natural Baby Skincare",
    "Eco-Friendly Baby Clothing",
    "Non-Toxic Toys & Accessories",
  ],
  "Organic Pet Care": ["Organic Pet Food", "Herbal Grooming & Skincare", "Natural Pet Supplements"],
  "Special Dietary & Lifestyle Products": [
    "Gluten-Free Foods",
    "Vegan & Plant-Based Alternatives",
    "Keto & Low-Carb Products",
    "Diabetic-Friendly Foods",
  ],
}

// Define a common interface for product form data
export interface ProductFormData {
  productName: string
  productDescription: string
  // --- NEW FIELDS FOR API ---
  sku: string
  hsnCode: string
  taxRate: string
  // -------------------------
  originalPrice: string
  discountPrice: string
  stockQuantity: string
  weight: string
  weightUnit: string // Will be forced to 'kg'
  length: string
  width: string
  height: string
  dimensionUnit: string // Will be forced to 'cm'
  nutrients: Array<{ name: string; value: string }>
  categories: Array<{ main: string; sub: string }>
  existingProductPhotoUrls?: string[]
  existingProductVideoUrl?: string | null
}

interface AddEditProductFormProps {
  initialProductData?: ProductFormData
  onSave: (data: ProductFormData, newImages: File[], newVideo: File | null, removedImageUrls: string[]) => Promise<void>
  isEditMode?: boolean
  isLoading?: boolean
  onValuesChange?: (data: ProductFormData) => void
}

export function AddEditProductForm({
  initialProductData,
  onSave,
  isEditMode = false,
  isLoading = false,
  onValuesChange,
}: AddEditProductFormProps) {
  const { toast } = useToast()

  // Local state for image and video uploads.
  const [selectedImages, setSelectedImages] = useState<File[]>([])
  const [existingImages, setExistingImages] = useState<string[]>([])
  const [removedImageUrls, setRemovedImageUrls] = useState<string[]>([])

  const [selectedVideo, setSelectedVideo] = useState<File | null>(null)
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null)
  const [existingVideoUrl, setExistingVideoUrl] = useState<string | null>(null)

  const [error, setError] = useState("")
  const [isDragOverImages, setIsDragOverImages] = useState(false)
  const [isDragOverVideo, setIsDragOverVideo] = useState(false)

  // Ref for file inputs.
  const imageInputRef = React.useRef<HTMLInputElement>(null)
  const videoInputRef = React.useRef<HTMLInputElement>(null)

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormData>({
    defaultValues: {
      productName: "",
      productDescription: "",
      sku: "",       // Default empty
      hsnCode: "",   // Default empty
      taxRate: "",   // Default empty
      originalPrice: "",
      discountPrice: "",
      stockQuantity: "",
      weight: "",
      weightUnit: "kg", // Forced default
      length: "",
      width: "",
      height: "",
      dimensionUnit: "cm", // Forced default
      nutrients: [],
      categories: [],
    },
  })

  useEffect(() => {
    if (initialProductData) {
      reset({
        productName: initialProductData.productName,
        productDescription: initialProductData.productDescription,
        sku: initialProductData.sku || "",
        hsnCode: initialProductData.hsnCode || "",
        taxRate: initialProductData.taxRate || "",
        originalPrice: initialProductData.originalPrice,
        discountPrice: initialProductData.discountPrice,
        stockQuantity: initialProductData.stockQuantity,
        weight: initialProductData.weight,
        weightUnit: "kg", // Enforce kg on edit
        length: initialProductData.length,
        width: initialProductData.width,
        height: initialProductData.height,
        dimensionUnit: "cm", // Enforce cm on edit
        nutrients: initialProductData.nutrients,
        categories: initialProductData.categories,
      })
      setExistingImages(initialProductData.existingProductPhotoUrls || [])
      setExistingVideoUrl(initialProductData.existingProductVideoUrl || null)
      setVideoPreviewUrl(initialProductData.existingProductVideoUrl || null)
    }
  }, [initialProductData, reset])

  // Field arrays for nutrients and categories.
  const {
    fields: nutrientFields,
    append: appendNutrient,
    remove: removeNutrient,
  } = useFieldArray({ control, name: "nutrients" })
  const {
    fields: categoryFields,
    append: appendCategory,
    remove: removeCategory,
  } = useFieldArray({ control, name: "categories" })

  // Local states for nutrient and category selection.
  const [selectedNutrient, setSelectedNutrient] = useState(availableNutrients[0])
  const [nutrientValue, setNutrientValue] = useState("")
  const mainCategoryKeys = Object.keys(categoryOptions)
  const [selectedMainCategory, setSelectedMainCategory] = useState(mainCategoryKeys[0])
  const [selectedSubCategory, setSelectedSubCategory] = useState(categoryOptions[mainCategoryKeys[0]][0])

  // Watch current form values for preview and parent updates.
  const watchedValues = watch()

  // Notify parent of changes
  useEffect(() => {
    if (onValuesChange) {
      onValuesChange(watchedValues as ProductFormData)
    }
  }, [watchedValues, onValuesChange])

  // Handle image file change and drag/drop
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files) {
      const fileArray = Array.from(files)
      if (selectedImages.length + existingImages.length + fileArray.length > 5) {
        setError("You can upload a maximum of 5 images (including existing ones).")
        return
      }
      setSelectedImages((prev) => [...prev, ...fileArray])
      setError("")
    }
  }

  const handleImageDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOverImages(false)
    const files = e.dataTransfer.files
    if (files) {
      const fileArray = Array.from(files)
      if (selectedImages.length + existingImages.length + fileArray.length > 5) {
        setError("You can upload a maximum of 5 images (including existing ones).")
        return
      }
      setSelectedImages((prev) => [...prev, ...fileArray])
      setError("")
    }
  }

  const handleImageDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOverImages(true)
  }

  const handleImageDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOverImages(false)
  }

  const handleRemoveNewImage = (index: number) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index))
  }

  const handleRemoveExistingImage = (url: string) => {
    setExistingImages((prev) => prev.filter((imgUrl) => imgUrl !== url))
    setRemovedImageUrls((prev) => [...prev, url])
  }

  // Handle video file change and drag/drop
  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    if (file) {
      if (file.size > 50 * 1024 * 1024) {
        // 50MB limit for video
        setError("Video file must be under 50MB.")
        setSelectedVideo(null)
        setVideoPreviewUrl(null)
        return
      }
      setSelectedVideo(file)
      setVideoPreviewUrl(URL.createObjectURL(file))
      setExistingVideoUrl(null) // Clear existing video if new one is selected
      setError("")
    } else {
      setSelectedVideo(null)
      setVideoPreviewUrl(null)
    }
  }

  const handleVideoDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOverVideo(false)
    const file = e.dataTransfer.files?.[0] || null
    if (file) {
      if (file.size > 50 * 1024 * 1024) {
        // 50MB limit for video
        setError("Video file must be under 50MB.")
        setSelectedVideo(null)
        setVideoPreviewUrl(null)
        return
      }
      setSelectedVideo(file)
      setVideoPreviewUrl(URL.createObjectURL(file))
      setExistingVideoUrl(null) // Clear existing video if new one is selected
      setError("")
    } else {
      setSelectedVideo(null)
      setVideoPreviewUrl(null)
    }
  }

  const handleVideoDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOverVideo(true)
  }

  const handleVideoDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOverVideo(false)
  }

  const handleRemoveVideo = () => {
    setSelectedVideo(null)
    setVideoPreviewUrl(null)
    setExistingVideoUrl(null) // Also clear existing video
  }

  // Handler for adding a nutrient.
  const handleAddNutrient = () => {
    if (!nutrientValue.trim()) {
      toast({
        title: "Value required",
        description: "Please enter a value for the nutrient",
        variant: "destructive",
      })
      return
    }
    if (nutrientFields.find((n) => n.name === selectedNutrient)) {
      toast({
        title: "Nutrient already added",
        description: `${selectedNutrient} is already in the list`,
        variant: "destructive",
      })
      return
    }
    appendNutrient({ name: selectedNutrient, value: nutrientValue })
    setNutrientValue("")
    setError("")
  }

  // Handler for adding a category.
  const handleAddCategory = () => {
    if (categoryFields.find((cat) => cat.main === selectedMainCategory && cat.sub === selectedSubCategory)) {
      toast({
        title: "Category already added",
        description: `${selectedMainCategory} > ${selectedSubCategory} is already in the list`,
        variant: "destructive",
      })
      return
    }
    appendCategory({ main: selectedMainCategory, sub: selectedSubCategory })
    setError("")
  }

  // Form submission handler.
  const onSubmit = async (data: ProductFormData) => {
    if (selectedImages.length + existingImages.length < 1) {
      setError("Please upload at least 1 product image.")
      return
    }
    setError("") // Clear previous errors

    await onSave(data, selectedImages, selectedVideo, removedImageUrls)
  }

  const totalImagesCount = selectedImages.length + existingImages.length

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Form Section */}
      <div className="lg:col-span-2 space-y-8">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Basic Information */}
        <Card className="rounded-2xl shadow-xl border-0 bg-gradient-to-br from-blue-50 via-white to-green-50">
          <CardHeader>
            <CardTitle className="text-xl">Basic Information</CardTitle>
            <CardDescription>Provide essential details about your product.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="productName" className="text-sm font-medium">
                Product Name *
              </Label>
              <Input
                id="productName"
                {...register("productName", { required: "Product name is required" })}
                placeholder="Enter a descriptive product name"
                className={cn(
                  "h-11 transition-all duration-200",
                  errors.productName && "border-red-500 focus:border-red-500",
                )}
              />
              {errors.productName && (
                <p className="text-red-500 text-sm flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  {errors.productName.message}
                </p>
              )}
            </div>

            {/* NEW FIELDS FOR DELIVERY API: SKU, HSN, TAX */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sku" className="text-sm font-medium">SKU (Optional)</Label>
                <Input
                  id="sku"
                  {...register("sku")}
                  placeholder="e.g. ORG-001"
                  className="h-11"
                />
                <p className="text-[10px] text-gray-500">Stock Keeping Unit for warehouse.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="hsnCode" className="text-sm font-medium">HSN Code *</Label>
                <Input
                  id="hsnCode"
                  {...register("hsnCode", { required: "HSN Code is required for shipping" })}
                  placeholder="e.g. 1006"
                  className={cn("h-11", errors.hsnCode && "border-red-500")}
                />
                 {errors.hsnCode && (
                  <p className="text-red-500 text-xs">{errors.hsnCode.message}</p>
                )}
                <p className="text-[10px] text-gray-500">Required for GST Invoice.</p>
              </div>
              <div className="space-y-2">
                 <Label htmlFor="taxRate" className="text-sm font-medium">Tax Rate (%)</Label>
                 <Input
                  id="taxRate"
                  type="number"
                  step="0.01"
                  {...register("taxRate")}
                  placeholder="e.g. 5 or 12"
                  className="h-11"
                 />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="productDescription" className="text-sm font-medium">
                Product Description *
              </Label>
              <Textarea
                id="productDescription"
                {...register("productDescription", { required: "Product description is required" })}
                placeholder="Describe your product in detail. Include key features, benefits, and usage instructions."
                className={cn(
                  "min-h-[120px] resize-y transition-all duration-200",
                  errors.productDescription && "border-red-500 focus:border-red-500",
                )}
              />
              {errors.productDescription && (
                <p className="text-red-500 text-sm flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  {errors.productDescription.message}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Pricing & Inventory */}
        <Card className="rounded-2xl shadow-xl border-0 bg-gradient-to-br from-pink-50 via-white to-yellow-50">
          <CardHeader>
            <CardTitle className="text-xl">Pricing & Inventory</CardTitle>
            <CardDescription>Set your product's pricing and manage stock.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="originalPrice" className="text-sm font-medium">
                  Original Price (₹) *
                </Label>
                <Input
                  id="originalPrice"
                  type="number"
                  step="0.01"
                  {...register("originalPrice", {
                    required: "Original price is required",
                    min: { value: 0, message: "Price cannot be negative" },
                  })}
                  placeholder="0.00"
                  className={cn(
                    "h-11 transition-all duration-200",
                    errors.originalPrice && "border-red-500 focus:border-red-500",
                  )}
                />
                {errors.originalPrice && (
                  <p className="text-red-500 text-sm flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" />
                    {errors.originalPrice.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="discountPrice" className="text-sm font-medium">
                  Selling Price (₹) *
                </Label>
                <Input
                  id="discountPrice"
                  type="number"
                  step="0.01"
                  {...register("discountPrice", {
                    required: "Selling price is required",
                    min: { value: 0, message: "Price cannot be negative" },
                  })}
                  placeholder="0.00"
                  className={cn(
                    "h-11 transition-all duration-200",
                    errors.discountPrice && "border-red-500 focus:border-red-500",
                  )}
                />
                {errors.discountPrice && (
                  <p className="text-red-500 text-sm flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" />
                    {errors.discountPrice.message}
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="stockQuantity" className="text-sm font-medium">
                Stock Quantity *
              </Label>
              <Input
                id="stockQuantity"
                type="number"
                {...register("stockQuantity", {
                  required: "Stock quantity is required",
                  min: { value: 0, message: "Stock cannot be negative" },
                })}
                placeholder="Enter available stock quantity"
                className={cn(
                  "h-11 transition-all duration-200",
                  errors.stockQuantity && "border-red-500 focus:border-red-500",
                )}
              />
              {errors.stockQuantity && (
                <p className="text-red-500 text-sm flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  {errors.stockQuantity.message}
                </p>
              )}
            </div>
            {watchedValues.originalPrice && watchedValues.discountPrice && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-green-800">Discount</span>
                  <span className="text-lg font-bold text-green-600">
                    {Math.round(
                      (1 -
                        Number.parseFloat(watchedValues.discountPrice) /
                        Number.parseFloat(watchedValues.originalPrice)) *
                      100,
                    )}
                    % OFF
                  </span>
                </div>
                <div className="text-sm text-green-700 mt-1">
                  Customers save ₹
                  {(
                    Number.parseFloat(watchedValues.originalPrice) - Number.parseFloat(watchedValues.discountPrice)
                  ).toFixed(2)}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dimensions */}
        <Card className="rounded-2xl shadow-xl border-0 bg-gradient-to-br from-green-50 via-white to-blue-50">
          <CardHeader>
            <CardTitle className="text-xl">Dimensions & Shipping</CardTitle>
            <CardDescription>
              <span className="font-bold text-red-600">Important:</span> Exact values required for Delivery API. 
              Units are strictly <strong>Kilograms (kg)</strong> and <strong>Centimeters (cm)</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="weight" className="text-sm font-medium">
                Weight *
              </Label>
              <div className="relative">
                <Input
                  id="weight"
                  type="number"
                  step="0.001"
                  {...register("weight", {
                    required: "Weight is required",
                    min: { value: 0, message: "Weight cannot be negative" },
                  })}
                  placeholder="0.00"
                  className={cn(
                    "h-11 pr-10 transition-all duration-200",
                    errors.weight && "border-red-500 focus:border-red-500",
                  )}
                />
                {/* FORCED UNIT DISPLAY INSTEAD OF SELECTOR */}
                <div className="absolute right-0 top-0 bottom-0 flex items-center justify-center bg-gray-100 border-l px-3 rounded-r-md text-sm font-medium text-gray-600">
                  kg
                </div>
              </div>
              {errors.weight && (
                <p className="text-red-500 text-sm flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  {errors.weight.message}
                </p>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="length" className="text-sm font-medium">
                  Length *
                </Label>
                <div className="relative">
                  <Input
                    id="length"
                    type="number"
                    step="0.1"
                    {...register("length", {
                      required: "Length is required",
                      min: { value: 0, message: "Length cannot be negative" },
                    })}
                    placeholder="0.0"
                    className={cn(
                      "h-11 pr-10 transition-all duration-200",
                      errors.length && "border-red-500 focus:border-red-500",
                    )}
                  />
                  <div className="absolute right-0 top-0 bottom-0 flex items-center justify-center bg-gray-100 border-l px-3 rounded-r-md text-sm font-medium text-gray-600">
                    cm
                  </div>
                </div>
                {errors.length && (
                  <p className="text-red-500 text-sm flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" />
                    {errors.length.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="width" className="text-sm font-medium">
                  Width *
                </Label>
                <div className="relative">
                  <Input
                    id="width"
                    type="number"
                    step="0.1"
                    {...register("width", {
                      required: "Width is required",
                      min: { value: 0, message: "Width cannot be negative" },
                    })}
                    placeholder="0.0"
                    className={cn(
                      "h-11 pr-10 transition-all duration-200",
                      errors.width && "border-red-500 focus:border-red-500",
                    )}
                  />
                  <div className="absolute right-0 top-0 bottom-0 flex items-center justify-center bg-gray-100 border-l px-3 rounded-r-md text-sm font-medium text-gray-600">
                    cm
                  </div>
                </div>
                {errors.width && (
                  <p className="text-red-500 text-sm flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" />
                    {errors.width.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="height" className="text-sm font-medium">
                  Height *
                </Label>
                <div className="relative">
                   <Input
                    id="height"
                    type="number"
                    step="0.1"
                    {...register("height", {
                      required: "Height is required",
                      min: { value: 0, message: "Height cannot be negative" },
                    })}
                    placeholder="0.0"
                    className={cn(
                      "h-11 pr-10 transition-all duration-200",
                      errors.height && "border-red-500 focus:border-red-500",
                    )}
                  />
                  <div className="absolute right-0 top-0 bottom-0 flex items-center justify-center bg-gray-100 border-l px-3 rounded-r-md text-sm font-medium text-gray-600">
                    cm
                  </div>
                </div>
                {errors.height && (
                  <p className="text-red-500 text-sm flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" />
                    {errors.height.message}
                  </p>
                )}
              </div>
            </div>
            
          </CardContent>
        </Card>

        {/* Details (Nutrients & Categories) */}
        <Card className="rounded-2xl shadow-xl border-0 bg-gradient-to-br from-yellow-50 via-white to-pink-50">
          <CardHeader>
            <CardTitle className="text-xl">Additional Details</CardTitle>
            <CardDescription>Add nutritional information and categorize your product.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* Nutrients Section */}
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Nutritional Information</h3>
                <p className="text-sm text-muted-foreground">
                  Add nutritional details to help customers make informed choices (optional)
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Select value={selectedNutrient} onValueChange={setSelectedNutrient}>
                  <SelectTrigger className="w-full sm:w-1/3 h-11">
                    <SelectValue placeholder="Select nutrient" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableNutrients.map((nutrient) => (
                      <SelectItem key={nutrient} value={nutrient}>
                        {nutrient}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={nutrientValue}
                  onChange={(e) => setNutrientValue(e.target.value)}
                  placeholder="Enter value (e.g., 2g, 150mg)"
                  className="w-full sm:w-1/3 h-11"
                />
                <Button type="button" onClick={handleAddNutrient} className="w-full sm:w-auto h-11 bg-gradient-to-r from-blue-500 to-green-400 text-white font-semibold border-0 rounded-lg shadow-md hover:scale-105 hover:from-green-400 hover:to-blue-500 transition-transform duration-200">
                  <Plus className="h-4 w-4 mr-2" />
                  Add
                </Button>
              </div>
              {nutrientFields.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {nutrientFields.map((nutrient, index) => (
                    <Badge key={nutrient.id} variant="secondary" className="flex items-center gap-2 px-3 py-2 text-sm">
                      <span className="font-medium">{nutrient.name}:</span>
                      <span>{nutrient.value}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 ml-1 text-muted-foreground hover:text-foreground"
                        onClick={() => removeNutrient(index)}
                      >
                        <X className="h-3 w-3" />
                        <span className="sr-only">Remove</span>
                      </Button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <Separator />
            {/* Categories Section */}
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Product Categories</h3>
                <p className="text-sm text-muted-foreground">
                  Categorize your product to help customers find it easily
                </p>
              </div>
              {/* FIX 1: Adjusted layout for better stacking on mobile */}
              <div className="flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row gap-3 w-full">
                  <Select
                    value={selectedMainCategory}
                    onValueChange={(value) => {
                      setSelectedMainCategory(value)
                      setSelectedSubCategory(categoryOptions[value][0])
                    }}
                  >
                    <SelectTrigger className="w-full sm:w-1/2 h-11">
                      <SelectValue placeholder="Main category" />
                    </SelectTrigger>
                    <SelectContent>
                      {mainCategoryKeys.map((main) => (
                        <SelectItem key={main} value={main}>
                          {main}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={selectedSubCategory} onValueChange={setSelectedSubCategory}>
                    <SelectTrigger className="w-full sm:w-1/2 h-11">
                      <SelectValue placeholder="Sub category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categoryOptions[selectedMainCategory].map((sub) => (
                        <SelectItem key={sub} value={sub}>
                          {sub}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* Add button below dropdowns on small screens for cleaner flow */}
                <Button type="button" onClick={handleAddCategory} className="w-full sm:w-auto h-11 bg-gradient-to-r from-blue-500 to-green-400 text-white font-semibold border-0 rounded-lg shadow-md hover:scale-105 hover:from-green-400 hover:to-blue-500 transition-transform duration-200">
                  <Plus className="h-4 w-4 mr-2" />
                  Add
                </Button>
              </div>
              {categoryFields.length > 0 && (
                // *** FIX START: Added max-w-full to container and max-w-[90%] and break-words to the span for category text
                <div className="flex flex-wrap gap-2 max-w-full">
                  {categoryFields.map((cat, index) => (
                    <Badge key={cat.id} variant="outline" className="flex items-center gap-2 px-3 py-2 text-sm max-w-full">
                      <span className="break-words max-w-[90%]">
                        {cat.main} → {cat.sub}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 ml-1 text-muted-foreground hover:text-foreground flex-shrink-0" // flex-shrink-0 keeps the button from shrinking
                        onClick={() => removeCategory(index)}
                      >
                        <X className="h-3 w-3" />
                        <span className="sr-only">Remove</span>
                      </Button>
                    </Badge>
                  ))}
                </div>
                // *** FIX END
              )}
            </div>
          </CardContent>
        </Card>

        {/* Images */}
        <Card className="rounded-2xl shadow-xl border-0 bg-gradient-to-br from-pink-100 via-yellow-50 to-green-100">
          <CardHeader>
            <CardTitle className="text-xl">Product Images</CardTitle>
            <CardDescription>
              Upload high-quality images to showcase your product (1-5 images required).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              onDrop={handleImageDrop}
              onDragOver={handleImageDragOver}
              onDragLeave={handleImageDragLeave}
              className={cn(
                "border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200",
                isDragOverImages ? "border-green-500 bg-green-50" : "border-gray-300",
                totalImagesCount > 0 && "border-green-500 bg-green-50",
              )}
            >
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-colors",
                    isDragOverImages ? "bg-green-100" : totalImagesCount > 0 ? "bg-green-100" : "bg-gray-100",
                  )}
                >
                  {totalImagesCount > 0 ? (
                    <CheckCircle2 className="h-8 w-8 text-green-600" />
                  ) : (
                    <Upload className="h-8 w-8 text-gray-600" />
                  )}
                </div>
                <h4 className="text-lg font-medium mb-2">
                  {totalImagesCount > 0 ? `${totalImagesCount} image(s) selected` : "Upload Product Images"}
                </h4>
                <p className="text-sm text-muted-foreground mb-4">Drag and drop images here or click to browse</p>
                <p className="text-xs text-muted-foreground mb-6">
                  Supports PNG, JPG, JPEG • Max 5 images • Recommended: 1000x1000px
                </p>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageChange}
                  className="hidden"
                  id="image-upload"
                />
                <Button
                  type="button"
                  variant={totalImagesCount > 0 ? "outline" : "default"}
                  onClick={() => imageInputRef.current?.click()}
                  className="h-11 bg-gradient-to-r from-blue-500 to-green-400 text-white font-semibold border-0 rounded-lg shadow-md hover:scale-105 hover:from-green-400 hover:to-blue-500 transition-transform duration-200"
                  disabled={totalImagesCount >= 5}
                >
                  <Camera className="h-4 w-4 mr-2" />
                  {totalImagesCount > 0 ? "Add More Images" : "Select Images"}
                </Button>
              </div>
            </div>
            {totalImagesCount > 0 && (
              <div className="space-y-4">
                <h4 className="font-medium">Image Preview</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {existingImages.map((url, index) => (
                    <div key={`existing-${index}`} className="relative group">
                      <div className="aspect-square rounded-lg overflow-hidden border-2 border-gray-200">
                        <img
                          src={url || "/placeholder.svg"}
                          alt={`Existing Preview ${index + 1}`}
                          className="object-cover w-full h-full transition-transform group-hover:scale-105"
                          crossOrigin="anonymous"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                        onClick={() => handleRemoveExistingImage(url)}
                      >
                        <X className="h-3 w-3" />
                        <span className="sr-only">Remove image</span>
                      </Button>
                      {index === 0 && <Badge className="absolute bottom-2 left-2 text-xs">Primary</Badge>}
                    </div>
                  ))}
                  {selectedImages.map((file, index) => (
                    <div key={`new-${index}`} className="relative group">
                      <div className="aspect-square rounded-lg overflow-hidden border-2 border-gray-200">
                        <img
                          src={URL.createObjectURL(file) || "/placeholder.svg"}
                          alt={`New Preview ${index + 1}`}
                          className="object-cover w-full h-full transition-transform group-hover:scale-105"
                          crossOrigin="anonymous"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                        onClick={() => handleRemoveNewImage(index)}
                      >
                        <X className="h-3 w-3" />
                        <span className="sr-only">Remove image</span>
                      </Button>
                      {existingImages.length === 0 && index === 0 && (
                        <Badge className="absolute bottom-2 left-2 text-xs">Primary</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Video Upload (Optional) */}
        <Card className="rounded-2xl shadow-xl border-0 bg-gradient-to-br from-blue-100 via-purple-50 to-pink-100">
          <CardHeader>
            <CardTitle className="text-xl">Product Video (Optional)</CardTitle>
            <CardDescription>Upload a short video to showcase your product (Max 50MB).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              onDrop={handleVideoDrop}
              onDragOver={handleVideoDragOver}
              onDragLeave={handleVideoDragLeave}
              className={cn(
                "border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200",
                isDragOverVideo ? "border-green-500 bg-green-50" : "border-gray-300",
                (selectedVideo || existingVideoUrl) && "border-green-500 bg-green-50",
              )}
            >
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-colors",
                    isDragOverVideo
                      ? "bg-green-100"
                      : selectedVideo || existingVideoUrl
                        ? "bg-green-100"
                        : "bg-gray-100",
                  )}
                >
                  {selectedVideo || existingVideoUrl ? (
                    <CheckCircle2 className="h-8 w-8 text-green-600" />
                  ) : (
                    <Video className="h-8 w-8 text-gray-600" />
                  )}
                </div>
                <h4 className="text-lg font-medium mb-2">
                  {selectedVideo?.name || existingVideoUrl ? "Video selected" : "Upload Product Video"}
                </h4>
                <p className="text-sm text-muted-foreground mb-4">Drag and drop video here or click to browse</p>
                <p className="text-xs text-muted-foreground mb-6">Supports MP4, MOV • Max 50MB</p>
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/mp4,video/quicktime"
                  onChange={handleVideoChange}
                  className="hidden"
                  id="video-upload"
                />
                <Button
                  type="button"
                  variant={selectedVideo || existingVideoUrl ? "outline" : "default"}
                  onClick={() => videoInputRef.current?.click()}
                  className="h-11 bg-gradient-to-r from-blue-500 to-green-400 text-white font-semibold border-0 rounded-lg shadow-md hover:scale-105 hover:from-green-400 hover:to-blue-500 transition-transform duration-200"
                >
                  <Video className="h-4 w-4 mr-2" />
                  {selectedVideo || existingVideoUrl ? "Change Video" : "Select Video"}
                </Button>
              </div>
            </div>
            {(videoPreviewUrl || existingVideoUrl) && (
              <div className="space-y-4">
                <h4 className="font-medium">Video Preview</h4>
                <div className="relative group aspect-video rounded-lg overflow-hidden border-2 border-gray-200 bg-black">
                  <video
                    src={videoPreviewUrl || existingVideoUrl || ""}
                    controls
                    className="w-full h-full object-contain"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                    onClick={handleRemoveVideo}
                  >
                    <X className="h-3 w-3" />
                    <span className="sr-only">Remove video</span>
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Submit Buttonssssssssss */}
        <div className="pt-6 border-t">
          <Button
            type="submit"
            disabled={isSubmitting || isLoading}
            className="h-12 w-full bg-gradient-to-r from-blue-500 to-green-400 text-white font-bold text-lg border-0 rounded-xl shadow-xl hover:scale-105 hover:from-green-400 hover:to-blue-500 transition-transform duration-200 tracking-tight"
          >
            {isSubmitting || isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isEditMode ? "Saving Changes..." : "Adding Product..."}
              </>
            ) : isEditMode ? (
              "Save Changes"
            ) : (
              "Add Product"
            )}
          </Button>
        </div>
      </div>

      {/* Product Preview Section */}
      <div className="lg:col-span-1">
        <Card className="sticky top-24 shadow-xl border-0 rounded-2xl bg-gradient-to-br from-green-50 via-white to-blue-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Live Preview
            </CardTitle>
            <CardDescription>See how your product will appear to customers</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Product Image */}
            <div className="aspect-square rounded-lg overflow-hidden border bg-gray-50">
              {totalImagesCount > 0 ? (
                <img
                  src={
                    existingImages[0] ||
                    (selectedImages.length > 0 ? URL.createObjectURL(selectedImages[0]) : "/placeholder.svg")
                  }
                  alt="Product preview"
                  className="object-cover w-full h-full"
                  crossOrigin="anonymous"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">
                  <div className="text-center">
                    <Camera className="h-12 w-12 mx-auto mb-2" />
                    <p className="text-sm">No image uploaded</p>
                  </div>
                </div>
              )}
            </div>
            {/* Product Info */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg leading-tight">{watchedValues.productName || "Product Name"}</h3>
              <div className="text-xs text-gray-500 mb-1">
                 {watchedValues.sku ? `SKU: ${watchedValues.sku}` : ""}
              </div>
              {/* Price Display */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-2xl font-bold text-green-600">₹{watchedValues.discountPrice || "0.00"}</span>
                {watchedValues.originalPrice && watchedValues.originalPrice !== watchedValues.discountPrice && (
                  <>
                    <span className="text-lg text-gray-500 line-through">₹{watchedValues.originalPrice}</span>
                    <Badge variant="destructive" className="text-xs">
                      {Math.round(
                        (1 -
                          Number.parseFloat(watchedValues.discountPrice || "0") /
                          Number.parseFloat(watchedValues.originalPrice)) *
                        100,
                      )}
                      % OFF
                    </Badge>
                  </>
                )}
              </div>
              {/* Stock Info */}
              {watchedValues.stockQuantity && (
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "w-2 h-2 rounded-full",
                      Number.parseInt(watchedValues.stockQuantity) > 10
                        ? "bg-green-500"
                        : Number.parseInt(watchedValues.stockQuantity) > 0
                          ? "bg-yellow-500"
                          : "bg-red-500",
                    )}
                  />
                  <span className="text-sm text-gray-600">
                    {Number.parseInt(watchedValues.stockQuantity) > 0
                      ? `${watchedValues.stockQuantity} in stock`
                      : "Out of stock"}
                  </span>
                </div>
              )}
              {/* Dimensions */}
              {watchedValues.weight && (
                <div className="text-sm text-gray-600 space-y-1">
                  <div className="flex justify-between">
                    <span>Weight:</span>
                    <span className="font-medium">
                      {watchedValues.weight} kg
                    </span>
                  </div>
                  {watchedValues.length && watchedValues.width && watchedValues.height && (
                    <div className="flex justify-between">
                      <span>Dimensions:</span>
                      <span className="font-medium">
                        {watchedValues.length} × {watchedValues.width} × {watchedValues.height}{" "}
                        cm
                      </span>
                    </div>
                  )}
                </div>
              )}
              <Separator />
              {/* Description */}
              <div>
                <h4 className="font-medium text-sm mb-2">Description</h4>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {watchedValues.productDescription || "No description provided yet..."}
                </p>
              </div>
              {/* Nutrients */}
              {nutrientFields.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-medium text-sm mb-3">Nutritional Information</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {nutrientFields.map((nutrient, idx) => (
                        <div key={idx} className="flex justify-between text-sm py-1">
                          <span className="text-gray-600">{nutrient.name}</span>
                          <span className="font-medium">{nutrient.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
              {/* Categories */}
              {categoryFields.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-medium text-sm mb-2">Categories</h4>
                    <div className="flex flex-wrap gap-1">
                      {categoryFields.map((cat, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {cat.sub}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </form>
  );
}