"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation" // Import useRouter
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, AlertCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { v4 as uuidv4 } from "uuid"

// ... (Keep your Address interface here)
interface Address {
  id: string
  name: string
  houseNumber: string
  street: string
  area: string
  city: string
  state: string
  pincode: string
  country: string
  primaryPhone: string
  secondaryPhone?: string
  isDefault: boolean
  lat?: number
  lng?: number
}

interface AuthPopupProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  mode?: "auth" | "profile_completion"
  initialEmail?: string
}

export default function AuthPopup({
  isOpen,
  onClose,
  onSuccess,
  mode = "auth",
  initialEmail = "",
}: AuthPopupProps) {
  const [currentMode, setCurrentMode] = useState(mode)
  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false) // Separate loading for Google
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()
  const router = useRouter() // Add router

  // ... (Keep all your profile completion form states here)
  const [profileName, setProfileName] = useState("")
  const [profilePhone, setProfilePhone] = useState("")
  const [addressName, setAddressName] = useState("")
  const [houseNumber, setHouseNumber] = useState("")
  const [street, setStreet] = useState("")
  const [area, setArea] = useState("")
  const [city, setCity] = useState("")
  const [state, setState] = useState("")
  const [pincode, setPincode] = useState("")
  const [country, setCountry] = useState("India")
  const [addressPrimaryPhone, setAddressPrimaryPhone] = useState("")
  const [addressSecondaryPhone, setAddressSecondaryPhone] = useState("")
  const [isDefaultAddress, setIsDefaultAddress] = useState(false)

  useEffect(() => {
    setCurrentMode(mode)
    if (mode === "profile_completion" && initialEmail) {
      setEmail(initialEmail)
    }
  }, [mode, initialEmail])

  // ... (Keep your checkAndTransitionToProfileCompletion function)
  const checkAndTransitionToProfileCompletion = async (userId: string) => {
    const { data: profileData, error: profileError } = await supabase
      .from("user_profiles")
      .select("name, phone, email")
      .eq("id", userId)
      .single()

    if (profileError && profileError.code !== "PGRST116") {
      console.error("Error fetching profile for completion check:", profileError)
      setError("Failed to check profile status.")
      return false
    }

    if (!profileData) {
      const { error: insertError } = await supabase
        .from("user_profiles")
        .insert({ id: userId, email: email || initialEmail })
      if (insertError) {
        console.error("Error creating initial profile:", insertError)
        setError("Failed to create initial profile.")
        return false
      }
      setCurrentMode("profile_completion")
      return true
    }

    if (!profileData.name || !profileData.phone) {
      setProfileName(profileData.name || "")
      setProfilePhone(profileData.phone || "")
      setCurrentMode("profile_completion")
      return true
    }
    return false
  }

  // ... (Keep your handleLogin function)
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const { data, error: signInError } =
        await supabase.auth.signInWithPassword({ email, password })
      if (signInError) throw signInError

      const needsCompletion = await checkAndTransitionToProfileCompletion(
        data.user!.id,
      )
      if (!needsCompletion) {
        toast({
          title: "Logged in successfully!",
          description: "Welcome back.",
          variant: "default",
        })
        onSuccess()
      }
    } catch (err: any) {
      setError(err.message || "Login failed. Please check your credentials.")
      toast({
        title: "Login Failed",
        description: err.message || "Please check your credentials.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // ... (Keep your handleRegister function)
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      })
      if (signUpError) throw signUpError

      const needsCompletion = await checkAndTransitionToProfileCompletion(
        data.user!.id,
      )
      if (!needsCompletion) {
        toast({
          title: "Registration successful!",
          description: "Please check your email to confirm your account.",
          variant: "default",
        })
        onSuccess()
      } else {
        toast({
          title: "Registration successful!",
          description: "Please complete your profile details.",
          variant: "default",
        })
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

  // --- NEW ---
  // Added Google Login handler from your LoginForm
  const handleGoogleLogin = async () => {
    setGoogleLoading(true)
    setError(null)
    try {
      // Note: For OAuth, the profile check must happen on the callback route
      // or when the user returns to the app.
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) throw error
    } catch (err: any) {
      setError(err.message || "Google login failed.")
      toast({
        title: "Google Login Failed",
        description: err.message || "Please try again.",
        variant: "destructive",
      })
    } finally {
      setGoogleLoading(false)
    }
  }

  // ... (Keep your handleCompleteProfile function)
  const handleCompleteProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError || !session) {
      setError("No active session found. Please log in again.")
      setLoading(false)
      return
    }

    const userId = session.user.id
    let updatedAddresses: Address[] = []

    try {
      const { data: currentProfile, error: fetchProfileError } = await supabase
        .from("user_profiles")
        .select("addresses")
        .eq("id", userId)
        .single()

      if (fetchProfileError && fetchProfileError.code !== "PGRST116") {
        throw fetchProfileError
      }

      updatedAddresses = currentProfile?.addresses || []

      if (
        addressName &&
        houseNumber &&
        street &&
        area &&
        city &&
        state &&
        pincode &&
        country &&
        addressPrimaryPhone
      ) {
        const newAddress: Address = {
          id: uuidv4(),
          name: addressName,
          houseNumber,
          street,
          area,
          city,
          state,
          pincode,
          country,
          primaryPhone: addressPrimaryPhone,
          secondaryPhone: addressSecondaryPhone || undefined,
          isDefault: isDefaultAddress,
        }

        if (isDefaultAddress) {
          updatedAddresses = updatedAddresses.map((addr) => ({
            ...addr,
            isDefault: false,
          }))
        }
        updatedAddresses.push(newAddress)
      }

      const { error: updateError } = await supabase
        .from("user_profiles")
        .update({
          name: profileName,
          phone: profilePhone,
          addresses: updatedAddresses,
        })
        .eq("id", userId)

      if (updateError) throw updateError

      toast({
        title: "Profile Completed!",
        description: "Your profile details have been saved.",
        variant: "default",
      })
      onSuccess()
    } catch (err: any) {
      setError(err.message || "Failed to complete profile. Please try again.")
      toast({
        title: "Profile Completion Failed",
        description: err.message || "Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // ... (Keep your resetAddressForm function)
  const resetAddressForm = () => {
    // ...
  }

  // --- UPDATED JSX ---
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] p-6">
        <DialogHeader className="text-center">
          <DialogTitle className="text-2xl font-bold">
            {currentMode === "auth"
              ? "Welcome to organicza"
              : "Complete Your Profile"}
          </DialogTitle>
          <DialogDescription className="text-gray-600">
            {currentMode === "auth"
              ? "Login or create an account to continue."
              : "Please provide your basic details to continue."}
          </DialogDescription>
        </DialogHeader>

        {currentMode === "auth" ? (
          <Tabs
            defaultValue="login"
            onValueChange={() => setError(null)} // Clear error on tab change
            className="w-full mt-4"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>
            <TabsContent value="login" className="mt-4">
              <form onSubmit={handleLogin} className="space-y-4">
                {error && (
                  <div className="flex items-center gap-2 text-red-600 text-sm">
                    <AlertCircle className="h-4 w-4" />
                    {error}
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="m@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <Input
                    id="login-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading || googleLoading}
                >
                  {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  {loading ? "Logging in..." : "Login"}
                </Button>
              </form>

              {/* --- NEW: Google Login Button for Login Tab --- */}
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-gray-500 dark:bg-gray-950">
                    Or continue with
                  </span>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full h-11 flex items-center justify-center gap-2"
                onClick={handleGoogleLogin}
                disabled={loading || googleLoading}
              >
                {googleLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 48 48"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <g clipPath="url(#clip0_17_40)">
                      <path
                        d="M47.5 24.5C47.5 22.6 47.3 20.8 47 19H24V29.1H37.4C36.7 32.2 34.7 34.7 31.8 36.4V42.1H39.5C44 38.1 47.5 32.1 47.5 24.5Z"
                        fill="#4285F4"
                      />
                      <path
                        d="M24 48C30.6 48 36.1 45.9 39.5 42.1L31.8 36.4C29.9 37.6 27.3 38.4 24 38.4C17.7 38.4 12.2 34.3 10.3 28.7H2.3V34.6C5.7 41.1 14.1 48 24 48Z"
                        fill="#34A853"
                      />
                      <path
                        d="M10.3 28.7C9.7 26.9 9.4 24.9 9.4 23C9.4 21.1 9.7 19.1 10.3 17.3V11.4H2.3C0.8 14.3 0 17.6 0 21C0 24.4 0.8 27.7 2.3 30.6L10.3 28.7Z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M24 9.6C27.7 9.6 30.7 10.9 32.8 12.8L39.7 6C36.1 2.7 30.6 0 24 0C14.1 0 5.7 6.9 2.3 13.4L10.3 17.3C12.2 11.7 17.7 9.6 24 9.6Z"
                        fill="#EA4335"
                      />
                    </g>
                    <defs>
                      <clipPath id="clip0_17_40">
                        <rect width="48" height="48" fill="white" />
                      </clipPath>
                    </defs>
                  </svg>
                )}
                {googleLoading ? "Redirecting..." : "Sign in with Google"}
              </Button>
            </TabsContent>
            <TabsContent value="register" className="mt-4">
              <form onSubmit={handleRegister} className="space-y-4">
                {error && (
                  <div className="flex items-center gap-2 text-red-600 text-sm">
                    <AlertCircle className="h-4 w-4" />
                    {error}
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="register-email">Email</Label>
                  <Input
                    id="register-email"
                    type="email"
                    placeholder="m@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-password">Password</Label>
                  <Input
                    id="register-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading || googleLoading}
                >
                  {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  {loading ? "Registering..." : "Register"}
                </Button>
              </form>

              {/* --- NEW: Google Login Button for Register Tab --- */}
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-gray-500 dark:bg-gray-950">
                    Or continue with
                  </span>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full h-11 flex items-center justify-center gap-2"
                onClick={handleGoogleLogin}
                disabled={loading || googleLoading}
              >
                {googleLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 48 48"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    {/* (Google SVG paths) */}
                    <g clipPath="url(#clip0_17_40_2)">
                      <path
                        d="M47.5 24.5C47.5 22.6 47.3 20.8 47 19H24V29.1H37.4C36.7 32.2 34.7 34.7 31.8 36.4V42.1H39.5C44 38.1 47.5 32.1 47.5 24.5Z"
                        fill="#4285F4"
                      />
                      <path
                        d="M24 48C30.6 48 36.1 45.9 39.5 42.1L31.8 36.4C29.9 37.6 27.3 38.4 24 38.4C17.7 38.4 12.2 34.3 10.3 28.7H2.3V34.6C5.7 41.1 14.1 48 24 48Z"
                        fill="#34A853"
                      />
                      <path
                        d="M10.3 28.7C9.7 26.9 9.4 24.9 9.4 23C9.4 21.1 9.7 19.1 10.3 17.3V11.4H2.3C0.8 14.3 0 17.6 0 21C0 24.4 0.8 27.7 2.3 30.6L10.3 28.7Z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M24 9.6C27.7 9.6 30.7 10.9 32.8 12.8L39.7 6C36.1 2.7 30.6 0 24 0C14.1 0 5.7 6.9 2.3 13.4L10.3 17.3C12.2 11.7 17.7 9.6 24 9.6Z"
                        fill="#EA4335"
                      />
                    </g>
                    <defs>
                      <clipPath id="clip0_17_40_2">
                        <rect width="48" height="48" fill="white" />
                      </clipPath>
                    </defs>
                  </svg>
                )}
                {googleLoading ? "Redirecting..." : "Sign up with Google"}
              </Button>
            </TabsContent>
          </Tabs>
        ) : (
          // --- This is your Profile Completion Form ---
          // --- It remains unchanged and will work for email/pass flow ---
          <form
            onSubmit={handleCompleteProfile}
            className="space-y-4 mt-4 max-h-[70vh] overflow-y-auto pr-2"
          >
            {error && (
              <div className="flex items-center gap-2 text-red-600 text-sm">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="profileName">Full Name *</Label>
              <Input
                id="profileName"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profilePhone">Phone Number *</Label>
              <Input
                id="profilePhone"
                value={profilePhone}
                onChange={(e) => setProfilePhone(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profileEmail">Email</Label>
              <Input
                id="profileEmail"
                value={email}
                disabled
                className="bg-gray-100"
              />
            </div>

            <h3 className="text-lg font-semibold mt-6 mb-2">
              Optional: Add an Address
            </h3>
            <div className="grid grid-cols-1 gap-4">
              {/* (All your address form inputs) */}
              <div>
                <Label htmlFor="addressName">Address Name (e.g., Home, Office)</Label>
                <Input id="addressName" value={addressName} onChange={(e) => setAddressName(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="houseNumber">House/Flat Number</Label>
                <Input id="houseNumber" value={houseNumber} onChange={(e) => setHouseNumber(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="street">Street/Road Name</Label>
                <Input id="street" value={street} onChange={(e) => setStreet(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="area">Area/Locality</Label>
                <Input id="area" value={area} onChange={(e) => setArea(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="city">City</Label>
                <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="state">State</Label>
                <Input id="state" value={state} onChange={(e) => setState(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="pincode">Pincode</Label>
                <Input id="pincode" value={pincode} onChange={(e) => setPincode(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="country">Country</Label>
                <Input id="country" value={country} onChange={(e) => setCountry(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="addressPrimaryPhone">Primary Phone Number (for address)</Label>
                <Input
                  id="addressPrimaryPhone"
                  value={addressPrimaryPhone}
                  onChange={(e) => setAddressPrimaryPhone(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="addressSecondaryPhone">Secondary Phone Number (Optional)</Label>
                <Input
                  id="addressSecondaryPhone"
                  value={addressSecondaryPhone}
                  onChange={(e) => setAddressSecondaryPhone(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center space-x-2 mt-4">
              <input
                type="checkbox"
                id="isDefaultAddress"
                checked={isDefaultAddress}
                onChange={(e) => setIsDefaultAddress(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <Label htmlFor="isDefaultAddress">Set as default address</Label>
            </div>

            <Button type="submit" className="w-full mt-6" disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {loading ? "Saving Profile..." : "Save Profile"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}