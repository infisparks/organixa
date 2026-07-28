"use client"

import type React from "react"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { ShoppingCart, Heart, Search, Leaf, Menu, X } from "lucide-react"
import { supabase } from "@/lib/supabase" // Supabase import
import { Input } from "@/components/ui/input" // Import Input component

interface HeaderProps {
  showSearchBar?: boolean
  onSearch?: (term: string) => void
}

export default function Header({ showSearchBar = true, onSearch }: HeaderProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false)
  const [cartCount, setCartCount] = useState(0)
  const [favCount, setFavCount] = useState(0)
  const [user, setUser] = useState<any>(null)
  const [isApprovedCompany, setIsApprovedCompany] = useState(false) // 🎯 Check for approved company instead of is_admin
  const [localSearchTerm, setLocalSearchTerm] = useState("")
  const router = useRouter()

  useEffect(() => {
    let cartChannel: any = null;
    let favChannel: any = null;

    const getSessionAndCounts = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const currentUserId = session?.user?.id || null
      setUser(session?.user || null)

      if (currentUserId) {
        // Fetch company approval status
        const { data: company } = await supabase
          .from("companies")
          .select("is_approved")
          .eq("user_id", currentUserId)
          .maybeSingle()
        setIsApprovedCompany(!!company?.is_approved)

        // Fetch cart count
        const { count: cartItemsCount } = await supabase
          .from("cart_items")
          .select("id", { count: "exact" })
          .eq("user_id", currentUserId)
        setCartCount(cartItemsCount || 0)


        // Fetch favorites count
        const { count: favItemsCount } = await supabase
          .from("favorites")
          .select("id", { count: "exact" })
          .eq("user_id", currentUserId)
        setFavCount(favItemsCount || 0)

        // --- Real-time subscriptions ---
        cartChannel = supabase
          .channel(`realtime_cart_items_${currentUserId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'cart_items',
              filter: `user_id=eq.${currentUserId}`,
            },
            (payload) => {
              // Re-fetch cart count on any change
              getSessionAndCounts()
            }
          )
          .subscribe()

        favChannel = supabase
          .channel(`realtime_favorites_${currentUserId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'favorites',
              filter: `user_id=eq.${currentUserId}`,
            },
            (payload) => {
              // Re-fetch fav count on any change
              getSessionAndCounts()
            }
          )
          .subscribe()
      } else {
        setCartCount(0)
        setFavCount(0)
      }
    }

    getSessionAndCounts()

    // Listen to auth state changes for real-time user updates
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null)
      getSessionAndCounts()
    })

    return () => {
      authListener.subscription.unsubscribe()
      if (cartChannel) supabase.removeChannel(cartChannel)
      if (favChannel) supabase.removeChannel(favChannel)
    }
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/login")
  }

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalSearchTerm(e.target.value)
    if (onSearch) {
      onSearch(e.target.value)
    }
  }

  return (
    <nav className="bg-white border-b sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 sm:py-2.5">
        {/* Mobile Expanded Search View */}
        {isMobileSearchOpen && showSearchBar ? (
          <div className="flex sm:hidden items-center gap-2 w-full py-1">
            <button
              onClick={() => setIsMobileSearchOpen(false)}
              className="p-2 hover:bg-gray-100 rounded-full text-gray-600 flex-shrink-0"
              aria-label="Close search"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="relative flex-grow">
              <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none" />
              <Input
                type="text"
                placeholder="Search products..."
                value={localSearchTerm}
                onChange={handleSearchInputChange}
                autoFocus
                className="pl-10 pr-8 py-2 border border-gray-200 rounded-full text-sm focus:outline-none w-full focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
              {localSearchTerm && (
                <button
                  onClick={() => handleSearchInputChange({ target: { value: '' } } as any)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                  aria-label="Clear search text"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Normal Header View (Desktop & Default Mobile) */
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            {/* Mobile Menu Button & Logo Group */}
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <button
                className="md:hidden p-2 hover:bg-gray-100 rounded-lg flex-shrink-0"
                onClick={() => setIsMobileMenuOpen(true)}
                aria-label="Open mobile menu"
              >
                <Menu className="w-6 h-6 text-gray-600" />
              </button>
              {/* Logo (Main Header) */}
              <Link href="/" className="flex items-center gap-2 group flex-shrink-0">
                <Image
                  src="/logo.png"
                  alt="organicza logo"
                  width={240}
                  height={80}
                  className="h-10 sm:h-14 lg:h-16 w-auto object-contain transition-transform duration-300 group-hover:scale-105"
                  priority
                />
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-6 lg:space-x-8">
              <Link href="/" className="text-gray-700 hover:text-green-600 font-medium transition-colors">
                Home
              </Link>
              <Link href="/shop" className="text-gray-700 hover:text-green-600 font-medium transition-colors">
                Shop
              </Link>
              <Link href="/orders" className="text-gray-700 hover:text-green-600 font-medium transition-colors">
                Orders
              </Link>
              {isApprovedCompany && (
                <Link href="/company/dashboard" className="text-gray-900 hover:text-green-600 font-bold transition-colors flex items-center gap-1">
                  <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs uppercase tracking-wider">Merchant Dashboard</span>
                </Link>
              )}
              {user ? (
                <>
                  <Link href="/profile" className="text-gray-700 hover:text-green-600 font-medium transition-colors">
                    Profile
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="text-gray-700 hover:text-green-600 font-medium transition-colors"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <Link href="/login" className="text-gray-700 hover:text-green-600 font-medium transition-colors">
                  Login
                </Link>
              )}
            </div>

            {/* Right Section (Search Icon & Actions) */}
            <div className="flex items-center gap-2 sm:gap-6 flex-shrink-0">
              {showSearchBar && (
                <>
                  {/* Desktop Search Input (sm and up) */}
                  <div className="hidden sm:block relative">
                    <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none" />
                    <Input
                      type="text"
                      placeholder="Search products..."
                      value={localSearchTerm}
                      onChange={handleSearchInputChange}
                      className="pl-10 pr-4 py-2 border border-gray-200 rounded-full text-sm focus:outline-none w-[140px] sm:w-[180px] lg:w-[220px] focus:ring-green-500 focus:border-green-500 transition-all duration-300"
                    />
                  </div>
                  {/* Mobile Search Icon Button (Click to open full search bar) */}
                  <button
                    onClick={() => setIsMobileSearchOpen(true)}
                    className="sm:hidden p-2 hover:bg-gray-100 rounded-full text-gray-600 flex-shrink-0 transition-colors"
                    aria-label="Open search bar"
                  >
                    <Search className="w-6 h-6" />
                  </button>
                </>
              )}

              {/* Favorites Icon */}
              <Link href="/addfav" className="relative flex-shrink-0 p-1" aria-label="View favorites">
                <Heart className="w-6 h-6 text-gray-600 cursor-pointer hover:text-green-600 transition-colors hover:scale-110 transform duration-300" />
                {favCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-pink-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center animate-bounce">
                    {favCount}
                  </span>
                )}
              </Link>
              {/* Shopping Cart Icon */}
              <Link href="/cart" className="relative flex-shrink-0 p-1" aria-label="View shopping cart">
                <ShoppingCart className="w-6 h-6 text-gray-600 cursor-pointer hover:text-green-600 transition-colors hover:scale-110 transform duration-300" />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-green-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center animate-bounce">
                    {cartCount}
                  </span>
                )}
              </Link>
            </div>
          </div>
        )}
      </div>
      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 md:hidden">
          <div className="fixed inset-y-0 left-0 w-[80%] max-w-sm bg-white shadow-xl">
            <div className="p-4 border-b flex justify-between items-center">
              <Link href="/" onClick={() => setIsMobileMenuOpen(false)}>
                <Image
                  src="/logo.png"
                  alt="organicza logo"
                  width={160}
                  height={50}
                  className="h-10 w-auto object-contain"
                />
              </Link>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
                aria-label="Close mobile menu"
              >
                <X className="w-6 h-6 text-gray-600" />
              </button>
            </div>
            <div className="py-4">
              <nav className="flex flex-col">
                <Link
                  href="/"
                  className="block px-4 py-3 text-gray-700 hover:bg-gray-50"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Home
                </Link>
                <Link
                  href="/shop"
                  className="block px-4 py-3 text-gray-700 hover:bg-gray-50"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Shop
                </Link>
                <Link
                  href="/orders"
                  className="block px-4 py-3 text-gray-700 hover:bg-gray-50"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Orders
                </Link>
                {isApprovedCompany && (
                  <Link
                    href="/company/dashboard"
                    className="block px-4 py-3 text-green-700 font-bold hover:bg-green-50"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Merchant Dashboard
                  </Link>
                )}
                {user ? (
                  <>
                    <Link
                      href="/profile"
                      className="block px-4 py-3 text-gray-700 hover:bg-gray-50"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Profile
                    </Link>
                    <button
                      onClick={() => {
                        handleLogout()
                        setIsMobileMenuOpen(false)
                      }}
                      className="w-full text-left px-4 py-3 text-gray-700 hover:bg-gray-50"
                    >
                      Logout
                    </button>
                  </>
                ) : (
                  <Link
                    href="/login"
                    className="block px-4 py-3 text-gray-700 hover:bg-gray-50"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Login
                  </Link>
                )}
              </nav>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}