import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/shop/ProductCard";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const isAll = slug === "all";

  const category = isAll
    ? null
    : await prisma.category.findUnique({ where: { slug } });

  if (!isAll && !category) notFound();

  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      isPublished: true,
      ...(category ? { categoryId: category.id } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { category: true },
  });

  const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <nav className="flex items-center gap-2 text-sm text-white/40 mb-8">
        <Link href="/shop" className="hover:text-white transition-colors">Sklep</Link>
        <ChevronRight size={14} />
        <span className="text-white">{category?.name || "Wszystkie"}</span>
      </nav>

      <div className="flex gap-8">
        <aside className="hidden lg:block w-52 flex-shrink-0">
          <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">Kategorie</h3>
          <ul className="space-y-1">
            <li>
              <Link
                href="/shop/category/all"
                className={`block px-3 py-2 rounded-lg text-sm transition-all ${isAll ? "bg-violet-600 text-white" : "text-white/60 hover:text-white hover:bg-white/5"}`}
              >
                Wszystkie
              </Link>
            </li>
            {categories.map((cat) => (
              <li key={cat.id}>
                <Link
                  href={`/shop/category/${cat.slug}`}
                  className={`block px-3 py-2 rounded-lg text-sm transition-all ${cat.slug === slug ? "bg-violet-600 text-white" : "text-white/60 hover:text-white hover:bg-white/5"}`}
                >
                  {cat.name}
                </Link>
              </li>
            ))}
          </ul>
        </aside>

        <div className="flex-1">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-white">{category?.name || "Wszystkie produkty"}</h1>
            <span className="text-white/40 text-sm">{products.length} produktów</span>
          </div>
          {products.length === 0 ? (
            <div className="text-center py-20 text-white/40">Brak produktów w tej kategorii</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={{
                    ...product,
                    images: product.images as string[],
                    mainImage: product.mainImage ?? null,
                    aiDescription: product.aiDescription ?? null,
                    category: product.category ?? null,
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
