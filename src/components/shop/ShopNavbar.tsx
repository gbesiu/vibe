"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { Zap } from "lucide-react";
import { CartDrawer } from "./CartDrawer";

const navLinks = [
  { href: "/shop", label: "Sklep" },
  { href: "/shop/categories", label: "Kategorie" },
];

export function ShopNavbar() {
  const pathname = usePathname();

  return (
    <nav className="fixed top-0 inset-x-0 z-30 h-16 bg-[#0a0a12]/80 backdrop-blur-xl border-b border-white/5">
      <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-6">
        {/* Logo */}
        <Link
          href="/shop"
          className="flex items-center gap-2 flex-shrink-0 group"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/25 group-hover:shadow-violet-500/40 transition-shadow">
            <Zap size={16} className="text-white" fill="white" />
          </div>
          <span className="text-white font-bold text-lg tracking-tight">
            Krypton
          </span>
        </Link>

        {/* Nav links */}
        <div className="hidden sm:flex items-center gap-1">
          {navLinks.map((link) => {
            const active =
              link.href === "/shop"
                ? pathname === "/shop"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? "bg-violet-500/15 text-violet-300"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <CartDrawer />
          <div className="w-px h-5 bg-white/10" />
          <UserButton
            appearance={{
              elements: {
                avatarBox: "w-8 h-8",
              },
            }}
          />
        </div>
      </div>
    </nav>
  );
}
