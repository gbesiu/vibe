"use client";

import { ShoppingCart, X, Plus, Minus, Trash2, ArrowRight } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useCart } from "@/hooks/use-cart";

export function CartDrawer() {
  const [open, setOpen] = useState(false);
  const { items, removeItem, updateQuantity, totalItems, totalPrice } = useCart();

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setOpen(true)}
        className="relative p-2 text-white/80 hover:text-white transition-colors"
        aria-label="Koszyk"
      >
        <ShoppingCart size={22} />
        {totalItems > 0 && (
          <span className="absolute -top-1 -right-1 bg-violet-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
            {totalItems > 99 ? "99+" : totalItems}
          </span>
        )}
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed right-0 top-0 h-full w-full max-w-md bg-[#0f0f1a] border-l border-white/10 z-50 flex flex-col transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <ShoppingCart size={20} className="text-violet-400" />
            Koszyk
            {totalItems > 0 && (
              <span className="bg-violet-500/20 text-violet-300 text-sm px-2 py-0.5 rounded-full">
                {totalItems}
              </span>
            )}
          </h2>
          <button
            onClick={() => setOpen(false)}
            className="p-2 text-white/50 hover:text-white hover:bg-white/5 rounded-lg transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-white/40">
              <ShoppingCart size={48} strokeWidth={1} />
              <p className="text-sm">Twój koszyk jest pusty</p>
              <Link
                href="/shop"
                onClick={() => setOpen(false)}
                className="text-violet-400 text-sm hover:text-violet-300 transition-colors"
              >
                Przeglądaj produkty →
              </Link>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.productId}
                className="flex gap-3 p-3 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-all"
              >
                {/* Image */}
                <div className="w-16 h-16 rounded-lg overflow-hidden bg-white/10 flex-shrink-0">
                  {item.image ? (
                    <Image
                      src={item.image}
                      alt={item.name}
                      width={64}
                      height={64}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-violet-500/20 to-pink-500/20" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/shop/products/${item.slug}`}
                    onClick={() => setOpen(false)}
                    className="text-sm text-white font-medium hover:text-violet-300 transition-colors line-clamp-2"
                  >
                    {item.name}
                  </Link>
                  <p className="text-violet-400 font-semibold mt-1 text-sm">
                    {(item.price * item.quantity).toFixed(2)} zł
                  </p>

                  {/* Quantity */}
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                      className="w-6 h-6 rounded-md bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="text-sm text-white/80 w-6 text-center">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                      className="w-6 h-6 rounded-md bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all"
                    >
                      <Plus size={12} />
                    </button>
                    <button
                      onClick={() => removeItem(item.productId)}
                      className="ml-auto w-6 h-6 rounded-md text-red-400/60 hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center transition-all"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="p-5 border-t border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-white/60">Łącznie</span>
              <span className="text-xl font-bold text-white">{totalPrice.toFixed(2)} zł</span>
            </div>
            <Link
              href="/checkout"
              onClick={() => setOpen(false)}
              className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-semibold py-3 px-6 rounded-xl transition-all hover:shadow-lg hover:shadow-violet-500/25"
            >
              Przejdź do kasy
              <ArrowRight size={18} />
            </Link>
            <Link
              href="/cart"
              onClick={() => setOpen(false)}
              className="w-full flex items-center justify-center text-sm text-white/50 hover:text-white/80 transition-colors"
            >
              Wyświetl koszyk
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
