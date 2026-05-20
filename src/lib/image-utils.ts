import { supabase } from "./supabase";

/**
 * Robust helper to reconstruct the public URL from a stored path.
 * Handles:
 * 1. Missing paths (returns placeholder)
 * 2. Full HTTP URLs (returns directly)
 * 3. Double-prepended Supabase storage URLs (strips duplicates)
 * 4. Encoded paths (decodes before calling getPublicUrl)
 */
export const getPublicUrlFromPath = (path: string | undefined, bucket: "product-media" | "company-documents" = "product-media"): string => {
    if (!path) return "/placeholder.svg";
    
    // If it's already a full URL or contains the storage path twice, return it or fix it
    if (path.startsWith('http')) {
        if (path.includes('/storage/v1/object/public/') && path.split('/storage/v1/object/public/').length > 2) {
            // Return only the last part if it's double-prepended
            const parts = path.split('/storage/v1/object/public/');
            const lastPart = parts.pop();
            return lastPart?.startsWith('http') ? lastPart : path;
        }
        return path;
    }

    const decodedPath = decodeURIComponent(path); 
    const { data } = supabase.storage
        .from(bucket) 
        .getPublicUrl(decodedPath);
    return data.publicUrl || "/placeholder.svg";
};

export const getCompanyLogoUrlFromPath = (path: string | undefined): string => {
    return getPublicUrlFromPath(path, "company-documents");
};
