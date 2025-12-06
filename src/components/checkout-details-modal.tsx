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
  onOrderSuccess: () => void
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
    const tempOrderId = `order_${Date.now()}_${Math.floor(Math.random() * 1000)}`
    setOrderId(tempOrderId)
    setShowRazorpay(true)
    setLoading(false)
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
      } else {
        currentShippingAddress = userAddresses.find((addr) => addr.id === selectedAddressId)
        // Ensure Lat/Lng is passed if it was just detected even for an existing address
        if (currentShippingAddress && lat && lng) {
            currentShippingAddress.lat = lat
            currentShippingAddress.lng = lng
        }
      }

      if (!currentShippingAddress) throw new Error("No address found.")

      // Update Profile
      await supabase.from("user_profiles").update({
          name: userName,
          phone: primaryPhone,
          addresses: updatedAddressesForProfile,
        }).eq("id", currentUserId)

      // Prepare Order Items
      const orderItemsData = items.map((item) => ({
        id: uuidv4(),
        product_id: item.productId,
        quantity: item.quantity,
        price_at_purchase: item.price_at_add,
        created_at: new Date().toISOString(),
      }))

      // Prepare Order Data (Using flat structure + shipping_address object)
      const orderData = {
        user_id: currentUserId,
        total_amount: totalAmount,
        payment_id: response.razorpay_payment_id || null,
        order_id: response.razorpay_order_id || orderId,
        status: "confirmed",
        purchase_time: new Date().toISOString(),
        customer_name: userName,
        
        // Save the full shipping object (useful for delivery APIs)
        shipping_address: {
            name: userName,
            phone: primaryPhone,
            addressLine1: currentShippingAddress.addressLine1 || currentShippingAddress.houseNumber,
            addressLine2: currentShippingAddress.addressLine2 || currentShippingAddress.street,
            addressLine3: currentShippingAddress.addressLine3 || currentShippingAddress.area,
            city: currentShippingAddress.city,
            state: currentShippingAddress.state,
            pincode: currentShippingAddress.pincode,
            country: currentShippingAddress.country,
            lat: currentShippingAddress.lat,
            lng: currentShippingAddress.lng
        },
        order_items: orderItemsData, 
      }

      const { error: orderError } = await supabase.from("orders").insert([orderData])

      if (orderError) throw orderError

      toast({ title: "Order Successful!", description: "Your order has been placed.", variant: "default" })
      setShowRazorpay(false)
      onClose()
      onOrderSuccess()
    } catch (err: any) {
      console.error("Error creating order:", err)
      toast({ title: "Order Error", description: "Payment successful, but order creation failed.", variant: "destructive" })
      setShowRazorpay(false)
    }
  }

  const handlePaymentFailure = (err: any) => {
    toast({ title: "Payment Failed", description: err.description || "Unknown error", variant: "destructive" })
    setShowRazorpay(false)
  }

  const handleAddressSelectionChange = (value: string) => {
    setSelectedAddressId(value)
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
    <Dialog open={isOpen} onOpenChange={onClose}>
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
            <h3 className="text-lg font-semibold text-gray-900">Delivery Address</h3>
            {userAddresses.length > 0 && (
              <RadioGroup onValueChange={handleAddressSelectionChange} value={selectedAddressId || ""}>
                <div className="grid grid-cols-1 gap-3">
                  {userAddresses.map((address) => (
                    <Label
                      key={address.id}
                      htmlFor={`address-${address.id}`}
                      className="flex items-center space-x-2 p-3 border rounded-md cursor-pointer hover:bg-gray-50 relative"
                    >
                      <RadioGroupItem value={address.id} id={`address-${address.id}`} />
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {address.name} {address.isDefault && "(Default)"}
                        </span>
                        <span className="text-sm text-gray-600 truncate max-w-[400px]">
                           {/* Handle display for both old and new format */}
                          {address.addressLine1 || address.houseNumber}, {address.addressLine2 || address.street} {address.addressLine3 || address.area}
                        </span>
                        <span className="text-xs text-gray-500">
                          {address.city}, {address.state} - {address.pincode}
                        </span>
                        {/* Show if location data exists */}
                        {(address.lat || (selectedAddressId === address.id && lat)) && (
                           <span className="text-xs text-emerald-600 flex items-center mt-1">
                             <Navigation className="w-3 h-3 mr-1"/> GPS Location Attached
                           </span>
                        )}
                      </div>
                    </Label>
                  ))}
                  <Label
                    htmlFor="address-new"
                    className="flex items-center space-x-2 p-3 border rounded-md cursor-pointer hover:bg-gray-50"
                  >
                    <RadioGroupItem value="new" id="address-new" />
                    <span className="font-medium">Add New Address</span>
                  </Label>
                </div>
              </RadioGroup>
            )}
          </div>

          {/* New/Edit Address Form */}
          {(showNewAddressForm || userAddresses.length === 0) && (
            <div className="space-y-4 border-t pt-4 mt-4">
              <div className="flex justify-between items-center">
                <h4 className="text-md font-semibold text-gray-800">New Address Details</h4>
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
              </div>
            </div>
          )}

          {/* Order Summary */}
          <div className="bg-gray-50 p-6 rounded-lg border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Summary ({items.length} items)</h3>
            <div className="space-y-2 text-sm mb-4 max-h-40 overflow-y-auto pr-2">
              <div className="flex font-semibold text-gray-600 border-b pb-1">
                <span className="w-1/2">Product</span>
                <span className="w-1/4 text-center">Qty</span>
                <span className="w-1/4 text-right">Total</span>
              </div>
              {items.map((item, index) => (
                <div key={index} className="flex justify-between text-gray-700">
                  <span className="w-1/2 truncate pr-2">
                    {item.productName} 
                  </span>
                  <span className="w-1/4 text-center">x{item.quantity}</span>
                  <span className="w-1/4 text-right font-medium">
                    ₹{(item.price_at_add * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
            
            <Separator className="my-3" />

            <div className="space-y-2 text-gray-700">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Shipping Fee</span>
                <span>{shippingFee === 0 ? "Free" : `₹${shippingFee.toFixed(2)}`}</span>
              </div>
              <div className="flex justify-between font-bold text-xl text-gray-900 pt-2 border-t border-gray-200">
                <span>Total Payable</span>
                <span>₹{totalAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <Button type="submit" className="w-full h-11 bg-green-600 hover:bg-green-700" disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {loading ? "Processing..." : `Proceed to Payment (₹${totalAmount.toFixed(2)})`}
          </Button>
        </form>
      </DialogContent>

      {showRazorpay && (
        <RazorpayPayment
          amount={totalAmount}
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