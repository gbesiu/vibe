import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { ShieldCheck } from "lucide-react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#080810] text-white">
      {/* Admin header */}
      <header className="fixed top-0 inset-x-0 z-30 h-16 bg-[#080810]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          {/* Brand */}
          <Link href="/admin" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/25 group-hover:shadow-indigo-500/40 transition-shadow">
              <ShieldCheck size={15} className="text-white" />
            </div>
            <div className="leading-none">
              <span className="text-white font-bold text-sm tracking-tight">
                Krypton
              </span>
              <span className="ml-2 text-xs text-white/40 font-medium uppercase tracking-widest">
                Admin
              </span>
            </div>
          </Link>

          {/* Nav */}
          <nav className="hidden sm:flex items-center gap-1">
            <Link
              href="/admin"
              className="px-3 py-1.5 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/5 transition-all"
            >
              Dashboard
            </Link>
            <Link
              href="/shop"
              className="px-3 py-1.5 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/5 transition-all"
            >
              Sklep ↗
            </Link>
          </nav>

          <UserButton
            appearance={{
              elements: { avatarBox: "w-8 h-8" },
            }}
          />
        </div>
      </header>

      <main className="pt-16">{children}</main>
    </div>
  );
}
