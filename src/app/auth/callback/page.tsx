// src/app/auth/callback/page.tsx

"use client";

import { useEffect, useRef } from "react"; // Import useRef
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase"; // Make sure this path is correct
import { Loader2 } from "lucide-react";

export default function AuthCallback() {
  const router = useRouter();
  // Add a ref to prevent multiple redirect calls
  const redirectStarted = useRef(false);

  useEffect(() => {
    const handleRoleRedirect = async (userId: string) => {
      // Only run this logic once
      if (redirectStarted.current) return;
      redirectStarted.current = true; // Set the flag

      try {
        // Check if the user ID exists in the 'companies' table
        const { data: companyData, error: companyError } = await supabase
          .from("companies")
          .select("user_id")
          .eq("user_id", userId)
          .single();

        if (!companyError && companyData) {
          // Company User: Redirect to company dashboard
          router.replace("/company/dashboard");
        } else {
          // Regular User (or error): Redirect to home
          router.replace("/");
        }
      } catch (error) {
        console.error("Error during role redirect:", error);
        // Fallback redirect in case of any unexpected error
        router.replace("/");
      }
    };

    // This listener handles the session information from the URL hash
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      
      // *** THIS IS THE FIX ***
      // We listen for two events:
      // 1. SIGNED_IN: Fires when the user actively signs in.
      // 2. INITIAL_SESSION: Fires when the listener is set up
      //    AND a session is already present (from the URL hash).
      if (
        (event === "SIGNED_IN" || event === "INITIAL_SESSION") &&
        session
      ) {
        // Once signed in, perform the role check
        handleRoleRedirect(session.user.id);
      }
    });

    // Unsubscribe from the listener when the component unmounts
    return () => {
      subscription?.unsubscribe();
    };
  }, [router]);

  // Show a loading indicator while the auth exchange happens
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
      <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
      <p className="mt-4 text-lg text-gray-700">
        Please wait, signing you in...
      </p>
    </div>
  );
}