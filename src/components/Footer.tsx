"use client"

import Link from "next/link"
import Image from "next/image"
import { Leaf, Facebook, Instagram, Twitter, Linkedin, Mail, Phone } from "lucide-react"

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2 text-white">
              <Image
                src="/logo-dark.png"
                alt="organicza logo"
                width={200}
                height={60}
                className="h-12 sm:h-14 w-auto object-contain"
              />
            </Link>
            <p className="text-sm leading-relaxed">
              Your trusted source for premium organic products, delivered fresh to your door.
            </p>
            <div className="flex space-x-4 mt-4">
              <a href="#" className="text-gray-400 hover:text-white transition-colors" aria-label="Facebook">
                <Facebook className="h-5 w-5" />
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors" aria-label="Instagram">
                <Instagram className="h-5 w-5" />
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors" aria-label="Twitter">
                <Twitter className="h-5 w-5" />
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors" aria-label="LinkedIn">
                <Linkedin className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/" className="text-sm hover:text-white transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link href="/shop" className="text-sm hover:text-white transition-colors">
                  Shop
                </Link>
              </li>
              <li>
                <Link href="/orders" className="text-sm hover:text-white transition-colors">
                  My Orders
                </Link>
              </li>
              <li>
                <Link href="/addfav" className="text-sm hover:text-white transition-colors">
                  My Favourites
                </Link>
              </li>
              <li>
                <Link href="/cart" className="text-sm hover:text-white transition-colors">
                  My Carts
                </Link>
              </li>
            </ul>
          </div>

          {/* Customer Service */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Customer Service</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/orders" className="text-sm hover:text-white transition-colors">
                  My Orders
                </Link>
              </li>
              <li>
                <Link href="/returns" className="text-sm hover:text-white transition-colors">
                  Returns & Refunds
                </Link>
              </li>
              <li>
                <Link href="/shipping" className="text-sm hover:text-white transition-colors">
                  Shipping Information
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-sm hover:text-white transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-sm hover:text-white transition-colors">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Contact Us</h3>
            <address className="not-italic space-y-2 text-sm">
              <p>Organicza – Gateway of Wellness</p>
              <p className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-green-500" />
                <a href="tel:7020977280" className="hover:text-white transition-colors">
                  +91 70209 77280
                </a>
              </p>
              <p className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-green-500" />
                <a href="mailto:organicza2025@gmail.com" className="hover:text-white transition-colors">
                  organicza2025@gmail.com
                </a>
              </p>
            </address>
          </div>
        </div>

        <div className="border-t border-gray-700 mt-10 pt-8 text-center text-sm">
          <p>&copy; {new Date().getFullYear()} organicza. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
