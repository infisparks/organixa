"use client"

import { useState, useEffect } from "react"
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
  const [companies, setCompanies] = useState<Company[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
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
    fetchData()
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] px-4 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-green-600" />
        <p className="mt-4 text-gray-600 font-medium">Loading approval requests...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 md:space-y-8 max-w-6xl mx-auto px-4 py-6">
      {/* Header section - responsive layout */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center  flex-items-center justify-between gap-4">
        <h1 className="text-2xl md:text-3xl m-auto sm:m-0  font-bold text-gray-900">Admin Approvals</h1>
        <Button variant="outline" onClick={fetchData} size="sm" className="w-full sm:w-auto">
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh Data
        </Button>
      </div>

      <Tabs defaultValue="companies" className="w-full">
        {/* Scrollable tabs list for mobile */}
        <TabsList className="grid w-full grid-cols-2 mb-6 bg-green-50 p-1">
          <TabsTrigger value="companies" className="data-[state=active]:bg-green-600 data-[state=active]:text-white flex items-center justify-center gap-2 text-sm md:text-base py-2">
            <Building className="w-4 h-4" />
            <span>Companies</span> ({companies.length})
          </TabsTrigger>
          <TabsTrigger value="products" className="data-[state=active]:bg-green-600 data-[state=active]:text-white flex items-center justify-center gap-2 text-sm md:text-base py-2">
            <Package className="w-4 h-4" />
            <span>Products</span> ({products.length})
          </TabsTrigger>
        </TabsList>

        {/* --- COMPANIES TAB --- */}
        <TabsContent value="companies">
          <Card className="border-green-100 shadow-lg overflow-hidden">
            <CardHeader className="bg-green-50/50 py-4">
              <CardTitle className="text-lg md:text-xl text-center lg:text-start">Company Registration Requests</CardTitle>
            </CardHeader>
            <CardContent className="p-0 sm:p-6">
              {/* Desktop View Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Logo</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {companies.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-10 text-center text-gray-500 italic">No companies found</td>
                      </tr>
                    ) : (
                      companies.map((company) => (
                        <tr key={company.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            {company.company_logo_url ? (
                              <img src={company.company_logo_url} className="w-10 h-10 rounded-full object-cover border" alt="" />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center"><Building className="w-5 h-5 text-gray-400" /></div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{company.company_name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-gray-600">{company.email}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${company.is_approved ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                              {company.is_approved ? 'Approved' : 'Pending'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <Button
                              size="sm"
                              variant={company.is_approved ? "destructive" : "default"}
                              className={!company.is_approved ? "bg-green-600 hover:bg-green-700" : ""}
                              disabled={actionLoading === company.id}
                              onClick={() => handleToggleApproval("company", company.id, company.is_approved)}
                            >
                              {actionLoading === company.id ? <Loader2 className="w-4 h-4 animate-spin" /> :
                                (company.is_approved ? <><XCircle className="w-4 h-4 mr-2" /> Revoke</> : <><CheckCircle className="w-4 h-4 mr-2" /> Approve</>)}
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile View Cards */}
              <div className="md:hidden divide-y divide-gray-200">
                {companies.length === 0 ? (
                  <div className="px-6 py-10 text-center text-gray-500 italic">No companies found</div>
                ) : (
                  companies.map((company) => (
                    <div key={company.id} className="p-4 space-y-4">
                      <div className="flex items-center gap-4">
                        {company.company_logo_url ? (
                          <img src={company.company_logo_url} className="w-12 h-12 rounded-full object-cover border" alt="" />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center"><Building className="w-6 h-6 text-gray-400" /></div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-900 truncate">{company.company_name}</p>
                          <p className="text-sm text-gray-500 truncate">{company.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${company.is_approved ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {company.is_approved ? 'Approved' : 'Pending'}
                        </span>
                        <Button
                          size="sm"
                          variant={company.is_approved ? "destructive" : "default"}
                          className={!company.is_approved ? "bg-green-600 hover:bg-green-700" : ""}
                          disabled={actionLoading === company.id}
                          onClick={() => handleToggleApproval("company", company.id, company.is_approved)}
                        >
                          {actionLoading === company.id ? <Loader2 className="w-4 h-4 animate-spin" /> :
                            (company.is_approved ? <><XCircle className="w-4 h-4 mr-2" /> Revoke</> : <><CheckCircle className="w-4 h-4 mr-2" /> Approve</>)}
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
          <Card className="border-green-100 shadow-lg overflow-hidden">
            <CardHeader className="bg-green-50/50 py-4">
              <CardTitle className="text-lg md:text-xl text-center lg:text-start">Product Catalog Approvals</CardTitle>
            </CardHeader>
            <CardContent className="p-0 sm:p-6">
              {/* Desktop View Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Image</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {products.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-10 text-center text-gray-500 italic">No products found</td>
                      </tr>
                    ) : (
                      products.map((product) => (
                        <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="w-12 h-12 relative rounded border overflow-hidden">
                              {product.product_photo_urls?.[0] ? (
                                <Image
                                  src={supabase.storage.from("product-media").getPublicUrl(product.product_photo_urls[0]).data.publicUrl}
                                  fill
                                  className="object-cover"
                                  alt=""
                                  unoptimized
                                />
                              ) : (
                                <div className="w-full h-full bg-gray-50 flex items-center justify-center"><Package className="w-5 h-5 text-gray-300" /></div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{product.product_name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-gray-600 text-sm font-semibold">{product.company_name || "Unknown"}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${product.is_approved ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                              {product.is_approved ? 'Approved' : 'Pending'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <Button
                              size="sm"
                              variant={product.is_approved ? "destructive" : "default"}
                              className={!product.is_approved ? "bg-green-600 hover:bg-green-700" : ""}
                              disabled={actionLoading === product.id}
                              onClick={() => handleToggleApproval("product", product.id, product.is_approved)}
                            >
                              {actionLoading === product.id ? <Loader2 className="w-4 h-4 animate-spin" /> :
                                (product.is_approved ? <><XCircle className="w-4 h-4 mr-2" /> Revoke</> : <><CheckCircle className="w-4 h-4 mr-2" /> Approve</>)}
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile View Cards */}
              <div className="md:hidden divide-y divide-gray-200">
                {products.length === 0 ? (
                  <div className="px-6 py-10 text-center text-gray-500 italic">No products found</div>
                ) : (
                  products.map((product) => (
                    <div key={product.id} className="p-4 space-y-4">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 relative rounded border overflow-hidden flex-shrink-0">
                          {product.product_photo_urls?.[0] ? (
                            <Image
                              src={supabase.storage.from("product-media").getPublicUrl(product.product_photo_urls[0]).data.publicUrl}
                              fill
                              className="object-cover"
                              alt=""
                              unoptimized
                            />
                          ) : (
                            <div className="w-full h-full bg-gray-50 flex items-center justify-center"><Package className="w-6 h-6 text-gray-300" /></div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-900 truncate">{product.product_name}</p>
                          <p className="text-xs font-bold text-green-700 uppercase tracking-tight">{product.company_name || "Unknown"}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${product.is_approved ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {product.is_approved ? 'Approved' : 'Pending'}
                        </span>
                        <Button
                          size="sm"
                          variant={product.is_approved ? "destructive" : "default"}
                          className={!product.is_approved ? "bg-green-600 hover:bg-green-700" : ""}
                          disabled={actionLoading === product.id}
                          onClick={() => handleToggleApproval("product", product.id, product.is_approved)}
                        >
                          {actionLoading === product.id ? <Loader2 className="w-4 h-4 animate-spin" /> :
                            (product.is_approved ? <><XCircle className="w-4 h-4 mr-2" /> Revoke</> : <><CheckCircle className="w-4 h-4 mr-2" /> Approve</>)}
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