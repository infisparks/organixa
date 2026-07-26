"use client"

import type React from "react"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import {
    LayoutDashboard,
    Package,
    ShoppingBag,
    PlusCircle,
    Settings,
    LogOut,
    Building,
    PanelLeftOpen,
    PanelLeftClose,
    Loader2,
    Menu, 
    ListChecks,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet" // 💡 SheetTrigger added back for the mobile button
import { useToast } from "@/hooks/use-toast"

interface CompanyInfo {
    company_name: string
    company_logo_url: string | null
}

export default function CompanyDashboardLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter()
    const pathname = usePathname()
    const { toast } = useToast()

    const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null)
    const [loadingCompanyInfo, setLoadingCompanyInfo] = useState(true)
    const [isAdmin, setIsAdmin] = useState(false)
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
    const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false) // State for mobile sheet

    useEffect(() => {
        // Load sidebar state from local storage
        const savedState = localStorage.getItem("isSidebarCollapsed")
        if (savedState !== null) {
            setIsSidebarCollapsed(JSON.parse(savedState))
        }

        const fetchCompanyDetails = async () => {
            setLoadingCompanyInfo(true)
            const {
                data: { session },
                error: sessionError,
            } = await supabase.auth.getSession()

            if (sessionError || !session) {
                toast({
                    title: "Authentication Required",
                    description: "Please log in to access the company dashboard.",
                    variant: "destructive",
                })
                router.push("/login")
                return
            }

            const userId = session.user.id

            // Check if user is admin
            const { data: profile } = await supabase
                .from("user_profiles")
                .select("is_admin")
                .eq("id", userId)
                .single()

            const isUserAdmin = !!profile?.is_admin
            setIsAdmin(isUserAdmin)

            const { data, error } = await supabase
                .from("companies")
                .select("company_name, company_logo_url, is_approved")
                .eq("user_id", userId)
                .single()

            if (isUserAdmin) {
                if (data) {
                    setCompanyInfo(data)
                } else {
                    setCompanyInfo({ company_name: "Admin Panel", company_logo_url: null })
                }
                setLoadingCompanyInfo(false)
                return
            }

            if (error || !data) {
                console.error("Error fetching company info:", error)
                toast({
                    title: "Company Profile Required",
                    description: "You must register your company before accessing the dashboard.",
                    variant: "destructive",
                })
                router.push("/company/registration") // Assuming this is the registration page
                return
            }

            if (!data.is_approved) {
                router.push("/company/pending")
                return
            }

            setCompanyInfo(data)
            setLoadingCompanyInfo(false)
        }

        fetchCompanyDetails()

        // Listen for auth state changes
        const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!session) {
                router.push("/login")
            } else {
                fetchCompanyDetails() // Re-fetch if session changes
            }
        })

        return () => {
            authListener.subscription.unsubscribe()
        }
    }, [router, toast])

    const handleLogout = async () => {
        const { error } = await supabase.auth.signOut()
        if (error) {
            toast({
                title: "Logout Error",
                description: error.message,
                variant: "destructive",
            })
        } else {
            toast({
                title: "Logged Out",
                description: "You have been successfully logged out.",
            })
            router.push("/login")
        }
    }

    const toggleSidebar = () => {
        setIsSidebarCollapsed((prev) => {
            const newState = !prev
            localStorage.setItem("isSidebarCollapsed", JSON.stringify(newState))
            return newState
        })
    }

    const navItems = [
        {
            name: "Dashboard",
            href: "/company/dashboard",
            icon: LayoutDashboard,
        },
        {
            name: "My Products",
            href: "/company/dashboard/my-products",
            icon: Package,
        },
        {
            name: "Add Product",
            href: "/company/dashboard/add-product",
            icon: PlusCircle,
        },
        {
            name: "My Orders",
            href: "/company/dashboard/my-orders",
            icon: ShoppingBag,
        },
        ...(isAdmin
            ? [
                  {
                      name: "Approvals",
                      href: "/company/dashboard/approvals",
                      icon: ListChecks,
                  },
              ]
            : []),
    ]

    if (loadingCompanyInfo) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#F5F6F8] font-sans">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                <span className="ml-3 text-sm font-medium text-slate-700">Loading dashboard...</span>
            </div>
        )
    }

    return (
        <div className="flex min-h-screen bg-[#F5F6F8] font-sans selection:bg-indigo-100">
            {/* Desktop Sidebar (fixed position, hidden on mobile) */}
            <aside
                className={`hidden lg:flex fixed inset-y-0 left-0 z-20 flex-col border-r border-slate-200 bg-white shadow-sm py-6 transition-all duration-300 ease-in-out ${
                    isSidebarCollapsed ? "w-20 items-center" : "w-64"
                }`}
            >
                <div
                    className={`flex items-center px-4 mb-8 ${isSidebarCollapsed ? "justify-center" : "justify-between"} w-full`}
                >
                    {!isSidebarCollapsed && (
                        <Link href="/company/dashboard" className="flex items-center gap-3">
                            {companyInfo?.company_logo_url ? (
                                <img
                                    src={companyInfo.company_logo_url || "/placeholder.svg"}
                                    alt={`${companyInfo.company_name} Logo`}
                                    className="h-9 w-9 rounded-xl object-cover border border-slate-200 shadow-sm"
                                />
                            ) : (
                                <div className="h-9 w-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                                    <Building className="h-5 w-5" />
                                </div>
                            )}
                            <div className="flex flex-col min-w-0">
                                <span className="text-sm font-semibold text-slate-900 truncate max-w-[130px]">
                                    {companyInfo?.company_name || "Company"}
                                </span>
                                <span className="text-[10px] font-medium text-indigo-600 uppercase tracking-wider">
                                    {isAdmin ? "Admin Console" : "Partner Portal"}
                                </span>
                            </div>
                        </Link>
                    )}
                    {/* DESKTOP TOGGLE BUTTON */}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={toggleSidebar}
                        className="h-8 w-8 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
                        aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                    >
                        {isSidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                    </Button>
                </div>

                <nav className="flex-1 px-3 space-y-1.5">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all duration-200 ${
                                    isActive
                                        ? "bg-indigo-50 text-indigo-700 shadow-xs border-l-4 border-indigo-600"
                                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                } ${isSidebarCollapsed ? "justify-center px-0" : ""}`}
                                aria-current={isActive ? "page" : undefined}
                            >
                                <item.icon className={`h-4 w-4 transition-colors ${isActive ? "text-indigo-600" : "text-slate-400"}`} />
                                {!isSidebarCollapsed && <span>{item.name}</span>}
                                {isSidebarCollapsed && <span className="sr-only">{item.name}</span>}
                            </Link>
                        )
                    })}
                </nav>

                <div className={`px-3 mt-auto ${isSidebarCollapsed ? "flex justify-center" : ""}`}>
                    <Button
                        variant="ghost"
                        className={`w-full justify-start text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700 rounded-xl py-2.5 ${
                            isSidebarCollapsed ? "justify-center px-0" : ""
                        }`}
                        onClick={handleLogout}
                    >
                        <LogOut className={`h-4 w-4 ${isSidebarCollapsed ? "" : "mr-2.5"}`} />
                        {!isSidebarCollapsed && <span>Logout</span>}
                        {isSidebarCollapsed && <span className="sr-only">Logout</span>}
                    </Button>
                </div>
            </aside>

            {/* Mobile Sheet (Sidebar) - Opened by the header button */}
            <Sheet open={isMobileSheetOpen} onOpenChange={setIsMobileSheetOpen}>
                <SheetContent side="left" className="p-0 w-64 border-r border-slate-200">
                    <SheetHeader className="sr-only">
                        <SheetTitle>Navigation Menu</SheetTitle>
                        <SheetDescription>Access dashboard, products, and account settings.</SheetDescription>
                    </SheetHeader>
                    <div className="flex flex-col h-full bg-white py-6">
                        <div className="flex items-center px-4 mb-8">
                            <Link href="/company/dashboard" className="flex items-center gap-3">
                                {companyInfo?.company_logo_url ? (
                                    <img
                                        src={companyInfo.company_logo_url || "/placeholder.svg"}
                                        alt={`${companyInfo.company_name} Logo`}
                                        className="h-9 w-9 rounded-xl object-cover border border-slate-200 shadow-sm"
                                    />
                                ) : (
                                    <div className="h-9 w-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                                        <Building className="h-5 w-5" />
                                    </div>
                                )}
                                <div className="flex flex-col min-w-0">
                                    <span className="text-sm font-semibold text-slate-900 truncate">
                                        {companyInfo?.company_name || "Company"}
                                    </span>
                                    <span className="text-[10px] font-medium text-indigo-600 uppercase tracking-wider">
                                        {isAdmin ? "Admin Console" : "Partner Portal"}
                                    </span>
                                </div>
                            </Link>
                        </div>
                        <nav className="flex-1 px-3 space-y-1.5">
                            {navItems.map((item) => {
                                const isActive = pathname === item.href
                                return (
                                    <Link
                                        key={item.name}
                                        href={item.href}
                                        className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all duration-200 ${
                                            isActive
                                                ? "bg-indigo-50 text-indigo-700 border-l-4 border-indigo-600"
                                                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                        }`}
                                        aria-current={isActive ? "page" : undefined}
                                        onClick={() => setIsMobileSheetOpen(false)}
                                    >
                                        <item.icon className={`h-4 w-4 ${isActive ? "text-indigo-600" : "text-slate-400"}`} />
                                        <span>{item.name}</span>
                                    </Link>
                                )
                            })}
                        </nav>
                        <div className="px-3 mt-auto">
                            <Button
                                variant="ghost"
                                className="w-full justify-start text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700 rounded-xl"
                                onClick={handleLogout}
                            >
                                <LogOut className="h-4 w-4 mr-2.5" />
                                <span>Logout</span>
                            </Button>
                        </div>
                    </div>
                </SheetContent>
            </Sheet>

            {/* Main content wrapper, which accounts for sidebar width */}
            <div
                className={`flex flex-col flex-1 transition-all duration-300 ease-in-out ${isSidebarCollapsed ? "lg:ml-20" : "lg:ml-64"}`}
            >
                {/* MOBILE HEADER */}
                <header className="sticky top-0 z-10 lg:hidden flex items-center justify-between h-14 px-4 border-b border-slate-200 bg-white/90 backdrop-blur-md shadow-xs">
                    <div className="flex items-center gap-2.5">
                        {companyInfo?.company_logo_url ? (
                            <img
                                src={companyInfo.company_logo_url || "/placeholder.svg"}
                                alt={`${companyInfo.company_name} Logo`}
                                className="h-7 w-7 rounded-lg object-cover border border-slate-200"
                            />
                        ) : (
                            <div className="h-7 w-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                                <Building className="h-4 w-4" />
                            </div>
                        )}
                        <span className="text-xs font-semibold text-slate-900">{companyInfo?.company_name || "Dashboard"}</span>
                    </div>
                    {/* MOBILE TOGGLE BUTTON */}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsMobileSheetOpen(true)}
                        aria-label="Open sidebar menu"
                        className="h-8 w-8 text-slate-600"
                    >
                        <Menu className="h-5 w-5" />
                    </Button>
                </header>

                {/* Main content area */}
                <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
            </div>
        </div>
    )
}