import { prisma } from "@/lib/db";
import { ProductCard } from "@/components/shop/ProductCard";
import { ShoppingBag, RefreshCw } from "lucide-react";
import Link from "next/link";

export const revalidate = 60; // ISR every 60s

async function getProducts(categorySlug?: string) {
  return prisma.product.findMany({
    where: {
      isActive: true,
      isPublished: true,
      ...(categorySlug ? { category: { slug: categorySlug } } : {}),
    },
    include: { category: true },
    orderBy: { createdAt: "desc" },
  });
}

async function getCategories() {
  return prisma.category.findMany({
    orderBy: { name: "asc" },
  });
}

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const [products, categories] = await Promise.all([
    getProducts(category),
    getCategories(),
  ]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Hero banner */}
      <div className="mb-10 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-white mb-3 tracking-tight">
          Nasz{" "}
          <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
            Sklep
          </span>
        </h1>
        <p className="text-white/50 text-lg">
          Odkryj naszą kolekcję produktów
        </p>
      </div>

      {/* Category filter */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-8">
          <Link
            href="/shop"
            className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${
              !category
                ? "bg-violet-600 border-violet-500 text-white shadow-lg shadow-violet-500/20"
                : "bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/8 hover:border-white/20"
            }`}
          >
            Wszystkie
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/shop?category=${cat.slug}`}
              className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                category === cat.slug
                  ? "bg-violet-600 border-violet-500 text-white shadow-lg shadow-violet-500/20"
                  : "bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/8 hover:border-white/20"
              }`}
            >
              {cat.name}
            </Link>
          ))}
        </div>
      )}

      {/* Products grid */}
      {products.length === 0 ? (
        <EmptyState hasCategoryFilter={Boolean(category)} />
      ) : (
        <>
          <p className="text-white/40 text-sm mb-6">
            {products.length} produkt{products.length !== 1 ? "ów" : ""}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={{
                  ...product,
                  images: product.images as string[],
                  mainImage: product.mainImage ?? null,
                  aiDescription: product.aiDescription ?? null,
                  category: product.category
                    ? { name: product.category.name }
                    : null,
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function EmptyState({ hasCategoryFilter }: { hasCategoryFilter: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-6">
      <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
        <ShoppingBag size={36} className="text-white/20" strokeWidth={1.5} />
      </div>
      <div className="text-center">
        <h2 className="text-xl font-semibold text-white/70 mb-2">
          {hasCategoryFilter
            ? "Brak produktów w tej kategorii"
            : "Brak produktów"}
        </h2>
        <p className="text-white/40 text-sm max-w-sm">
          {hasCategoryFilter
            ? "Spróbuj innej kategorii lub wróć do wszystkich produktów."
            : "Zsynchronizuj produkty z BaseLinker, aby zacząć sprzedawać."}
        </p>
      </div>
      {!hasCategoryFilter && (
        <Link
          href="/admin"
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-semibold px-5 py-2.5 rounded-xl transition-all hover:shadow-lg hover:shadow-violet-500/25"
        >
          <RefreshCw size={16} />
          Sync z Baselinker
        </Link>
      )}
      {hasCategoryFilter && (
        <Link
          href="/shop"
          className="text-violet-400 hover:text-violet-300 text-sm transition-colors"
        >
          ← Wszystkie produkty
        </Link>
      )}
    </div>
  );
}
