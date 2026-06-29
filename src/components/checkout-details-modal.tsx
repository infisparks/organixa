"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, X, MapPin, User, Phone, Globe, Navigation, AlertCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import RazorpayPayment from "./razorpay-payment" 
import { v4 as uuidv4 } from "uuid" 
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"

interface CheckoutItem {
  productId: string
  productName: string
  quantity: number
  price_at_add: number
}

interface CheckoutDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  items: CheckoutItem[]
  onOrderSuccess: (orderId: string) => void
}

// Updated Address Interface
interface Address {
  id: string
  name: string
  addressLine1: string // API: add (Mandatory)
  addressLine2?: string // API: add2
  addressLine3?: string // API: add3
  city: string
  state: string
  pincode: string
  country: string
  primaryPhone: string
  secondaryPhone?: string
  isDefault: boolean
  lat?: number
  lng?: number
  // Fallback for reading old data
  houseNumber?: string
  street?: string
  area?: string
}

export default function CheckoutDetailsModal({ isOpen, onClose, items, onOrderSuccess }: CheckoutDetailsModalProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showRazorpay, setShowRazorpay] = useState(false)
  const [orderId, setOrderId] = useState("")
  const [paymentMethod, setPaymentMethod] = useState<"razorpay" | "cod">("razorpay")

  // Form states
  const [userName, setUserName] = useState("")
  const [primaryPhone, setPrimaryPhone] = useState("")
  const [secondaryPhone, setSecondaryPhone] = useState("")
  const [userEmail, setUserEmail] = useState("") 

  // Address Form States (Aligned with Delivery API)
  const [addressLine1, setAddressLine1] = useState("")
  const [addressLine2, setAddressLine2] = useState("")
  const [addressLine3, setAddressLine3] = useState("")
  const [country, setCountry] = useState("India")
  const [state, setState] = useState("")
  const [city, setCity] = useState("")
  const [pincode, setPincode] = useState("")
  
  // Geolocation States
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [locationLoading, setLocationLoading] = useState(false)

  // Address Management
  const [userAddresses, setUserAddresses] = useState<Address[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null)
  const [showNewAddressForm, setShowNewAddressForm] = useState(false)
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null)

  const subtotal = items.reduce((sum, item) => sum + item.price_at_add * item.quantity, 0)
  const shippingFee = subtotal > 0 && subtotal < 1000 ? 99 : 0
  const totalAmount = subtotal + shippingFee

  // Fetch user profile
  useEffect(() => {
    const fetchUserProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const userId = session?.user?.id

      if (userId) {
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("name, email, phone, addresses")
          .eq("id", userId)
          .single()

        if (profile) {
          setUserName(profile.name || "")
          setUserEmail(profile.email || "")
          setPrimaryPhone(profile.phone || "")

          if (profile.addresses && profile.addresses.length > 0) {
            setUserAddresses(profile.addresses)
            const defaultAddress = profile.addresses.find((addr: Address) => addr.isDefault) || profile.addresses[0]
            setSelectedAddressId(defaultAddress.id)
            
            // Prefill logic: Handle both new and old DB structures
            fillFormWithAddress(defaultAddress, profile.phone)
            setShowNewAddressForm(false)
          } else {
            setShowNewAddressForm(true)
            setSelectedAddressId("new")
          }
        }
      }
    }
    if (isOpen) {
      fetchUserProfile()
    }
  }, [isOpen])

  const fillFormWithAddress = (addr: Address, profilePhone: string) => {
    setAddressLine1(addr.addressLine1 || addr.houseNumber || "")
    setAddressLine2(addr.addressLine2 || addr.street || "")
    setAddressLine3(addr.addressLine3 || addr.area || "")
    setCity(addr.city || "")
    setState(addr.state || "")
    setPincode(addr.pincode || "")
    setCountry(addr.country || "India")
    setPrimaryPhone(addr.primaryPhone || profilePhone || "")
    setSecondaryPhone(addr.secondaryPhone || "")
    setLat(addr.lat || null)
    setLng(addr.lng || null)
  }

  // Geolocation Handler
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: "Error", description: "Geolocation not supported", variant: "destructive" })
      return
    }
    setLocationLoading(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLat(position.coords.latitude)
        setLng(position.coords.longitude)
        toast({ title: "Location Fetched", description: "Coordinates captured successfully." })
        setLocationLoading(false)
      },
      (error) => {
        setLocationLoading(false)
        console.error(error)
        toast({ title: "Error", description: "Could not fetch location.", variant: "destructive" })
      }
    )
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (
      selectedAddressId === "new" &&
      (!userName || !primaryPhone || !state || !city || !pincode || !addressLine1)
    ) {
      setError("Please fill in all mandatory fields (Name, Phone, Address Line 1, City, State, Pincode).")
      toast({ title: "Missing Details", description: "Please fill in all required fields.", variant: "destructive" })
      return
    }

    if (!selectedAddressId) {
      setError("Please select or add a delivery address.")
      return
    }

    setLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const currentUserId = session?.user?.id

      if (!currentUserId) {
        throw new Error("You must be logged in to place an order.")
      }

      // Prepare shipping address and updated addresses for profile
      let currentShippingAddress: Address | undefined
      let updatedAddressesForProfile: Address[] = [...userAddresses]

      if (selectedAddressId === "new") {
        const newAddress: Address = {
          id: uuidv4(),
          name: `${addressLine1}, ${city}`,
          addressLine1,
          addressLine2: addressLine2 || undefined,
          addressLine3: addressLine3 || undefined,
          city,
          state,
          pincode,
          country,
          primaryPhone,
          secondaryPhone: secondaryPhone || undefined,
          isDefault: true,
          lat: lat || undefined,
          lng: lng || undefined,
        }

        updatedAddressesForProfile = updatedAddressesForProfile.map((addr) => ({ ...addr, isDefault: false }))
        updatedAddressesForProfile.push(newAddress)
        currentShippingAddress = newAddress
      } else if (editingAddressId) {
        updatedAddressesForProfile = userAddresses.map((addr) => {
          if (addr.id === editingAddressId) {
            return {
              ...addr,
              name: `${addressLine1}, ${city}`,
              addressLine1,
              addressLine2: addressLine2 || undefined,
              addressLine3: addressLine3 || undefined,
              city,
              state,
              pincode,
              country,
              primaryPhone,
              secondaryPhone: secondaryPhone || undefined,
              lat: lat || undefined,
              lng: lng || undefined,
            }
          }
          return addr;
        })
        currentShippingAddress = updatedAddressesForProfile.find(addr => addr.id === editingAddressId)
      } else {
        currentShippingAddress = userAddresses.find((addr) => addr.id === selectedAddressId)
        if (currentShippingAddress && lat && lng) {
            currentShippingAddress.lat = lat
            currentShippingAddress.lng = lng
        }
      }

      if (!currentShippingAddress) throw new Error("No address found.")

      if (paymentMethod === "cod") {
        // Update Profile with addresses and contact info
        await supabase.from("user_profiles").update({
            name: userName,
            phone: primaryPhone,
            addresses: updatedAddressesForProfile,
          }).eq("id", currentUserId)

        // Call database RPC to create COD order
        const { data: orderIdFromRpc, error: rpcError } = await supabase.rpc(
          "create_cod_order",
          {
            p_total_amount: totalAmount,
            p_customer_name: userName,
            p_primary_phone: primaryPhone,
            p_secondary_phone: secondaryPhone || null,
            p_country: currentShippingAddress.country,
            p_state: currentShippingAddress.state,
            p_city: currentShippingAddress.city,
            p_pincode: currentShippingAddress.pincode,
            p_area: currentShippingAddress.addressLine3 || null,
            p_street: currentShippingAddress.addressLine2 || null,
            p_house_number: currentShippingAddress.addressLine1 || null,
            p_location: (lat && lng) ? { lat, lng } : null,
            p_shipping_detail: currentShippingAddress,
            p_items: items,
            p_shipping_cost: shippingFee,
            p_tax_amount: 0,
          }
        )

        if (rpcError) throw rpcError

        toast({ title: "Order Successful!", description: "Your order has been placed successfully.", variant: "default" })
        onClose()
        onOrderSuccess(orderIdFromRpc)
      } else {
        // Online payment (Razorpay)
        const { data, error: functionError } = await supabase.functions.invoke("create-razorpay-order", {
          body: { amount: totalAmount },
        })

        if (functionError) {
          throw new Error(functionError.message || "Failed to initialize payment order.")
        }

        if (!data || !data.orderId) {
          throw new Error("Did not receive a valid order ID from payment gateway.")
        }

        setOrderId(data.orderId)
        setShowRazorpay(true)
      }
    } catch (err: any) {
      console.error("Order placement error:", err)
      setError(err.message || "Failed to place order. Please try again.")
      toast({
        title: "Order Error",
        description: err.message || "Could not complete order transaction.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handlePaymentSuccess = async (response: any) => {
    const { data: { session } } = await supabase.auth.getSession()
    const currentUserId = session?.user?.id

    if (!currentUserId) return

    try {
      let currentShippingAddress: Address | undefined
      let updatedAddressesForProfile: Address[] = [...userAddresses]

      // Handle new address creation
      if (selectedAddressId === "new") {
        const newAddress: Address = {
          id: uuidv4(),
          name: `${addressLine1}, ${city}`,
          addressLine1,
          addressLine2: addressLine2 || undefined,
          addressLine3: addressLine3 || undefined,
          city,
          state,
          pincode,
          country,
          primaryPhone,
          secondaryPhone: secondaryPhone || undefined,
          isDefault: true,
          lat: lat || undefined,
          lng: lng || undefined,
        }

        updatedAddressesForProfile = updatedAddressesForProfile.map((addr) => ({ ...addr, isDefault: false }))
        updatedAddressesForProfile.push(newAddress)
        currentShippingAddress = newAddress
      } else if (editingAddressId) {
        updatedAddressesForProfile = userAddresses.map((addr) => {
          if (addr.id === editingAddressId) {
            return {
              ...addr,
              name: `${addressLine1}, ${city}`,
              addressLine1,
              addressLine2: addressLine2 || undefined,
              addressLine3: addressLine3 || undefined,
              city,
              state,
              pincode,
              country,
              primaryPhone,
              secondaryPhone: secondaryPhone || undefined,
              lat: lat || undefined,
              lng: lng || undefined,
            }
          }
          return addr;
        })
        currentShippingAddress = updatedAddressesForProfile.find(addr => addr.id === editingAddressId)
      } else {
        currentShippingAddress = userAddresses.find((addr) => addr.id === selectedAddressId)
        if (currentShippingAddress && lat && lng) {
            currentShippingAddress.lat = lat
            currentShippingAddress.lng = lng
        }
      }

      if (!currentShippingAddress) throw new Error("No address found.")

      // Update Profile with new addresses and contact info
      await supabase.from("user_profiles").update({
          name: userName,
          phone: primaryPhone,
          addresses: updatedAddressesForProfile,
        }).eq("id", currentUserId)

      // Call database RPC to verify signature and save order securely
      const { data: orderIdFromRpc, error: rpcError } = await supabase.rpc(
        "verify_razorpay_payment_and_create_order",
        {
          p_order_id: response.razorpay_order_id || orderId,
          p_payment_id: response.razorpay_payment_id,
          p_signature: response.razorpay_signature,
          p_total_amount: totalAmount,
          p_customer_name: userName,
          p_primary_phone: primaryPhone,
          p_secondary_phone: secondaryPhone || null,
          p_country: currentShippingAddress.country,
          p_state: currentShippingAddress.state,
          p_city: currentShippingAddress.city,
          p_pincode: currentShippingAddress.pincode,
          p_area: currentShippingAddress.addressLine3 || null,
          p_street: currentShippingAddress.addressLine2 || null,
          p_house_number: currentShippingAddress.addressLine1 || null,
          p_location: (lat && lng) ? { lat, lng } : null,
          p_shipping_detail: currentShippingAddress,
          p_items: items,
          p_payment_method: "razorpay",
          p_shipping_cost: shippingFee,
          p_tax_amount: 0,
        }
      )

      if (rpcError) throw rpcError

      toast({ title: "Order Successful!", description: "Your order has been placed successfully.", variant: "default" })
      setShowRazorpay(false)
      onClose()
      onOrderSuccess(orderIdFromRpc)
    } catch (err: any) {
      console.error("Error creating order:", err)
      toast({ title: "Order Error", description: err.message || "Payment successful, but order details could not be saved.", variant: "destructive" })
      setShowRazorpay(false)
    }
  }

  const handlePaymentFailure = (err: any) => {
    toast({ title: "Payment Failed", description: err.description || "Unknown error", variant: "destructive" })
    setShowRazorpay(false)
  }

  const handleAddressSelectionChange = (value: string) => {
    setSelectedAddressId(value)
    setEditingAddressId(null)
    if (value === "new") {
      setShowNewAddressForm(true)
      // Clear fields
      setAddressLine1("")
      setAddressLine2("")
      setAddressLine3("")
      setCity("")
      setState("")
      setPincode("")
      setCountry("India")
      setLat(null)
      setLng(null)
    } else {
      setShowNewAddressForm(false)
      const selected = userAddresses.find((addr) => addr.id === value)
      if (selected) fillFormWithAddress(selected, primaryPhone)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose} modal={!showRazorpay}>
      <DialogContent className="sm:max-w-[600px] p-6 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-center">
          <DialogTitle className="text-2xl font-bold text-gray-900">Complete Your Order</DialogTitle>
          <DialogDescription className="text-gray-600">
            Confirm shipping details for delivery.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <div className="flex items-center gap-2 text-red-600 text-sm p-3 bg-red-50 rounded-md border border-red-200">
            <X className="h-4 w-4" />
            {error}
          </div>
        )}
        <form onSubmit={handleFormSubmit} className="space-y-6 mt-4">
          
          {/* Contact Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="userName">Full Name *</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  id="userName"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  required
                  className="pl-10 h-11"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="primaryPhone">Primary Phone *</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  id="primaryPhone"
                  type="tel"
                  value={primaryPhone}
                  onChange={(e) => setPrimaryPhone(e.target.value)}
                  required
                  className="pl-10 h-11"
                />
              </div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="secondaryPhone">Alt Phone (Optional)</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  id="secondaryPhone"
                  type="tel"
                  value={secondaryPhone}
                  onChange={(e) => setSecondaryPhone(e.target.value)}
                  className="pl-10 h-11"
                />
              </div>
            </div>
          </div>

          {/* Address Selection */}
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-gray-950">Delivery Address</h3>
            {userAddresses.length > 0 && (
              <RadioGroup onValueChange={handleAddressSelectionChange} value={selectedAddressId || ""}>
                <div className="grid grid-cols-1 gap-3">
                  {userAddresses.map((address) => (
                    <div
                      key={address.id}
                      className={`flex justify-between items-center p-3 border rounded-xl hover:bg-slate-50 transition-all ${
                        selectedAddressId === address.id ? "border-purple-600 bg-purple-50/5" : "border-gray-200"
                      }`}
                    >
                      <Label
                        htmlFor={`address-${address.id}`}
                        className="flex items-center space-x-3 cursor-pointer flex-grow"
                      >
                        <RadioGroupItem value={address.id} id={`address-${address.id}`} className="text-purple-600 border-purple-600 focus-visible:ring-purple-500" />
                        <div className="flex flex-col">
                          <span className="font-semibold text-sm text-gray-950">
                            {address.name} {address.isDefault && "(Default)"}
                          </span>
                          <span className="text-xs text-slate-500 truncate max-w-[320px] sm:max-w-[400px]">
                            {address.addressLine1 || address.houseNumber}, {address.addressLine2 || address.street} {address.addressLine3 || address.area}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {address.city}, {address.state} - {address.pincode}
                          </span>
                          {(address.lat || (selectedAddressId === address.id && lat)) && (
                            <span className="text-[10px] text-emerald-600 flex items-center mt-1 font-medium">
                              <Navigation className="w-3 h-3 mr-1"/> GPS Location Attached
                            </span>
                          )}
                        </div>
                      </Label>
                      
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2.5 text-xs text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded-lg flex items-center gap-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAddressId(address.id);
                          setEditingAddressId(address.id);
                          fillFormWithAddress(address, primaryPhone);
                          setShowNewAddressForm(true);
                        }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-pencil"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                        Edit
                      </Button>
                    </div>
                  ))}
                  <div
                    className={`flex items-center p-3 border rounded-xl hover:bg-slate-50 transition-all ${
                      selectedAddressId === "new" ? "border-purple-600 bg-purple-50/5" : "border-gray-200"
                    }`}
                  >
                    <Label
                      htmlFor="address-new"
                      className="flex items-center space-x-3 cursor-pointer w-full"
                    >
                      <RadioGroupItem value="new" id="address-new" className="text-purple-600 border-purple-600 focus-visible:ring-purple-500" />
                      <span className="font-semibold text-sm text-gray-950">Add New Address</span>
                    </Label>
                  </div>
                </div>
              </RadioGroup>
            )}
          </div>

          {/* New/Edit Address Form */}
          {(showNewAddressForm || userAddresses.length === 0) && (
            <div className="space-y-4 border-t pt-4 mt-4">
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-bold text-gray-900">
                  {editingAddressId ? "Edit Address Details" : "New Address Details"}
                </h4>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={handleGetLocation}
                  disabled={locationLoading}
                  className="text-xs h-8 text-blue-600 border-blue-200 bg-blue-50 hover:bg-blue-100"
                >
                   {locationLoading ? <Loader2 className="w-3 h-3 animate-spin mr-1"/> : <Navigation className="w-3 h-3 mr-1"/>}
                   {lat ? "Update Location" : "Detect Location"}
                </Button>
              </div>

               {lat && (
                 <div className="text-xs text-emerald-600 bg-emerald-50 p-2 rounded flex items-center">
                    <Navigation className="w-3 h-3 mr-1"/> Coordinates captured: {lat.toFixed(5)}, {lng?.toFixed(5)}
                 </div>
               )}

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="addressLine1" className="text-xs text-gray-500 font-semibold">Address Line 1 (Flat/House/Building) *</Label>
                  <Input
                    id="addressLine1"
                    placeholder="e.g. Flat 101, Galaxy Apt"
                    value={addressLine1}
                    onChange={(e) => setAddressLine1(e.target.value)}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="addressLine2" className="text-xs text-gray-500 font-semibold">Address Line 2 (Street/Colony)</Label>
                  <Input
                    id="addressLine2"
                    placeholder="e.g. MG Road"
                    value={addressLine2}
                    onChange={(e) => setAddressLine2(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="addressLine3" className="text-xs text-gray-500 font-semibold">Address Line 3 (Landmark)</Label>
                  <Input
                    id="addressLine3"
                    placeholder="e.g. Near City Mall"
                    value={addressLine3}
                    onChange={(e) => setAddressLine3(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="pincode">Pincode *</Label>
                    <Input
                      id="pincode"
                      placeholder="400001"
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city">City *</Label>
                    <Input
                      id="city"
                      placeholder="Mumbai"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="state">State *</Label>
                    <Input
                      id="state"
                      placeholder="Maharashtra"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      required
                    />
                  </div>
                   <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Input
                      id="country"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      disabled
                    />
                  </div>
                </div>

                {!editingAddressId && (
                  <div className="flex items-center space-x-2 pt-2">
                    <Checkbox
                      id="set-default-address"
                      checked={selectedAddressId === "new"}
                      onCheckedChange={(checked: boolean) => {
                        if (checked) setSelectedAddressId("new")
                      }}
                    />
                    <Label htmlFor="set-default-address">Set as Default Address</Label>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Payment Method Selector */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="text-base font-semibold text-gray-900">Payment Method</h3>
            <RadioGroup onValueChange={(val) => setPaymentMethod(val as "razorpay" | "cod")} value={paymentMethod}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Label
                  htmlFor="payment-online"
                  className={`flex items-center space-x-3 p-4 border rounded-xl cursor-pointer hover:bg-slate-50 transition-all ${
                    paymentMethod === "razorpay" ? "border-purple-600 bg-purple-50/20" : "border-gray-200"
                  }`}
                >
                  <RadioGroupItem value="razorpay" id="payment-online" className="text-purple-600 border-purple-600 focus-visible:ring-purple-500" />
                  <div className="flex flex-col">
                    <span className="font-semibold text-sm text-gray-950">Pay Online</span>
                    <span className="text-xs text-gray-500">Cards, UPI, Netbanking</span>
                  </div>
                </Label>
                <Label
                  htmlFor="payment-cod"
                  className={`flex items-center space-x-3 p-4 border rounded-xl cursor-pointer hover:bg-slate-50 transition-all ${
                    paymentMethod === "cod" ? "border-purple-600 bg-purple-50/20" : "border-gray-200"
                  }`}
                >
                  <RadioGroupItem value="cod" id="payment-cod" className="text-purple-600 border-purple-600 focus-visible:ring-purple-500" />
                  <div className="flex flex-col">
                    <span className="font-semibold text-sm text-gray-950">Cash on Delivery</span>
                    <span className="text-xs text-gray-500">Pay cash on delivery</span>
                  </div>
                </Label>
              </div>
            </RadioGroup>

            {/* Pay Summary Alert Box */}
            <div className={`p-4 rounded-xl border text-xs leading-relaxed ${
              paymentMethod === "cod" ? "bg-amber-50/60 border-amber-200 text-amber-800" : "bg-purple-50/30 border-purple-100 text-purple-800"
            }`}>
              {paymentMethod === "cod" ? (
                <p>
                  <span className="font-bold">Cash on Delivery selected:</span> You will pay exactly <span className="font-bold text-gray-950">₹{totalAmount.toFixed(2)}</span> in cash to the delivery agent. No online payment is needed right now.
                </p>
              ) : (
                <p>
                  <span className="font-bold">Secure Online Payment:</span> You will be redirected to pay <span className="font-bold text-gray-950">₹{totalAmount.toFixed(2)}</span> securely via Razorpay (UPI, Card, Netbanking).
                </p>
              )}
            </div>
          </div>

          {/* Order Summary */}
          <div className="bg-gray-50/60 p-6 rounded-xl border border-gray-200">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Order Summary ({items.length} items)</h3>
            <div className="space-y-2 text-sm mb-4 max-h-40 overflow-y-auto pr-2">
              <div className="flex font-semibold text-gray-500 border-b pb-1 text-xs uppercase tracking-wider">
                <span className="w-1/2">Product</span>
                <span className="w-1/4 text-center">Qty</span>
                <span className="w-1/4 text-right">Total</span>
              </div>
              {items.map((item, index) => (
                <div key={index} className="flex justify-between text-gray-700 py-1">
                  <span className="w-1/2 truncate pr-2 text-gray-900 font-medium">
                    {item.productName} 
                  </span>
                  <span className="w-1/4 text-center text-gray-600">x{item.quantity}</span>
                  <span className="w-1/4 text-right font-semibold text-gray-900">
                    ₹{(item.price_at_add * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
            
            <Separator className="my-3" />

            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-medium text-gray-900">₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Shipping Fee</span>
                <span className="font-medium text-gray-900">{shippingFee === 0 ? "Free" : `₹${shippingFee.toFixed(2)}`}</span>
              </div>
              <div className="flex justify-between font-bold text-lg text-gray-950 pt-2.5 border-t border-gray-200">
                <span>Total Payable</span>
                <span className="text-xl font-black text-purple-700">₹{totalAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <Button type="submit" className="w-full h-12 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold shadow-md transition-all flex items-center justify-center gap-2" disabled={loading}>
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
            {loading ? "Placing Order..." : paymentMethod === "cod" ? "Confirm Order (Cash on Delivery)" : "Pay and Confirm Order"}
          </Button>
        </form>
      </DialogContent>

      {showRazorpay && (
        <RazorpayPayment
          amount={totalAmount}
          order_id={orderId}
          name={userName || "Customer"}
          description={`Order from organicza`}
          image="/placeholder.svg"
          prefill={{
            name: userName || undefined,
            email: userEmail || undefined,
            contact: primaryPhone || undefined,
          }}
          onSuccess={handlePaymentSuccess}
          onFailure={handlePaymentFailure}
        />
      )}
    </Dialog>
  )
}