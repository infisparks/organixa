"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase" // Import the Supabase client
import { v4 as uuidv4 } from "uuid"
import { User, Factory, X, AlertCircle } from "lucide-react" // Added X and AlertCircle icons
import Image from "next/image" // Import Image component for the preview
import Cropper from "react-easy-crop"
import getCroppedImg from "@/lib/cropImage"

export default function RegistrationForm() {
  const router = useRouter()

  const [registrationType, setRegistrationType] = useState<"vendor" | "manufacture">("vendor")
  const [companyName, setCompanyName] = useState("")
  const [registerNo, setRegisterNo] = useState("")
  const [companyType, setCompanyType] = useState("LLP") // or 'Pvt'
  const [certificateFile, setCertificateFile] = useState<File | null>(null)
  const [isoFile, setIsoFile] = useState<File | null>(null)
  const [gstNo, setGstNo] = useState("")
  const [companyPersonName, setCompanyPersonName] = useState("")
  const [mobileNumber, setMobileNumber] = useState("")
  const [alternateNumber, setAlternateNumber] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [companyWebsite, setCompanyWebsite] = useState("")
  const [companyAddress, setCompanyAddress] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  
  // State for preview URLs
  const [certificatePreviewUrl, setCertificatePreviewUrl] = useState("")
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreviewUrl, setLogoPreviewUrl] = useState("")

  // State for account details
  const [accountNumber, setAccountNumber] = useState("")
  const [bankName, setBankName] = useState("")
  const [ifscCode, setIfscCode] = useState("")

  // State for delivery details
  const [deliveryType, setDeliveryType] = useState<"self" | "organiza">("self")
  const [estimatedDeliveryTime, setEstimatedDeliveryTime] = useState("")

  // Cropping states
  const [showCropper, setShowCropper] = useState(false)
  const [tempLogoUrl, setTempLogoUrl] = useState("")
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null)

  // General file upload function
  const uploadFile = async (file: File, bucketName: string, folder: string) => {
    const uniqueFileName = `${folder}/${uuidv4()}-${file.name}`
    const { data, error } = await supabase.storage.from(bucketName).upload(uniqueFileName, file, {
      cacheControl: "3600",
      upsert: false,
    })

    if (error) {
      throw error
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(uniqueFileName)
    return publicUrlData.publicUrl
  }

  // Handle certificate file change and preview if image
  const handleCertificateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    setCertificateFile(file)
    if (file && file.type.startsWith("image/")) {
      const previewUrl = URL.createObjectURL(file)
      setCertificatePreviewUrl(previewUrl)
    } else {
      setCertificatePreviewUrl("")
    }
    setMessage("")
  }
  
  // Handle file removal for any field
  const handleFileRemove = (field: 'certificate' | 'iso' | 'logo') => {
    if (field === 'certificate') {
      setCertificateFile(null);
      setCertificatePreviewUrl("");
    } else if (field === 'iso') {
      setIsoFile(null);
    } else if (field === 'logo') {
      setLogoFile(null);
      setLogoPreviewUrl("");
    }
    setMessage("");
  }


  // Handle logo file change - now opens cropper instead of direct validation
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    
    if (file) {
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setTempLogoUrl(reader.result as string);
        setShowCropper(true);
      });
      reader.readAsDataURL(file);
    }
  }

  const onCropComplete = (croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }

  const handleCropSave = async () => {
    try {
      if (!tempLogoUrl || !croppedAreaPixels) return

      const croppedImageBlob = await getCroppedImg(
        tempLogoUrl,
        croppedAreaPixels
      )
      
      if (croppedImageBlob) {
        // Convert blob to File object
        const croppedFile = new File([croppedImageBlob], "logo.jpg", { type: "image/jpeg" })
        
        // Revoke old preview URL if exists
        if (logoPreviewUrl) {
          URL.revokeObjectURL(logoPreviewUrl)
        }
        
        const previewUrl = URL.createObjectURL(croppedImageBlob)
        setLogoFile(croppedFile)
        setLogoPreviewUrl(previewUrl)
        setShowCropper(false)
        setMessage("")
      }
    } catch (e) {
      console.error(e)
      setMessage("Error cropping image")
    }
  }

  const handleCropCancel = () => {
    setShowCropper(false)
    setTempLogoUrl("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage("")

    // Validate required fields
    if (
      !companyName ||
      !registerNo ||
      !companyType ||
      !certificateFile ||
      !gstNo ||
      !companyPersonName ||
      !mobileNumber ||
      !alternateNumber ||
      !email ||
      !password ||
      !companyAddress ||
      !logoFile ||
      !accountNumber ||
      !bankName ||
      !ifscCode
    ) {
      setMessage("Please fill in all required fields.")
      return
    }
    // For manufacture registration the ISO file is required.
    if (registrationType === "manufacture" && !isoFile) {
      setMessage("Please upload the ISO certificate.")
      return
    }
    // If delivery type is 'self', estimated delivery time is required.
    if (deliveryType === "self" && !estimatedDeliveryTime) {
      setMessage("Please enter the estimated delivery time for self delivery.")
      return
    }

    setLoading(true)
    try {
      // Create the user with Supabase Authentication
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      })

      if (authError) {
        throw authError
      }

      const uid = authData.user?.id

      if (!uid) {
        throw new Error("User ID not found after registration.")
      }

      // Upload the certificate file and get its URL
      const certificateUrl = await uploadFile(certificateFile, "company-documents", "certificates")

      // Upload the ISO file if provided (for manufacture it’s required; vendor it’s optional)
      let isoUrl = ""
      if (isoFile) {
        isoUrl = await uploadFile(isoFile, "company-documents", "iso-certificates")
      }

      // Upload the logo file and get its URL
      const logoUrl = await uploadFile(logoFile, "company-documents", "logos")

      // Prepare the registration data to be saved
      const registrationData = {
        user_id: uid, // Use user_id to link to auth.users table
        registration_type: registrationType,
        company_name: companyName,
        registration_number: registerNo,
        company_type: companyType,
        certificate_url: certificateUrl,
        iso_url: isoUrl,
        gst_number: gstNo,
        contact_person_name: companyPersonName,
        mobile_number: mobileNumber,
        alternate_number: alternateNumber,
        email,
        company_website: companyWebsite || null, // Use null for optional empty strings
        company_address: companyAddress,
        company_logo_url: logoUrl,
        account_number: accountNumber,
        bank_name: bankName,
        ifsc_code: ifscCode,
        delivery_type: deliveryType,
        estimated_delivery_time: deliveryType === "self" ? estimatedDeliveryTime : null,
        is_approved: false, // Default to false, requiring admin approval
      }

      // Save the registration data in the Supabase database
      const { error: dbError } = await supabase.from("companies").insert([registrationData])

      if (dbError) {
        throw dbError
      }

      // Registration successful - redirect to the dashboard or a success page
      router.push("/company/dashboard")
    } catch (error: any) {
      console.error("Registration error:", error)
      setMessage(error.message || "Error during registration. Please try again later.")
    } finally {
      setLoading(false)
    }
  }

  // Component to display upload field or file/preview and remove button
  const FileUploadField: React.FC<{
    label: string;
    file: File | null;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onRemove: () => void;
    required?: boolean;
    previewUrl?: string;
  }> = ({ label, file, onChange, onRemove, required, previewUrl }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700">
        {label} {required ? "*" : "(Optional)"}
      </label>
      
      {file ? (
        // Display uploaded file name and remove button
        <div className="mt-1 flex items-center justify-between p-2 border border-green-400 bg-green-50 rounded-lg">
          <span className="text-sm text-green-700 truncate">{file.name}</span>
          <button
            type="button"
            onClick={onRemove}
            className="text-red-500 hover:text-red-700 transition-colors ml-4 p-1 rounded-full hover:bg-white"
            aria-label={`Remove ${label}`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        // Display upload area
        <div className="mt-1 flex justify-center items-center w-full">
          <label className="flex flex-col w-full h-32 border-2 border-dashed hover:border-blue-500 hover:bg-blue-50 rounded-lg cursor-pointer transition-all">
            <div className="flex flex-col justify-center items-center pt-5 pb-6">
              <svg className="w-10 h-10 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <p className="text-sm text-gray-500 mt-2">
                Click to upload {label.split('(')[0].trim()}
              </p>
            </div>
            <input
              type="file"
              accept={label.includes('Logo') ? "image/*" : "image/*,application/pdf"}
              onChange={onChange}
              className="hidden"
              required={required}
            />
          </label>
        </div>
      )}

      {/* Preview Section */}
      {previewUrl && (
        <div className="mt-3 border rounded-lg p-2 bg-gray-50 text-center">
          <p className="text-sm text-gray-600 mb-2">Preview:</p>
          {/* Using Image component for Next.js optimization and correct rendering */}
          <div className="relative mx-auto" style={{ width: '100%', maxWidth: label.includes('Logo') ? '150px' : '200px', height: label.includes('Logo') ? '150px' : '150px' }}>
             <Image
                src={previewUrl}
                alt={`${label} preview`}
                fill
                sizes="(max-width: 768px) 100vw, 30vw"
                className="object-contain"
                unoptimized // Use unoptimized for local Object URLs
             />
          </div>
        </div>
      )}
    </div>
  );


  return (
    <div className="min-h-screen bg-[#F5F6F8] py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-3xl w-full mx-auto">
        <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-xs overflow-hidden">
          {/* Header Section */}
          <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 p-8 text-center">
            <h1 className="text-2xl font-bold text-white tracking-tight">Industrial Partner Registration</h1>
            <p className="text-xs text-indigo-100 mt-1">Register your business to join the Organicza vendor ecosystem.</p>
            <div className="flex justify-center mt-6 space-x-3 px-2">
              <button
                type="button"
                onClick={() => setRegistrationType("vendor")}
                className={`px-5 py-2 rounded-xl text-xs font-semibold flex items-center transition-all ${
                  registrationType === "vendor"
                    ? "bg-white text-indigo-700 shadow-sm"
                    : "bg-indigo-500/30 text-white hover:bg-indigo-500/40"
                }`}
              >
                <User className="w-4 h-4 mr-2" />
                Vendor
              </button>
              <button
                type="button"
                onClick={() => setRegistrationType("manufacture")}
                className={`px-5 py-2 rounded-xl text-xs font-semibold flex items-center transition-all ${
                  registrationType === "manufacture"
                    ? "bg-white text-indigo-700 shadow-sm"
                    : "bg-indigo-500/30 text-white hover:bg-indigo-500/40"
                }`}
              >
                <Factory className="w-4 h-4 mr-2" />
                Manufacturer
              </button>
            </div>
          </div>
          {/* Form Section */}
          <div className="p-8">
            {message && (
              <div className="mb-6 p-4 rounded-lg bg-red-100 border border-red-200 flex items-center text-red-600">
                <AlertCircle className="w-5 h-5 mr-3" />
                <span>{message}</span>
              </div>
            )}
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column - Company Details */}
              <div className="space-y-5">
                {/* Company Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Company Name *</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    required
                    className="mt-1 block w-full p-1 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Company Name"
                  />
                </div>
                {/* Registration Number */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Registration Number *</label>
                  <input
                    type="text"
                    value={registerNo}
                    onChange={(e) => setRegisterNo(e.target.value)}
                    required
                    className="mt-1 block w-full p-1 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Registration Number"
                  />
                </div>
                {/* Company Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Company Type *</label>
                  <select
                    value={companyType}
                    onChange={(e) => setCompanyType(e.target.value)}
                    required
                    className="mt-1 block w-full pr-10 py-2 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="LLP">Limited Liability Partnership (LLP)</option>
                    <option value="Pvt">Private Limited Company</option>
                    <option value="sole_proprietorship">Sole Proprietorship</option>
                    <option value="partnership_firm">Partnership Firm</option>
                    <option value="public_limited_company"> Public Limited Company</option>
                    <option value="opc">One Person Company (OPC)</option>
                    <option value="section_8_company">Section 8 Company (NGO)</option>
                    <option value="cooperative_society">Cooperative Society</option>
                    <option value="producer_company">Producer Company</option>
                    <option value="branch_office">Branch Office (Foreign Company)</option>
                    <option value="liaison_office">Liaison Office (Foreign Company)</option>
                    <option value="project_office">Project Office (Foreign Company)</option>
                    
                  </select>
                </div>
                
                {/* Registered Company Certificate Upload (Custom Component) */}
                <FileUploadField
                    label="Registered Company Certificate"
                    file={certificateFile}
                    onChange={handleCertificateChange}
                    onRemove={() => handleFileRemove('certificate')}
                    required
                    previewUrl={certificatePreviewUrl}
                />
                
                {/* ISO Certificate Upload (Custom Component) */}
                <FileUploadField
                    label="ISO Certificate"
                    file={isoFile}
                    onChange={(e) => setIsoFile(e.target.files?.[0] || null)}
                    onRemove={() => handleFileRemove('iso')}
                    required={registrationType === "manufacture"}
                />

                {/* GST No */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">GST No *</label>
                  <input
                    type="text"
                    value={gstNo}
                    onChange={(e) => setGstNo(e.target.value)}
                    required
                    className="mt-1 block w-full p-1 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="GST Number"
                  />
                </div>
                
                {/* Company Logo Upload (Custom Component) */}
                <FileUploadField
                    label="Company Logo (Square Crop)"
                    file={logoFile}
                    onChange={handleLogoChange}
                    onRemove={() => handleFileRemove('logo')}
                    required
                    previewUrl={logoPreviewUrl}
                />
                
                {/* Account Details */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Account Number *</label>
                  <input
                    type="text"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    required
                    className="mt-1 block w-full p-1 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Account Number"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Bank Name *</label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    required
                    className="mt-1 block w-full p-1 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Bank Name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">IFSC Code *</label>
                  <input
                    type="text"
                    value={ifscCode}
                    onChange={(e) => setIfscCode(e.target.value)}
                    required
                    className="mt-1 block w-full p-1 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="IFSC Code"
                  />
                </div>
                {/* Delivery Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Delivery Type *</label>
                  <select
                    value={deliveryType}
                    onChange={(e) => setDeliveryType(e.target.value as "self" | "organiza")}
                    required
                    className="mt-1 block w-full p-1 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="self">Self Delivery</option>
                    <option value="organiza">Delivery by Organiza</option>
                  </select>
                </div>
                {/* Estimated Delivery Time (if Self Delivery) */}
                {deliveryType === "self" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Estimated Delivery Time (e.g., 24-48hr) *
                    </label>
                    <input
                      type="text"
                      value={estimatedDeliveryTime}
                      onChange={(e) => setEstimatedDeliveryTime(e.target.value)}
                      required={deliveryType === "self"}
                      className="mt-1 block w-full p-1 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      placeholder="Estimated Delivery Time"
                    />
                  </div>
                )}
              </div>
              {/* Right Column - Contact Details */}
              <div className="space-y-5">
                {/* Company Person Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Company Person Name *</label>
                  <input
                    type="text"
                    value={companyPersonName}
                    onChange={(e) => setCompanyPersonName(e.target.value)}
                    required
                    className="mt-1 block w-full p-1 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Contact Person Name"
                  />
                </div>
                {/* Mobile Number */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Mobile Number *</label>
                  <input
                    type="tel"
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value)}
                    required
                    className="mt-1 block w-full p-1 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Mobile Number"
                  />
                </div>
                {/* Alternate Number */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Alternate Number *</label>
                  <input
                    type="tel"
                    value={alternateNumber}
                    onChange={(e) => setAlternateNumber(e.target.value)}
                    required
                    className="mt-1 block w-full p-1 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Alternate Number"
                  />
                </div>
                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email Address *</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="mt-1 block w-full p-1 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Email Address"
                  />
                </div>
                {/* Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Password *</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="mt-1 block w-full p-1 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Password"
                  />
                </div>
                 {/* Company Website (Optional) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Company Website (Optional)</label>
                  <input
                    type="url"
                    value={companyWebsite}
                    onChange={(e) => setCompanyWebsite(e.target.value)}
                    className="mt-1 block w-full p-1 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="https://example.com"
                  />
                </div>
                {/* Company Address */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Company Address *</label>
                  <textarea
                    value={companyAddress}
                    onChange={(e) => setCompanyAddress(e.target.value)}
                    required
                    className="mt-1 block w-full p-1 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Company Address"
                  />
                </div>
              </div>
              {/* Submit Button */}
              <div className="md:col-span-2 pt-6">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md transition-all flex items-center justify-center"
                >
                  {loading ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Processing...
                    </>
                  ) : (
                    "Complete Registration"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Image Cropper Modal */}
      {showCropper && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-800">Crop Company Logo</h3>
              <button 
                onClick={handleCropCancel}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="relative flex-1 bg-gray-100 min-h-[300px] sm:min-h-[400px]">
              <Cropper
                image={tempLogoUrl}
                crop={crop}
                zoom={zoom}
                aspect={1 / 1}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            </div>
            
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Zoom</label>
                <input
                  type="range"
                  value={zoom}
                  min={1}
                  max={3}
                  step={0.1}
                  aria-labelledby="Zoom"
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>
              
              <div className="flex gap-4 pt-2">
                <button
                  onClick={handleCropCancel}
                  className="flex-1 py-2.5 px-4 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCropSave}
                  className="flex-1 py-2.5 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Save Crop
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}