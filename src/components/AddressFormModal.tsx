"use client"

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import type { UserProfile, Address } from "./ClientLayoutWrapper"; // Assuming Address is exported or defined here

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
import { Separator } from "@/components/ui/separator";

// Schema is unchanged
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
  // --- NEW ---
  // Keep track of the address ID we are editing, if any
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const { toast } = useToast();

  const form = useForm<AddressFormValues>({
    resolver: zodResolver(addressFormSchema),
    // Default values will be set by the useEffect hook
    defaultValues: {
      profileName: userProfile.name || "",
      primaryPhone: userProfile.phone || "",
      addressName: "",
      houseNumber: "",
      street: "",
      area: "",
      city: "",
      state: "",
      country: "India",
      pincode: "",
      secondaryPhone: "",
    },
  });

  // --- UPDATED useEffect ---
  // This now pre-fills the form with existing data if it's found
  useEffect(() => {
    // Find an existing address to edit. Prioritize the default one.
    const existingAddresses = userProfile.addresses || [];
    const addressToEdit = 
      existingAddresses.find(addr => addr.isDefault) || 
      (existingAddresses.length > 0 ? existingAddresses[0] : null);

    let defaultFormValues = {
      profileName: userProfile.name || "",
      primaryPhone: userProfile.phone || "",
      // Default blank address
      addressName: "",
      houseNumber: "",
      street: "",
      area: "",
      city: "",
      state: "",
      country: "India",
      pincode: "",
      secondaryPhone: "",
    };

    if (addressToEdit) {
      // If we found an address, fill the form with its data
      setEditingAddressId(addressToEdit.id); // Mark this ID for an update
      defaultFormValues = {
        ...defaultFormValues,
        addressName: addressToEdit.name || "", // 'name' on Address is 'addressName' in form
        houseNumber: addressToEdit.houseNumber || "",
        street: addressToEdit.street || "",
        area: addressToEdit.area || "",
        city: addressToEdit.city || "",
        state: addressToEdit.state || "",
        country: addressToEdit.country || "India",
        pincode: addressToEdit.pincode || "",
        secondaryPhone: addressToEdit.secondaryPhone || "",
        // Ensure phone is also pre-filled from address if profile one is missing
        primaryPhone: userProfile.phone || addressToEdit.primaryPhone || "",
      };
    } else {
      // No address found, so we're creating a new one
      setEditingAddressId(null);
    }
    
    form.reset(defaultFormValues);
    
  }, [userProfile, form, isOpen]); // Rerun when modal opens or profile changes

  // --- UPDATED onSubmit ---
  // This now handles both UPDATE and CREATE
  async function onSubmit(values: AddressFormValues) {
    setLoading(true);
    try {
      const { profileName, ...addressValues } = values;
      
      const currentAddresses = userProfile.addresses || [];
      let updatedAddresses;

      if (editingAddressId) {
        // --- UPDATE LOGIC ---
        // We are updating an existing address
        updatedAddresses = currentAddresses.map(addr => {
          if (addr.id === editingAddressId) {
            // This is the one we're editing
            return {
              ...addr, // Keep its original ID
              ...addressValues, // Apply all form values
              name: addressValues.addressName, // Map form name back to address name
              isDefault: true, // Ensure it's the default
            };
          }
          // Set all other addresses to not be default
          return { ...addr, isDefault: false };
        });
      } else {
        // --- CREATE LOGIC ---
        // We are adding a new address
        const newAddress = {
          id: crypto.randomUUID(),
          isDefault: true,
          ...addressValues,
          name: addressValues.addressName, // Map form name back to address name
        };
        updatedAddresses = [
          ...currentAddresses.map(addr => ({ ...addr, isDefault: false })),
          newAddress,
        ];
      }
      
      // 5. Update the user_profiles table (this part is the same)
      const { data, error } = await supabase
        .from('user_profiles')
        .update({
          name: profileName,
          addresses: updatedAddresses,
          phone: values.primaryPhone, // Update the main profile phone
        })
        .eq('id', userProfile.id)
        .select()
        .single();
      
      if (error) throw error;

      if (data) {
        toast({
          title: "Profile Saved!",
          description: "Your profile and address have been updated.",
          variant: "default",
        });
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