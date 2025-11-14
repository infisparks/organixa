"use client"

import { useState, useEffect, ReactNode } from 'react';
import { usePathname } from 'next/navigation'; // Import usePathname
import { supabase } from '@/lib/supabase'; // Adjust path if needed
import type { User } from '@supabase/supabase-js';
import AddressFormModal from './AddressFormModal'; // The modal component
import { Loader2 } from 'lucide-react';

// Define the types based on your SQL data
type Address = {
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

// This matches your user_profiles table structure
export type UserProfile = {
  id: string;
  email: string;
  name: string | null;
  created_at: string;
  addresses: Address[]; // This is the JSONB column
  phone: string | null;
};

export default function ClientLayoutWrapper({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Get the current URL path
  const pathname = usePathname();

  useEffect(() => {
    const checkUserAndProfile = async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        setUser(session.user);
        
        // Fetch the user's profile from the public.user_profiles table
        const { data: userProfile, error } = await supabase
          .from('user_profiles')
          .select('*') // Select all columns
          .eq('id', session.user.id) // Match the user's auth ID
          .single();

        if (error) {
          console.error("Error fetching user profile:", error.message);
        }

        if (userProfile) {
          setProfile(userProfile as UserProfile);
          
          // Check the address condition
          const addresses = userProfile.addresses || [];
          const hasAddressWithPincode = addresses.some(
            (addr: Address) => addr.pincode && addr.pincode.trim() !== ''
          );
          
          // **UPDATED LOGIC**
          // Check if the current path starts with /company/
          const isCompanyRoute = pathname.startsWith('/company/');
          
          // If they have NO address AND it's NOT a company route,
          // then open the modal.
          if (!hasAddressWithPincode && !isCompanyRoute) {
            setIsModalOpen(true);
          }
        }
      }
      setLoading(false);
    };

    // Run the check on initial load
    checkUserAndProfile();

    // Listen for auth changes (login/logout)
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN') {
          // If user logs in, re-run the check
          checkUserAndProfile();
        }
        if (event === 'SIGNED_OUT') {
          // If user logs out, clear state
          setUser(null);
          setProfile(null);
          setIsModalOpen(false);
        }
      }
    );

    return () => {
      // Clean up the listener on unmount
      authListener.subscription.unsubscribe();
    };
  }, [pathname]); // Add pathname to the dependency array

  /**
   * This function is passed to the modal.
   * When the address is successfully updated, the modal calls this
   * function to update the layout's state and close the modal.
   */
  const handleAddressUpdated = (updatedProfile: UserProfile) => {
    setProfile(updatedProfile);
    
    // Re-check the address condition (it should be valid now)
    const addresses = updatedProfile.addresses || [];
    const hasAddressWithPincode = addresses.some(
      (addr: Address) => addr.pincode && addr.pincode.trim() !== ''
    );
    
    // This will set isModalOpen to false, closing the modal
    setIsModalOpen(!hasAddressWithPincode);
  };

  // While checking the session, show a full-page loader
  // to prevent layout flashes.
  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <>
      {children}
      
      {/* If the modal is open AND we have a profile, render the modal.
        We pass the profile and the update function as props.
      */}
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