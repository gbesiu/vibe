"use client";

import Image from "next/image";
import { ShoppingCart, Sparkles } from "lucide-react";
import { useCart } from "@/hooks/use-cart";
import { useState } from "react";

type Product = {
  id: string;
  name: string;
  slug: string;
  price: number;
  mainImage?: string | null;
  images?: string[];
  aiDescription?: string | null;
  stock?: number;
  category?: { name: string } | null;
};

type ProductCardProps = {
  product: Product;
};

export function ProductCard({ product }: ProductCardProps) {
  const { addItem } = useCart();
  const [adding, setAdding] = useState(false);

  const imageUrl =
    product.mainImage || (product.images && product.images[0]) || null;
  const hasAI = Boolean(product.aiDescription);

  async function handleAddToCart() {
    setAdding(true);
    addItem({
      productId: product.id,
      name: product.name,
      price: product.price,
      image: imageUrl ?? undefined,
      slug: product.slug,
    });
    setTimeout(() => setAdding(false), 700);
  }

  return (
    <div className="group relative flex flex-col bg-white/5 border border-white/8 rounded-2xl overflow-hidden transition-all duration-300 hover:bg-white/8 hover:border-violet-500/30 hover:shadow-xl hover:shadow-violet-500/10 hover:-translate-y-0.5">
      {/* AI Badge */}
      {hasAI && (
        <div className="absolute top-3 left-3 z-10 flex items-center gap-1 bg-violet-500/20 border border-violet-500/30 backdrop-blur-sm text-violet-300 text-xs font-medium px-2 py-1 rounded-full">
          <Sparkles size={10} />
          AI
        </div>
      )}

      {/* Image */}
      <div className="relative aspect-square bg-gradient-to-br from-white/5 to-white/[0.02] overflow-hidden">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={product.name}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 via-indigo-500/5 to-pink-500/10 flex items-center justify-center">
            <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
              <ShoppingCart size={20} className="text-white/20" />
            </div>
          </div>
        )}

        {/* Stock badge */}
        {product.stock !== undefined && product.stock === 0 && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <span className="text-white/70 text-sm font-medium">
              Brak w magazynie
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-4 gap-3">
        {product.category && (
          <span className="text-xs text-white/40 uppercase tracking-wider font-medium">
            {product.category.name}
          </span>
        )}

        <h3 className="text-sm font-semibold text-white leading-tight line-clamp-2 group-hover:text-violet-100 transition-colors">
          {product.name}
        </h3>

        {product.aiDescription && (
          <p className="text-xs text-white/50 line-clamp-2 leading-relaxed">
            {product.aiDescription}
          </p>
        )}

        <div className="flex items-center justify-between mt-auto pt-2 border-t border-white/5">
          <span className="text-lg font-bold text-white">
            {product.price.toLocaleString("pl-PL", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
            <span className="text-sm font-normal text-white/60">zł</span>
          </span>

          <button
            onClick={handleAddToCart}
            disabled={adding || product.stock === 0}
            className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold px-3 py-2 rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-violet-500/25 active:scale-95"
          >
            <ShoppingCart size={13} />
            {adding ? "Dodano!" : "Do koszyka"}
          </button>
        </div>
      </div>
    </div>
  );
}
