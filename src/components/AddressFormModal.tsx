"use client"

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast"; // Assuming you have this
import type { UserProfile } from "./ClientLayoutWrapper";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Separator } from "@/components/ui/separator"; // Added for visual separation

// This schema validates ALL form fields, including the new profileName
const addressFormSchema = z.object({
  profileName: z.string().min(1, "Your name is required"),
  addressName: z.string().min(1, "Address name is required (e.g., Home, Work)"),
  houseNumber: z.string().min(1, "House/Flat No. is required"),
  street: z.string().min(1, "Street/Road is required"),
  area: z.string().min(1, "Area/Locality is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  country: z.string().min(1, "Country is required"),
  pincode: z.string().min(5, "A valid Pincode is required"),
  primaryPhone: z.string().min(10, "A valid phone number is required"),
  secondaryPhone: z.string().optional(),
});

type AddressFormValues = z.infer<typeof addressFormSchema>;

interface AddressFormModalProps {
  isOpen: boolean;
  userProfile: UserProfile;
  onAddressUpdated: (updatedProfile: UserProfile) => void;
}

export default function AddressFormModal({
  isOpen,
  userProfile,
  onAddressUpdated,
}: AddressFormModalProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<AddressFormValues>({
    resolver: zodResolver(addressFormSchema),
    defaultValues: {
      profileName: userProfile.name || "", // Pre-fill name if it exists
      addressName: "",
      houseNumber: "",
      street: "",
      area: "",
      city: "",
      state: "",
      country: "India", // Default to India
      pincode: "",
      primaryPhone: userProfile.phone || "", // Pre-fill phone if it exists
      secondaryPhone: "",
    },
  });

  // This ensures the form resets to the user's current profile data
  // if the modal closes and reopens (e.g., during a session change)
  useEffect(() => {
    form.reset({
      profileName: userProfile.name || "",
      addressName: "",
      houseNumber: "",
      street: "",
      area: "",
      city: "",
      state: "",
      country: "India",
      pincode: "",
      primaryPhone: userProfile.phone || "",
      secondaryPhone: "",
    });
  }, [userProfile, form]);

  async function onSubmit(values: AddressFormValues) {
    setLoading(true);
    try {
      // 1. Destructure the values to separate profile name from address details
      const { profileName, ...addressValues } = values;

      // 2. Create the new address object
      const newAddress = {
        id: crypto.randomUUID(),
        isDefault: true, // Make this new address the default one
        ...addressValues, // Spread the rest of the address fields
      };

      // 3. Get the user's current addresses
      const currentAddresses = userProfile.addresses || [];
      
      // 4. Create the new addresses array
      // This maps over old addresses, sets them to NOT default,
      // and adds the new one as the default.
      const updatedAddresses = [
        ...currentAddresses.map(addr => ({ ...addr, isDefault: false })),
        newAddress,
      ];
      
      // 5. Update the user_profiles table
      const { data, error } = await supabase
        .from('user_profiles')
        .update({
          name: profileName, // <-- SAVES THE USER'S NAME
          addresses: updatedAddresses,
          // Also update the main 'phone' if it's missing or changed
          phone: values.primaryPhone,
        })
        .eq('id', userProfile.id)
        .select() // Ask Supabase to return the updated row
        .single();
      
      if (error) throw error;

      if (data) {
        toast({
          title: "Profile Saved!",
          description: "Your name and address have been updated.",
          variant: "default", // Use "default" or "success"
        });
        // 6. Pass the fully updated profile back to the layout wrapper
        onAddressUpdated(data as UserProfile);
      }
      
    } catch (err: any) {
      console.error("Error saving profile:", err.message);
      toast({
        title: "Error",
        description: err.message || "Could not save your profile.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    // 'open' controls the modal. 'onOpenChange' is empty to prevent closing
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Complete Your Profile</DialogTitle>
          <DialogDescription>
            Please add your name and at least one address to continue.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            
            {/* --- Profile Name Field --- */}
            <FormField
              control={form.control}
              name="profileName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Your Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter your full name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator className="my-6" />

            {/* --- Address Fields --- */}
            <FormField
              control={form.control}
              name="addressName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address Name (e.g., Home, Work)</FormLabel>
                  <FormControl>
                    <Input placeholder="Home" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="houseNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>House/Flat No.</FormLabel>
                    <FormControl>
                      <Input placeholder="12-B" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="street"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Street / Road</FormLabel>
                    <FormControl>
                      <Input placeholder="Main Street" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="area"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Area / Locality</FormLabel>
                  <FormControl>
                    <Input placeholder="Downtown" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <FormControl>
                      <Input placeholder="Mumbai" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="pincode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pincode</FormLabel>
                    <FormControl>
                      <Input placeholder="400001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>State</FormLabel>
                    <FormControl>
                      <Input placeholder="Maharashtra" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Country</FormLabel>
                    <FormControl>
                      <Input placeholder="India" {...field} />
Next.js
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="primaryPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Primary Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="075069..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="secondaryPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Secondary Phone (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="975069..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Profile and Address
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}