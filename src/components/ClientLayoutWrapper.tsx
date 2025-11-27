"use client";

import { useState, useEffect, ReactNode, useRef } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import AddressFormModal from "./AddressFormModal";
import { Loader2 } from "lucide-react";

/* ===================== TYPES ===================== */

export type Address = {
  id: string;
  area: string;
  city: string;
  name: string;
  state: string;
  street: string;
  country: string;
  pincode: string;
  isDefault: boolean;
  houseNumber: string;
  primaryPhone: string;
  secondaryPhone?: string;
};

export type UserProfile = {
  id: string;
  email: string;
  name: string | null;
  created_at: string;
  addresses: Address[];
  phone: string | null;
};

/* ===================== COMPONENT ===================== */

export default function ClientLayoutWrapper({
  children,
}: {
  children: ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const pathname = usePathname();
  const hasFetchedOnce = useRef(false);

  /* ===================== PROFILE CHECK ===================== */

  const checkUserAndProfile = async (silent = false) => {
    // CRITICAL FIX: Never show loader if we have fetched once, 
    // regardless of what triggered this function.
    if (!silent && !hasFetchedOnce.current) {
      setLoading(true);
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      setUser(null);
      setProfile(null);
      setIsModalOpen(false);
      setLoading(false);
      hasFetchedOnce.current = true;
      return;
    }

    setUser(session.user);

    // Optimization: If we already have a profile and this is a silent update,
    // we can skip the DB call if you want, or just let it run in background.
    // For now, we let it run to keep data fresh, but it won't trigger a loader.
    const { data: userProfile, error } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", session.user.id)
      .single();

    if (error) {
      console.error("Profile fetch error:", error.message);
      // Even on error, stop loading so the app doesn't hang
      if (!hasFetchedOnce.current) setLoading(false);
      return;
    }

    if (userProfile) {
      const typedProfile = userProfile as UserProfile;
      setProfile(typedProfile);
      validateProfileCompletion(typedProfile);
    }

    hasFetchedOnce.current = true;
    setLoading(false);
  };

  /* ===================== PROFILE VALIDATION ===================== */

  const validateProfileCompletion = (profileData: UserProfile) => {
    const hasName = profileData.name?.trim() !== "";
    const hasPhone = profileData.phone?.trim() !== "";
    const hasAddressWithPincode =
      profileData.addresses?.some(
        (addr) => addr.pincode?.trim() !== ""
      ) || false;

    const isCompanyRoute = pathname.startsWith("/company/");
    const needsProfileCompletion =
      !hasName || !hasPhone || !hasAddressWithPincode;

    if (needsProfileCompletion && !isCompanyRoute) {
      setIsModalOpen(true);
    } else {
      setIsModalOpen(false);
    }
  };

  /* ===================== EFFECT ===================== */

  useEffect(() => {
    // Initial load
    if (!hasFetchedOnce.current) {
      checkUserAndProfile();
    } else {
      // Silent background re-check on route change
      checkUserAndProfile(true);
    }

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // CRITICAL FIX: When switching tabs, Supabase fires SIGNED_IN.
        // We must NOT reset hasFetchedOnce here, or the loader will appear 
        // and unmount your Edit Page.
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          // Pass 'true' to ensure silent update
          checkUserAndProfile(true); 
        }

        if (event === "SIGNED_OUT") {
          setUser(null);
          setProfile(null);
          setIsModalOpen(false);
          hasFetchedOnce.current = false; // Only reset on actual sign out
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [pathname]);

  /* ===================== ADDRESS UPDATE ===================== */

  const handleAddressUpdated = (updatedProfile: UserProfile) => {
    setProfile(updatedProfile);
    validateProfileCompletion(updatedProfile);
  };

  /* ===================== LOADER (FIRST LOAD ONLY) ===================== */

  // Only show full screen loader on the absolute first load of the session
  if (loading && !hasFetchedOnce.current) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
      </div>
    );
  }

  /* ===================== RENDER ===================== */

  return (
    <>
      {children}

      {profile && (
        <AddressFormModal
          isOpen={isModalOpen}
          userProfile={profile}
          onAddressUpdated={handleAddressUpdated}
        />
      )}
    </>
  );
}