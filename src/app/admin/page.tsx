"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import {
  RefreshCw,
  Package,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Loader2,
  TrendingUp,
  Clock,
} from "lucide-react";

type Product = {
  id: string;
  name: string;
  price: number;
  stock: number;
  sku: string | null;
  aiGeneratedAt: string | null;
  aiDescription: string | null;
  createdAt: string;
  category?: { name: string } | null;
};

type SyncResult = {
  success: boolean;
  categoriesUpserted?: number;
  productsUpserted?: number;
  errors?: string[];
  error?: string;
};

export default function AdminPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [generateResults, setGenerateResults] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push("/sign-in");
    }
  }, [isLoaded, isSignedIn, router]);

  useEffect(() => {
    if (isSignedIn) fetchProducts();
  }, [isSignedIn]);

  async function fetchProducts() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/products");
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products ?? []);
      }
    } catch {
      // fallback: empty
    } finally {
      setLoading(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/baselinker/sync", { method: "POST" });
      const data = await res.json();
      setSyncResult(data);
      if (data.success) fetchProducts();
    } catch (err) {
      setSyncResult({ success: false, error: String(err) });
    } finally {
      setSyncing(false);
    }
  }

  async function handleGenerateAI(productId: string) {
    setGeneratingId(productId);
    try {
      const res = await fetch(`/api/products/${productId}/generate`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        setGenerateResults((prev) => ({ ...prev, [productId]: true }));
        fetchProducts();
      }
    } catch {
      //
    } finally {
      setGeneratingId(null);
    }
  }

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 size={24} className="text-violet-400 animate-spin" />
      </div>
    );
  }

  const totalProducts = products.length;
  const aiProducts = products.filter((p) => p.aiGeneratedAt).length;
  const lastSync =
    products.length > 0
      ? new Date(Math.max(...products.map((p) => +new Date(p.createdAt))))
      : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-1">Dashboard</h1>
        <p className="text-white/40">Zarządzaj produktami i synchronizacją.</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={<Package size={20} className="text-violet-400" />}
          label="Produkty łącznie"
          value={String(totalProducts)}
          sub="w bazie danych"
        />
        <StatCard
          icon={<Sparkles size={20} className="text-indigo-400" />}
          label="Z treścią AI"
          value={String(aiProducts)}
          sub={`${totalProducts > 0 ? Math.round((aiProducts / totalProducts) * 100) : 0}% pokrycie`}
        />
        <StatCard
          icon={<Clock size={20} className="text-emerald-400" />}
          label="Ostatni sync"
          value={
            lastSync
              ? lastSync.toLocaleDateString("pl-PL", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "2-digit",
                })
              : "—"
          }
          sub={lastSync ? lastSync.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" }) : "brak danych"}
        />
      </div>

      {/* Sync section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-5 rounded-2xl bg-white/5 border border-white/10">
        <div className="flex-1">
          <h2 className="text-white font-semibold mb-1 flex items-center gap-2">
            <TrendingUp size={18} className="text-violet-400" />
            Synchronizacja z BaseLinker
          </h2>
          <p className="text-white/50 text-sm">
            Pobierz produkty i kategorie z BaseLinker do bazy danych.
          </p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold px-5 py-2.5 rounded-xl transition-all hover:shadow-lg hover:shadow-violet-500/25 active:scale-95"
        >
          {syncing ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <RefreshCw size={16} />
          )}
          {syncing ? "Synchronizowanie…" : "Sync teraz"}
        </button>
      </div>

      {/* Sync result */}
      {syncResult && (
        <div
          className={`flex items-start gap-3 p-4 rounded-xl border text-sm ${
            syncResult.success
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : "bg-red-500/10 border-red-500/30 text-red-300"
          }`}
        >
          {syncResult.success ? (
            <CheckCircle2 size={18} className="flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
          )}
          <div>
            {syncResult.success ? (
              <p>
                Zsynchronizowano{" "}
                <strong>{syncResult.productsUpserted}</strong> produktów i{" "}
                <strong>{syncResult.categoriesUpserted}</strong> kategorii.
                {syncResult.errors && syncResult.errors.length > 0 && (
                  <span className="text-yellow-400 ml-2">
                    ({syncResult.errors.length} błędy)
                  </span>
                )}
              </p>
            ) : (
              <p>Błąd: {syncResult.error}</p>
            )}
          </div>
        </div>
      )}

      {/* Products table */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">
          Lista produktów
        </h2>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="text-violet-400 animate-spin" />
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-16 text-white/40">
            <Package size={40} strokeWidth={1.5} className="mx-auto mb-3" />
            <p>Brak produktów. Najpierw wykonaj synchronizację.</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="text-left px-4 py-3 text-white/50 font-medium">
                    Produkt
                  </th>
                  <th className="text-right px-4 py-3 text-white/50 font-medium hidden sm:table-cell">
                    Cena
                  </th>
                  <th className="text-right px-4 py-3 text-white/50 font-medium hidden md:table-cell">
                    Stan
                  </th>
                  <th className="text-center px-4 py-3 text-white/50 font-medium">
                    AI
                  </th>
                  <th className="text-right px-4 py-3 text-white/50 font-medium">
                    Akcje
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {products.map((product) => (
                  <tr
                    key={product.id}
                    className="hover:bg-white/[0.03] transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-white font-medium line-clamp-1">
                          {product.name}
                        </p>
                        {product.sku && (
                          <p className="text-white/30 text-xs mt-0.5">
                            SKU: {product.sku}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-white/70 hidden sm:table-cell">
                      {product.price.toFixed(2)} zł
                    </td>
                    <td className="px-4 py-3 text-right hidden md:table-cell">
                      <span
                        className={`${
                          product.stock === 0
                            ? "text-red-400"
                            : product.stock <= 5
                            ? "text-yellow-400"
                            : "text-emerald-400"
                        }`}
                      >
                        {product.stock}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {product.aiGeneratedAt || generateResults[product.id] ? (
                        <span className="inline-flex items-center gap-1 bg-violet-500/15 text-violet-300 text-xs px-2 py-0.5 rounded-full">
                          <Sparkles size={10} />
                          AI
                        </span>
                      ) : (
                        <span className="text-white/20 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleGenerateAI(product.id)}
                        disabled={
                          generatingId === product.id ||
                          Boolean(product.aiGeneratedAt) ||
                          Boolean(generateResults[product.id])
                        }
                        className="inline-flex items-center gap-1 bg-white/5 hover:bg-violet-500/20 border border-white/10 hover:border-violet-500/30 disabled:opacity-40 disabled:cursor-not-allowed text-white/70 hover:text-violet-300 text-xs px-3 py-1.5 rounded-lg transition-all"
                      >
                        {generatingId === product.id ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : (
                          <Sparkles size={11} />
                        )}
                        {product.aiGeneratedAt || generateResults[product.id]
                          ? "Wygenerowano"
                          : "Generate AI"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="flex items-start gap-4 p-5 rounded-2xl bg-white/5 border border-white/10">
      <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-white/50 text-xs font-medium uppercase tracking-wider mb-1">
          {label}
        </p>
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-white/40 text-xs mt-0.5">{sub}</p>
      </div>
    </div>
  );
}
