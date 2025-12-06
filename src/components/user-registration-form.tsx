"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Loader2, AlertCircle, User, Phone, MapPin, Globe, Navigation } from "lucide-react"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"
import { Checkbox } from "@/components/ui/checkbox"
import { v4 as uuidv4 } from "uuid"

// Updated Interface to match Shipping API structure
interface Address {
  id: string
  name: string
  addressLine1: string // API: add (Mandatory)
  addressLine2?: string // API: add2
  addressLine3?: string // API: add3
  city: string
  state: string
  pincode: string // API: pin (Mandatory)
  country: string
  primaryPhone: string
  secondaryPhone?: string
  isDefault: boolean
  lat?: number // Captured via Geolocation
  lng?: number // Captured via Geolocation
}

export default function UserRegistrationForm() {
  const router = useRouter()
  const { toast } = useToast()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [locationLoading, setLocationLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // User Identity
  const [userName, setUserName] = useState("")
  const [primaryPhone, setPrimaryPhone] = useState("")
  const [secondaryPhone, setSecondaryPhone] = useState("")

  // Address Details (Aligned with Shipping API)
  const [addressLine1, setAddressLine1] = useState("") // Mandatory
  const [addressLine2, setAddressLine2] = useState("")
  const [addressLine3, setAddressLine3] = useState("")
  const [city, setCity] = useState("")
  const [state, setState] = useState("")
  const [pincode, setPincode] = useState("")
  const [country, setCountry] = useState("India")
  
  // Geolocation
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  
  const [isDefaultAddress, setIsDefaultAddress] = useState(true)

  // Function to fetch current browser location
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      toast({
        title: "Error",
        description: "Geolocation is not supported by your browser",
        variant: "destructive",
      })
      return
    }

    setLocationLoading(true)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude
        const longitude = position.coords.longitude
        setLat(latitude)
        setLng(longitude)
        
        toast({
          title: "Location Fetched",
          description: `Coordinates captured: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
          variant: "default",
        })
        setLocationLoading(false)
        
        // Optional: You could use a Reverse Geocoding API here (like Google Maps or OpenStreetMap)
        // to automatically fill the city/state/pincode based on lat/lng.
        // For now, we just save the exact coordinates for the delivery driver.
      },
      (error) => {
        setLocationLoading(false)
        toast({
          title: "Location Error",
          description: "Unable to retrieve your location. Please allow location access.",
          variant: "destructive",
        })
      }
    )
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // 1. Create Auth User
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
      if (signUpError) throw signUpError

      if (data.user) {
        const userId = data.user.id
        const userEmail = data.user.email

        const addressesToSave: Address[] = []
        
        // Ensure mandatory shipping fields are present
        if (addressLine1 && pincode && country && primaryPhone) {
          const newAddress: Address = {
            id: uuidv4(),
            name: userName, // Using User Name as Recipient Name
            addressLine1,
            addressLine2: addressLine2 || undefined,
            addressLine3: addressLine3 || undefined,
            city,
            state,
            pincode,
            country,
            primaryPhone,
            secondaryPhone: secondaryPhone || undefined,
            isDefault: isDefaultAddress,
            lat: lat || undefined,
            lng: lng || undefined
          }
          addressesToSave.push(newAddress)
        }

        // 2. Insert into user_profiles
        const { error: profileError } = await supabase.from("user_profiles").upsert(
          {
            id: userId,
            email: userEmail,
            name: userName,
            phone: primaryPhone,
            addresses: addressesToSave, // Saves JSON structure including lat/lng
          },
          { onConflict: "id" },
        )

        if (profileError) {
          console.error("Error saving user profile:", profileError)
          throw new Error("Failed to save profile details.")
        }

        toast({
          title: "Registration successful!",
          description: "Please check your email to confirm your account. Redirecting...",
          variant: "default",
        })
        router.push("/login")
      }
    } catch (err: any) {
      setError(err.message || "Registration failed. Please try again.")
      toast({
        title: "Registration Failed",
        description: err.message || "Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
      <Card className="w-full max-w-lg shadow-xl my-8">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-gray-900">Create Account</CardTitle>
          <CardDescription className="text-gray-600">Enter details for seamless delivery</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-6">
            {error && (
              <div className="flex items-center gap-2 text-red-600 text-sm p-3 bg-red-50 rounded-md border border-red-200">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            {/* Account Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="userName">Full Name (Customer Name) *</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  id="userName"
                  type="text"
                  placeholder="John Doe"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  required
                  className="pl-10"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="primaryPhone">Mobile Number *</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <Input
                    id="primaryPhone"
                    type="tel"
                    placeholder="9876543210"
                    value={primaryPhone}
                    onChange={(e) => setPrimaryPhone(e.target.value)}
                    required
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="secondaryPhone">Alt Phone (Optional)</Label>
                <Input
                  id="secondaryPhone"
                  type="tel"
                  placeholder="Optional"
                  value={secondaryPhone}
                  onChange={(e) => setSecondaryPhone(e.target.value)}
                />
              </div>
            </div>

            <div className="border-t pt-4 mt-4">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-md font-semibold text-gray-800">Delivery Address</h4>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={handleGetLocation}
                  disabled={locationLoading}
                  className="text-blue-600 border-blue-200 hover:bg-blue-50"
                >
                  {locationLoading ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Navigation className="h-4 w-4 mr-1" />
                  )}
                  {lat ? "Location Captured" : "Detect Location"}
                </Button>
              </div>

              {lat && lng && (
                 <div className="mb-4 text-xs text-green-600 flex items-center bg-green-50 p-2 rounded">
                    <Navigation className="w-3 h-3 mr-1"/> 
                    Coordinates saved for precise delivery ({lat.toFixed(5)}, {lng.toFixed(5)})
                 </div>
              )}

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="addressLine1">Address Line 1 (Flat/House/Building) *</Label>
                  <Input
                    id="addressLine1"
                    placeholder="e.g. Flat 101, Galaxy Apartments"
                    value={addressLine1}
                    onChange={(e) => setAddressLine1(e.target.value)}
                    required
                  />
                  <p className="text-[10px] text-gray-500">API Mapping: 'add' (Mandatory)</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="addressLine2">Address Line 2 (Street/Colony) (Optional)</Label>
                  <Input
                    id="addressLine2"
                    placeholder="e.g. MG Road, Andheri West"
                    value={addressLine2}
                    onChange={(e) => setAddressLine2(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="addressLine3">Address Line 3 (Landmark) (Optional)</Label>
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
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      placeholder="Mumbai"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      placeholder="Maharashtra"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        id="country"
                        placeholder="India"
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="isDefaultAddress"
                checked={isDefaultAddress}
                onCheckedChange={(checked: boolean) => setIsDefaultAddress(checked)}
              />
              <Label htmlFor="isDefaultAddress">Set as Default Address</Label>
            </div>

            <Button type="submit" className="w-full h-11" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {loading ? "Registering..." : "Register"}
            </Button>
          </form>
          
          <p className="mt-6 text-center text-sm text-gray-600">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-blue-600 hover:underline">
              Login
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}