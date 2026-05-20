"use client"

import type React from "react"
import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, User, ShoppingBag, Heart, Package, MapPin, Plus, Edit2, Trash2, Phone, Mail, BadgeCheck } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { v4 as uuidv4 } from "uuid"
import { Checkbox } from "@/components/ui/checkbox"

// =========================================================================
//                             TYPE DEFINITIONS
// =========================================================================

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
}

interface UserProfile {
  id: string
  email: string
  name: string | null
  phone: string | null
  addresses: Address[] | null
}

// =========================================================================
//                             MAIN COMPONENT
// =========================================================================

export default function ProfilePage() {
  const router = useRouter()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [orderCount, setOrderCount] = useState(0)
  const [cartCount, setCartCount] = useState(0)
  const [favCount, setFavCount] = useState(0)
  
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [isAddingAddress, setIsAddingAddress] = useState(false)
  const [editingAddress, setEditingAddress] = useState<Address | null>(null)

  const [editName, setEditName] = useState("")
  const [editEmail, setEditEmail] = useState("")
  const [editPhone, setEditPhone] = useState("")

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

  const fetchProfileData = useCallback(async () => {
    setLoading(true)
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()

    if (sessionError || !session) {
      toast({ title: "Please log in.", variant: "destructive" })
      router.push("/login")
      return
    }

    const userId = session.user.id
    const { data: profileData, error: profileError } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", userId)
      .single()

    if (profileError && profileError.code !== "PGRST116") {
      toast({ title: "Failed to load data.", variant: "destructive" })
      setLoading(false)
      return
    }

    setProfile(profileData || null)
    setEditName(profileData?.name || "")
    setEditEmail(profileData?.email || "")
    setEditPhone(profileData?.phone || "")

    const [ordersRes, cartRes, favRes] = await Promise.all([
      supabase.from("orders").select("id", { count: "exact" }).eq("user_id", userId),
      supabase.from("cart_items").select("id", { count: "exact" }).eq("user_id", userId),
      supabase.from("favorites").select("id", { count: "exact" }).eq("user_id", userId)
    ])

    setOrderCount(ordersRes.count || 0)
    setCartCount(cartRes.count || 0)
    setFavCount(favRes.count || 0)
    setLoading(false)
  }, [router, toast])

  useEffect(() => {
    fetchProfileData()
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.push("/login"); else fetchProfileData();
    })
    return () => authListener.subscription.unsubscribe()
  }, [fetchProfileData, router])

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return
    setLoading(true)
    try {
      const { error } = await supabase.from("user_profiles").update({ name: editName, phone: editPhone }).eq("id", profile.id)
      if (error) throw error
      toast({ title: "Profile updated." })
      setIsEditingProfile(false)
      fetchProfileData()
    } catch (error: any) {
      toast({ title: error.message || "Update failed.", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleAddOrUpdateAddress = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return
    setLoading(true)
    try {
      let updatedAddresses = profile.addresses ? [...profile.addresses] : []
      const newAddress: Address = {
        id: editingAddress?.id || uuidv4(), name: addressName, houseNumber, street,
        area, city, state, pincode, country, primaryPhone: addressPrimaryPhone,
        secondaryPhone: addressSecondaryPhone || undefined, isDefault: isDefaultAddress,
      }

      if (isDefaultAddress) updatedAddresses = updatedAddresses.map((addr) => ({ ...addr, isDefault: false }))
      if (editingAddress) updatedAddresses = updatedAddresses.map((addr) => (addr.id === newAddress.id ? newAddress : addr))
      else updatedAddresses.push(newAddress)

      const { error } = await supabase.from("user_profiles").update({ addresses: updatedAddresses }).eq("id", profile.id)
      if (error) throw error
      toast({ title: "Address saved." })
      setIsAddingAddress(false)
      setEditingAddress(null)
      resetAddressForm()
      fetchProfileData()
    } catch (error: any) {
      toast({ title: error.message || "Failed to save.", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteAddress = async (addressId: string) => {
    if (!profile || !profile.addresses) return
    setLoading(true)
    try {
      const updatedAddresses = profile.addresses.filter((addr) => addr.id !== addressId)
      const { error } = await supabase.from("user_profiles").update({ addresses: updatedAddresses }).eq("id", profile.id)
      if (error) throw error
      toast({ title: "Address removed." })
      fetchProfileData()
    } catch (error: any) {
      toast({ title: error.message || "Delete failed.", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const resetAddressForm = () => {
    setAddressName(""); setHouseNumber(""); setStreet(""); setArea(""); setCity("");
    setState(""); setPincode(""); setCountry("India"); setAddressPrimaryPhone("");
    setAddressSecondaryPhone(""); setIsDefaultAddress(false)
  }

  const openEditAddressForm = (address: Address) => {
    setEditingAddress(address); setAddressName(address.name); setHouseNumber(address.houseNumber);
    setStreet(address.street); setArea(address.area); setCity(address.city); setState(address.state);
    setPincode(address.pincode); setCountry(address.country); setAddressPrimaryPhone(address.primaryPhone);
    setAddressSecondaryPhone(address.secondaryPhone || ""); setIsDefaultAddress(address.isDefault);
    setIsAddingAddress(true);
  }

  if (loading && !profile) {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <Header showSearchBar={false} />
        <main className="flex-grow flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-slate-900" /></main>
      </div>
    )
  }

  if (!profile) return null;

  return (
    <div className="min-h-screen flex flex-col bg-[#fafafa] font-sans text-slate-900">
      <Header showSearchBar={false} />
      
      <main className="flex-grow container mx-auto px-3 sm:px-4 py-6 max-w-6xl">
        <div className="mb-4">
          <h1 className="text-xl font-bold tracking-tight">Account Overview</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          
          {/* LEFT COLUMN: Profile & Stats */}
          <div className="md:col-span-4 flex flex-col gap-4">
            
            <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded bg-slate-900 text-white flex items-center justify-center flex-shrink-0">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold flex items-center gap-1">
                    {profile.name || "Customer"} <BadgeCheck className="w-3.5 h-3.5 text-blue-500" />
                  </h2>
                  <p className="text-[10px] text-slate-500 font-medium">Member</p>
                </div>
              </div>

              {isEditingProfile ? (
                <form onSubmit={handleUpdateProfile} className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-semibold text-slate-500 uppercase">Name</Label>
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8 rounded bg-slate-50 border-slate-200 text-xs px-2" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-semibold text-slate-500 uppercase">Email</Label>
                    <Input value={editEmail} disabled className="h-8 rounded bg-slate-50 border-slate-200 text-xs px-2 text-slate-400" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-semibold text-slate-500 uppercase">Phone</Label>
                    <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="h-8 rounded bg-slate-50 border-slate-200 text-xs px-2" />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button type="submit" disabled={loading} className="flex-1 bg-slate-900 text-white h-8 rounded text-xs font-medium">
                      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                    </Button>
                    <Button variant="outline" onClick={() => setIsEditingProfile(false)} className="flex-1 h-8 rounded border-slate-200 text-xs">
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <Mail className="h-3.5 w-3.5 text-slate-400" /> <span className="truncate">{profile.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <Phone className="h-3.5 w-3.5 text-slate-400" /> <span>{profile.phone || "No phone added"}</span>
                  </div>
                  <Button variant="outline" onClick={() => setIsEditingProfile(true)} className="w-full h-8 mt-2 text-xs rounded border-slate-200 shadow-sm flex items-center justify-center gap-1.5">
                    <Edit2 className="h-3 w-3" /> Edit Profile
                  </Button>
                </div>
              )}
            </div>

            {/* Compact Stats */}
            <div className="flex gap-2">
              {[
                { label: 'Orders', val: orderCount, icon: ShoppingBag },
                { label: 'Cart', val: cartCount, icon: Package },
                { label: 'Saved', val: favCount, icon: Heart }
              ].map((stat, i) => (
                <div key={i} className="flex-1 bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex flex-col items-center justify-center gap-1">
                  <stat.icon className="h-4 w-4 text-slate-400 mb-1" />
                  <p className="text-sm font-bold leading-none">{stat.val}</p>
                  <p className="text-[9px] font-semibold text-slate-400 uppercase">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT COLUMN: Address Book */}
          <div className="md:col-span-8">
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm min-h-[400px]">
              
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 rounded-t-lg">
                <h2 className="text-sm font-bold flex items-center gap-2"><MapPin className="h-4 w-4 text-slate-400"/> Address Book</h2>
                {!isAddingAddress && !editingAddress && (
                  <Button onClick={() => { setIsAddingAddress(true); setEditingAddress(null); resetAddressForm(); }} className="h-7 px-3 text-[11px] rounded bg-slate-900 text-white flex items-center gap-1">
                    <Plus className="h-3 w-3" /> New
                  </Button>
                )}
              </div>

              <div className="p-4">
                {isAddingAddress || editingAddress ? (
                  <form onSubmit={handleAddOrUpdateAddress} className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div className="col-span-2 sm:col-span-1 space-y-1">
                        <Label className="text-[10px] font-semibold text-slate-500 uppercase">Label (Home, Work)</Label>
                        <Input value={addressName} onChange={(e) => setAddressName(e.target.value)} required className="h-8 rounded bg-slate-50 border-slate-200 text-xs px-2" />
                      </div>
                      <div className="col-span-2 sm:col-span-1 space-y-1">
                        <Label className="text-[10px] font-semibold text-slate-500 uppercase">Mobile Number</Label>
                        <Input value={addressPrimaryPhone} onChange={(e) => setAddressPrimaryPhone(e.target.value)} required className="h-8 rounded bg-slate-50 border-slate-200 text-xs px-2" />
                      </div>
                      <div className="col-span-2 sm:col-span-1 space-y-1">
                        <Label className="text-[10px] font-semibold text-slate-500 uppercase">Pincode</Label>
                        <Input value={pincode} onChange={(e) => setPincode(e.target.value)} required className="h-8 rounded bg-slate-50 border-slate-200 text-xs px-2" />
                      </div>
                      
                      <div className="col-span-2 sm:col-span-3 space-y-1">
                        <Label className="text-[10px] font-semibold text-slate-500 uppercase">Flat, House no., Building, Apartment</Label>
                        <Input value={houseNumber} onChange={(e) => setHouseNumber(e.target.value)} required className="h-8 rounded bg-slate-50 border-slate-200 text-xs px-2" />
                      </div>
                      
                      <div className="col-span-2 sm:col-span-1 space-y-1">
                        <Label className="text-[10px] font-semibold text-slate-500 uppercase">Area, Street</Label>
                        <Input value={street} onChange={(e) => setStreet(e.target.value)} required className="h-8 rounded bg-slate-50 border-slate-200 text-xs px-2" />
                      </div>
                      <div className="col-span-2 sm:col-span-1 space-y-1">
                        <Label className="text-[10px] font-semibold text-slate-500 uppercase">Landmark</Label>
                        <Input value={area} onChange={(e) => setArea(e.target.value)} required className="h-8 rounded bg-slate-50 border-slate-200 text-xs px-2" />
                      </div>
                      <div className="col-span-2 sm:col-span-1 space-y-1">
                        <Label className="text-[10px] font-semibold text-slate-500 uppercase">City & State</Label>
                        <div className="flex gap-2">
                          <Input value={city} onChange={(e) => setCity(e.target.value)} required placeholder="City" className="h-8 rounded bg-slate-50 border-slate-200 text-xs px-2 w-1/2" />
                          <Input value={state} onChange={(e) => setState(e.target.value)} required placeholder="State" className="h-8 rounded bg-slate-50 border-slate-200 text-xs px-2 w-1/2" />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 py-2 border-t border-slate-100">
                      <Checkbox id="isDefaultAddress" checked={isDefaultAddress} onCheckedChange={(checked: boolean) => setIsDefaultAddress(checked)} className="h-3.5 w-3.5 rounded-[3px] border-slate-300" />
                      <Label htmlFor="isDefaultAddress" className="text-[11px] font-medium text-slate-600">Set as default shipping address</Label>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <Button type="submit" disabled={loading} className="h-8 px-4 text-xs rounded bg-slate-900 text-white font-medium">
                        {loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null} Save
                      </Button>
                      <Button type="button" variant="outline" onClick={() => { setIsAddingAddress(false); setEditingAddress(null); resetAddressForm(); }} className="h-8 px-4 text-xs rounded border-slate-200">
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {profile.addresses && profile.addresses.length > 0 ? (
                      profile.addresses.map((addr) => (
                        <div key={addr.id} className={`relative p-3 rounded-md border flex flex-col ${addr.isDefault ? 'border-slate-400 bg-slate-50/50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                          
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="text-xs font-bold text-slate-900 capitalize flex items-center gap-1.5">
                              {addr.name} {addr.isDefault && <span className="bg-slate-900 text-white text-[8px] px-1.5 py-0.5 rounded uppercase">Default</span>}
                            </h4>
                            <div className="flex gap-1">
                              <button onClick={() => openEditAddressForm(addr)} className="p-1 text-slate-400 hover:text-slate-900 rounded bg-slate-50"><Edit2 className="h-3 w-3" /></button>
                              <button onClick={() => handleDeleteAddress(addr.id)} className="p-1 text-slate-400 hover:text-red-600 rounded bg-slate-50"><Trash2 className="h-3 w-3" /></button>
                            </div>
                          </div>
                          
                          <div className="text-[11px] text-slate-600 leading-tight space-y-0.5 flex-grow mb-3">
                            <p className="truncate">{addr.houseNumber}, {addr.street}</p>
                            <p className="truncate">{addr.area}, {addr.city}</p>
                            <p>{addr.state} - {addr.pincode}</p>
                          </div>
                          
                          <div className="text-[10px] font-semibold text-slate-500 flex items-center gap-1 mt-auto pt-2 border-t border-slate-100">
                            <Phone className="h-2.5 w-2.5" /> {addr.primaryPhone}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-full py-12 flex flex-col items-center justify-center text-center border border-dashed border-slate-200 rounded-lg bg-slate-50/50">
                        <MapPin className="h-6 w-6 text-slate-300 mb-2" />
                        <p className="text-xs font-medium text-slate-600 mb-4">No addresses saved yet.</p>
                        <Button onClick={() => setIsAddingAddress(true)} className="h-8 px-4 text-xs rounded bg-slate-900 text-white">
                          Add Address
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
          
        </div>
      </main>
      <Footer />
    </div>
  )
}