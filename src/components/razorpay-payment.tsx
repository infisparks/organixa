"use client"

import { useEffect, useCallback } from "react"

declare global {
  interface Window {
    Razorpay: any
  }
}

/**
 * Custom hook to handle Razorpay payments without component mounting lag.
 */
export function useRazorpay() {
  const openCheckout = useCallback((options: {
    amount: number
    name: string
    description: string
    image?: string
    prefill?: {
      name?: string
      email?: string
      contact?: string
      address?: string
    }
    onSuccess: (response: any) => void
    onFailure: (error: any) => void
  }) => {
    if (typeof window === "undefined" || !window.Razorpay) {
      console.error("Razorpay SDK not loaded")
      options.onFailure({ description: "Razorpay SDK not loaded. Please refresh." })
      return
    }

    const rzpOptions = {
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      amount: Math.round(options.amount * 100),
      currency: "INR",
      name: options.name,
      description: options.description,
      image: "", // Use empty string or public URL to avoid CORS/loopback errors in development
      handler: (response: any) => {
        options.onSuccess(response)
      },
      prefill: {
        name: options.prefill?.name || "",
        email: options.prefill?.email || "",
        contact: options.prefill?.contact || "",
      },
      notes: {
        address: options.prefill?.address || "",
      },
      theme: {
        color: "#10b981",
      },
      modal: {
        ondismiss: () => {
          options.onFailure({ description: "Payment cancelled by user" })
        },
        escape: true,
        backdropclose: false
      }
    }

    try {
      const rzp = new window.Razorpay(rzpOptions)
      rzp.open()
    } catch (err) {
      console.error("Razorpay Error:", err)
      options.onFailure({ description: "Failed to open Razorpay modal" })
    }
  }, [])

  return { openCheckout }
}

// Keep the component version for backward compatibility but use the hook logic
export default function RazorpayPayment(props: any) {
  const { openCheckout } = useRazorpay()

  useEffect(() => {
    openCheckout(props)
  }, []) // Trigger once on mount

  return null
}
