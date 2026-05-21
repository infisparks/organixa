"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Loader2, Clock, Mail, Phone, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"

export default function PendingApprovalPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [companyName, setCompanyName] = useState("")

  useEffect(() => {
    const checkStatus = async () => {
      setLoading(true)
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError || !session) {
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

      if (profile?.is_admin) {
        router.push("/company/dashboard")
        return
      }

      // Check company status
      const { data: company, error: companyError } = await supabase
        .from("companies")
        .select("company_name, is_approved")
        .eq("user_id", userId)
        .maybeSingle()

      if (companyError) {
        console.error("Error fetching company:", companyError)
        router.push("/")
        return
      }

      if (!company) {
        // No company profile found
        router.push("/company/registration")
        return
      }

      if (company.is_approved) {
        // Already approved
        router.push("/company/dashboard")
        return
      }

      setCompanyName(company.company_name)
      setLoading(false)
    }

    checkStatus()
  }, [router])

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F6F8]">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-indigo-600 mx-auto" />
          <span className="mt-3 block text-sm font-medium text-gray-600">Checking approval status...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F5F6F8] flex flex-col justify-between py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-md w-full mx-auto my-auto space-y-8">
        <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-8 text-center space-y-6">
          {/* Clock Icon */}
          <div className="mx-auto w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center">
            <Clock className="w-8 h-8 text-indigo-600" />
          </div>

          {/* Title & Description */}
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-[#111827]">Approval Pending</h2>
            <p className="text-sm text-[#6B7280]">
              Thank you for registering <span className="font-semibold text-indigo-600">{companyName}</span>.
            </p>
          </div>

          {/* Status Message */}
          <div className="border-t border-[#E5E7EB] pt-6 space-y-4 text-left">
            <p className="text-sm text-[#6B7280] leading-relaxed">
              Your industrial partner application is currently under review by the Organicza administration. We verify all registrations to maintain quality and security across our platform.
            </p>
            <div className="bg-slate-50 rounded-lg p-4 border border-[#E5E7EB] space-y-2">
              <span className="text-xs font-semibold text-[#111827] uppercase tracking-wider block">Expected Timeframe</span>
              <p className="text-xs text-[#6B7280]">
                Reviews are typically completed within 24 to 48 hours. You will receive access to your partner dashboard immediately upon approval.
              </p>
            </div>
          </div>

          {/* Contact Support details */}
          <div className="border-t border-[#E5E7EB] pt-6 text-center space-y-3">
            <span className="text-xs font-medium text-[#6B7280]">Need urgent approval or assistance?</span>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 text-sm text-[#111827]">
              <a href="mailto:organicza2025@gmail.com" id="support-email" className="flex items-center gap-1.5 hover:text-indigo-600 transition-colors">
                <Mail className="w-4 h-4 text-[#6B7280]" />
                organicza2025@gmail.com
              </a>
              <span className="hidden sm:inline text-gray-300">|</span>
              <a href="tel:7020977280" id="support-phone" className="flex items-center gap-1.5 hover:text-indigo-600 transition-colors">
                <Phone className="w-4 h-4 text-[#6B7280]" />
                +91 7020977280
              </a>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 flex flex-col gap-3">
            <Button
              id="btn-check-status"
              onClick={() => window.location.reload()}
              className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
            >
              Check Status
            </Button>
            <Button
              id="btn-pending-logout"
              variant="outline"
              onClick={handleLogout}
              className="w-full h-11 border border-[#E5E7EB] text-red-600 hover:bg-red-50 hover:text-red-700 font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Logout / Switch Account
            </Button>
          </div>
        </div>
      </div>
      
      <div className="text-center text-xs text-[#6B7280]">
        &copy; {new Date().getFullYear()} Organicza. All rights reserved.
      </div>
    </div>
  )
}
