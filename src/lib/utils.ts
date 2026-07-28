import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function parseNutrients(raw: any): Array<{ name: string; value: string }> {
  if (!raw) return []
  let data = raw
  if (typeof data === "string") {
    try {
      data = JSON.parse(data)
    } catch {
      return []
    }
  }
  if (Array.isArray(data)) {
    return data
      .map((item, idx) => {
        if (typeof item === "string") {
          return { name: `Nutrient ${idx + 1}`, value: item }
        }
        if (item && typeof item === "object") {
          const name = item.name || item.label || item.nutrient || item.title || item.key || "Nutrient"
          const value = item.value || item.amount || item.val || ""
          return { name: String(name).trim(), value: String(value).trim() }
        }
        return null
      })
      .filter((n): n is { name: string; value: string } => Boolean(n && n.name && n.value))
  }
  if (typeof data === "object" && data !== null) {
    return Object.entries(data)
      .map(([name, value]) => ({
        name: String(name).trim(),
        value: String(value).trim(),
      }))
      .filter((n) => Boolean(n.name && n.value))
  }
  return []
}

