import { CartProvider } from "@/hooks/use-cart";
import { ShopNavbar } from "@/components/shop/ShopNavbar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <div className="min-h-screen bg-[#0a0a12] text-white">
        <ShopNavbar />
        <main className="pt-16 max-w-7xl mx-auto">
          {children}
        </main>
      </div>
    </CartProvider>
  );
}
