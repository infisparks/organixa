"use client"

import { useState, useEffect, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import AddressFormModal from './AddressFormModal';
import { Loader2 } from 'lucide-react';

// --- FIX IS HERE ---
// Added 'export' so other files can import this type
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
  
  const pathname = usePathname();

  useEffect(() => {
    const checkUserAndProfile = async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        setUser(session.user);
        
        const { data: userProfile, error } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (error) {
          console.error("Error fetching user profile:", error.message);
        }

        if (userProfile) {
          const typedProfile = userProfile as UserProfile;
          setProfile(typedProfile);
          
          const hasName = typedProfile.name && typedProfile.name.trim() !== '';
          const hasPhone = typedProfile.phone && typedProfile.phone.trim() !== '';
          const addresses = typedProfile.addresses || [];
          const hasAddressWithPincode = addresses.some(
            (addr: Address) => addr.pincode && addr.pincode.trim() !== ''
          );
          
          const isCompanyRoute = pathname.startsWith('/company/');
          const needsProfileCompletion = !hasName || !hasPhone || !hasAddressWithPincode;
          
          if (needsProfileCompletion && !isCompanyRoute) {
            setIsModalOpen(true);
          }
        }
      }
      setLoading(false);
    };

    checkUserAndProfile();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN') {
          checkUserAndProfile();
        }
        if (event === 'SIGNED_OUT') {
          setUser(null);
          setProfile(null);
          setIsModalOpen(false);
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [pathname]);

  const handleAddressUpdated = (updatedProfile: UserProfile) => {
    setProfile(updatedProfile);
    
    const hasName = updatedProfile.name && updatedProfile.name.trim() !== '';
    const hasPhone = updatedProfile.phone && updatedProfile.phone.trim() !== '';
    const addresses = updatedProfile.addresses || [];
    const hasAddressWithPincode = addresses.some(
      (addr: Address) => addr.pincode && addr.pincode.trim() !== ''
    );
    
    const needsProfileCompletion = !hasName || !hasPhone || !hasAddressWithPincode;
    setIsModalOpen(needsProfileCompletion);
  };

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