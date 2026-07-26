"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, CheckCircle, XCircle, Building, Package, RefreshCw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import Image from "next/image"

interface Company {
  id: string
  company_name: string
  email: string
  is_approved: boolean
  company_logo_url: string | null
}

interface Product {
  id: string
  product_name: string
  is_approved: boolean
  product_photo_urls: string[]
  company_name?: string
  company_id: string
}

export default function ApprovalsPage() {
  const { toast } = useToast()
  const router = useRouter()
  const [companies, setCompanies] = useState<Company[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch all companies
      const { data: companyData, error: companyError } = await supabase
        .from("companies")
        .select("id, company_name, email, is_approved, company_logo_url")
        .order("created_at", { ascending: false })

      if (companyError) throw companyError
      setCompanies(companyData || [])

      // Fetch all products with company names
      const { data: productData, error: productError } = await supabase
        .from("products")
        .select("id, product_name, is_approved, product_photo_urls, company_id, companies(company_name)")
        .order("created_at", { ascending: false })

      if (productError) throw productError

      const formattedProducts = (productData || []).map((p: any) => ({
        ...p,
        company_name: p.companies?.company_name
      }))

      setProducts(formattedProducts)
    } catch (error: any) {
      console.error("Error fetching approvals data:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to fetch data. Check your permissions.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const checkAdminStatus = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push("/login")
        return
      }

      const { data: profile, error } = await supabase
        .from("user_profiles")
        .select("is_admin")
        .eq("id", session.user.id)
        .single()

      if (error || !profile?.is_admin) {
        toast({
          title: "Access Denied",
          description: "You do not have permission to access the approvals dashboard.",
          variant: "destructive"
        })
        router.push("/company/dashboard")
        return
      }

      setIsAdmin(true)
      fetchData()
    }

    checkAdminStatus()
  }, [])

  const handleToggleApproval = async (type: "company" | "product", id: string, currentStatus: boolean) => {
    setActionLoading(id)
    try {
      const table = type === "company" ? "companies" : "products"
      const { error } = await supabase
        .from(table)
        .update({ is_approved: !currentStatus })
        .eq("id", id)

      if (error) throw error

      toast({
        title: "Status Updated",
        description: `${type.charAt(0).toUpperCase() + type.slice(1)} status has been toggled.`,
      })

      // Update local state
      if (type === "company") {
        setCompanies(prev => prev.map(c => c.id === id ? { ...c, is_approved: !currentStatus } : c))
      } else {
        setProducts(prev => prev.map(p => p.id === id ? { ...p, is_approved: !currentStatus } : p))
      }
    } catch (error: any) {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setActionLoading(null)
    }
  }

  if (loading || isAdmin === null) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] px-4 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        <p className="mt-3 text-slate-600 font-medium text-xs">Checking authorization...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 md:space-y-8 max-w-6xl mx-auto px-4 py-6 font-sans">
      {/* Header section - responsive layout */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-slate-900">Admin Approvals</h1>
          <p className="text-xs text-slate-500 mt-1">Manage vendor registrations and product catalog approvals.</p>
        </div>
        <Button variant="outline" onClick={fetchData} size="sm" className="w-full sm:w-auto text-xs font-semibold text-slate-700 border-slate-200 hover:bg-slate-50 rounded-xl h-9">
          <RefreshCw className="w-3.5 h-3.5 mr-2 text-slate-500" /> Refresh Data
        </Button>
      </div>

      <Tabs defaultValue="companies" className="w-full">
        {/* Scrollable tabs list for mobile */}
        <TabsList className="grid w-full grid-cols-2 mb-6 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
          <TabsTrigger value="companies" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white rounded-xl flex items-center justify-center gap-2 text-xs md:text-sm py-2 font-semibold transition-all">
            <Building className="w-4 h-4" />
            <span>Companies</span> ({companies.length})
          </TabsTrigger>
          <TabsTrigger value="products" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white rounded-xl flex items-center justify-center gap-2 text-xs md:text-sm py-2 font-semibold transition-all">
            <Package className="w-4 h-4" />
            <span>Products</span> ({products.length})
          </TabsTrigger>
        </TabsList>

        {/* --- COMPANIES TAB --- */}
        <TabsContent value="companies">
          <Card className="border-slate-200 shadow-xs rounded-2xl overflow-hidden bg-white">
            <CardHeader className="bg-slate-50/70 border-b border-slate-100 py-4 px-6">
              <CardTitle className="text-base font-semibold text-slate-900">Company Registration Requests</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {/* Desktop View Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full divide-y divide-slate-100">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-3.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Logo</th>
                      <th className="px-6 py-3.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Company Name</th>
                      <th className="px-6 py-3.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Email</th>
                      <th className="px-6 py-3.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3.5 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100">
                    {companies.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-slate-400 text-xs italic">No company requests found</td>
                      </tr>
                    ) : (
                      companies.map((company) => (
                        <tr key={company.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            {company.company_logo_url ? (
                              <img src={company.company_logo_url} className="w-9 h-9 rounded-xl object-cover border border-slate-200 shadow-xs" alt="" />
                            ) : (
                              <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center"><Building className="w-4 h-4 text-slate-400" /></div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap font-semibold text-xs text-slate-900">{company.company_name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-600 font-medium">{company.email}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider ${company.is_approved ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                              {company.is_approved ? 'Approved' : 'Pending'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <Button
                              size="sm"
                              variant={company.is_approved ? "destructive" : "default"}
                              className={`h-8 px-3 text-xs font-semibold rounded-xl ${!company.is_approved ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs" : "bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 shadow-none"}`}
                              disabled={actionLoading === company.id}
                              onClick={() => handleToggleApproval("company", company.id, company.is_approved)}
                            >
                              {actionLoading === company.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
                                (company.is_approved ? <><XCircle className="w-3.5 h-3.5 mr-1.5" /> Revoke</> : <><CheckCircle className="w-3.5 h-3.5 mr-1.5" /> Approve</>)}
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile View Cards */}
              <div className="md:hidden divide-y divide-slate-100">
                {companies.length === 0 ? (
                  <div className="px-6 py-10 text-center text-slate-400 text-xs italic">No company requests found</div>
                ) : (
                  companies.map((company) => (
                    <div key={company.id} className="p-4 space-y-3">
                      <div className="flex items-center gap-3">
                        {company.company_logo_url ? (
                          <img src={company.company_logo_url} className="w-10 h-10 rounded-xl object-cover border border-slate-200" alt="" />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center"><Building className="w-5 h-5 text-slate-400" /></div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-xs text-slate-900 truncate">{company.company_name}</p>
                          <p className="text-[11px] text-slate-500 truncate">{company.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${company.is_approved ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                          {company.is_approved ? 'Approved' : 'Pending'}
                        </span>
                        <Button
                          size="sm"
                          variant={company.is_approved ? "destructive" : "default"}
                          className={`h-8 px-3 text-xs font-semibold rounded-xl ${!company.is_approved ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs" : "bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 shadow-none"}`}
                          disabled={actionLoading === company.id}
                          onClick={() => handleToggleApproval("company", company.id, company.is_approved)}
                        >
                          {actionLoading === company.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
                            (company.is_approved ? <><XCircle className="w-3.5 h-3.5 mr-1.5" /> Revoke</> : <><CheckCircle className="w-3.5 h-3.5 mr-1.5" /> Approve</>)}
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- PRODUCTS TAB --- */}
        <TabsContent value="products">
          <Card className="border-slate-200 shadow-xs rounded-2xl overflow-hidden bg-white">
            <CardHeader className="bg-slate-50/70 border-b border-slate-100 py-4 px-6">
              <CardTitle className="text-base font-semibold text-slate-900">Product Catalog Approvals</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {/* Desktop View Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full divide-y divide-slate-100">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-3.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Image</th>
                      <th className="px-6 py-3.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Product</th>
                      <th className="px-6 py-3.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Company</th>
                      <th className="px-6 py-3.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3.5 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100">
                    {products.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-slate-400 text-xs italic">No products found</td>
                      </tr>
                    ) : (
                      products.map((product) => (
                        <tr key={product.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="w-10 h-10 relative rounded-xl border border-slate-200 overflow-hidden bg-slate-50">
                              {product.product_photo_urls?.[0] ? (
                                <Image
                                  src={supabase.storage.from("product-media").getPublicUrl(product.product_photo_urls[0]).data.publicUrl}
                                  fill
                                  className="object-cover"
                                  alt=""
                                  unoptimized
                                />
                              ) : (
                                <div className="w-full h-full bg-slate-50 flex items-center justify-center"><Package className="w-4 h-4 text-slate-300" /></div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap font-semibold text-xs text-slate-900">{product.product_name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-slate-600 text-xs font-semibold">{product.company_name || "Unknown"}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider ${product.is_approved ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                              {product.is_approved ? 'Approved' : 'Pending'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <Button
                              size="sm"
                              variant={product.is_approved ? "destructive" : "default"}
                              className={`h-8 px-3 text-xs font-semibold rounded-xl ${!product.is_approved ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs" : "bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 shadow-none"}`}
                              disabled={actionLoading === product.id}
                              onClick={() => handleToggleApproval("product", product.id, product.is_approved)}
                            >
                              {actionLoading === product.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
                                (product.is_approved ? <><XCircle className="w-3.5 h-3.5 mr-1.5" /> Revoke</> : <><CheckCircle className="w-3.5 h-3.5 mr-1.5" /> Approve</>)}
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile View Cards */}
              <div className="md:hidden divide-y divide-slate-100">
                {products.length === 0 ? (
                  <div className="px-6 py-10 text-center text-slate-400 text-xs italic">No products found</div>
                ) : (
                  products.map((product) => (
                    <div key={product.id} className="p-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 relative rounded-xl border border-slate-200 overflow-hidden flex-shrink-0 bg-slate-50">
                          {product.product_photo_urls?.[0] ? (
                            <Image
                              src={supabase.storage.from("product-media").getPublicUrl(product.product_photo_urls[0]).data.publicUrl}
                              fill
                              className="object-cover"
                              alt=""
                              unoptimized
                            />
                          ) : (
                            <div className="w-full h-full bg-slate-50 flex items-center justify-center"><Package className="w-5 h-5 text-slate-300" /></div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-xs text-slate-900 truncate">{product.product_name}</p>
                          <p className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wider">{product.company_name || "Unknown"}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${product.is_approved ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                          {product.is_approved ? 'Approved' : 'Pending'}
                        </span>
                        <Button
                          size="sm"
                          variant={product.is_approved ? "destructive" : "default"}
                          className={`h-8 px-3 text-xs font-semibold rounded-xl ${!product.is_approved ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs" : "bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 shadow-none"}`}
                          disabled={actionLoading === product.id}
                          onClick={() => handleToggleApproval("product", product.id, product.is_approved)}
                        >
                          {actionLoading === product.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
                            (product.is_approved ? <><XCircle className="w-3.5 h-3.5 mr-1.5" /> Revoke</> : <><CheckCircle className="w-3.5 h-3.5 mr-1.5" /> Approve</>)}
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}