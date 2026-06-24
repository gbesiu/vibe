import { CartProvider } from "@/hooks/use-cart";
import { ShopNavbar } from "@/components/shop/ShopNavbar";
import { CartDrawer } from "@/components/shop/CartDrawer";

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <div className="min-h-screen bg-[#0a0a12] text-white">
        <ShopNavbar />
        {/* CartDrawer is rendered inside ShopNavbar but we keep CartProvider wrapping both */}
        <main className="pt-16">{children}</main>
      </div>
    </CartProvider>
  );
}
