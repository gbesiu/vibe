import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import {
  getInventories,
  getInventoryCategories,
  getAllProductsFromInventory,
  type BLProductData,
} from "@/lib/baselinker";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function POST() {
  const { userId } = await auth();
  const adminIds = (process.env.ADMIN_USER_IDS || "").split(",").map((s) => s.trim());

  if (!userId || (!adminIds.includes(userId) && adminIds[0] !== "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const inventories = await getInventories();
    if (!inventories.length) {
      return NextResponse.json({ error: "No inventories found in BaseLinker" }, { status: 404 });
    }

    const inventory = inventories[0]; // Use first inventory
    const results = {
      categoriesUpserted: 0,
      productsUpserted: 0,
      errors: [] as string[],
    };

    // ── Sync categories ────────────────────────────────────────────────────
    const blCategories = await getInventoryCategories(inventory.inventory_id);

    for (const cat of Object.values(blCategories)) {
      const slug = slugify(cat.name) || `category-${cat.category_id}`;
      await prisma.category.upsert({
        where: { slug },
        update: { name: cat.name },
        create: { name: cat.name, slug },
      });
      results.categoriesUpserted++;
    }

    // Build category lookup (BL category_id → our slug)
    const categoryMap = new Map<number, string>();
    for (const [, cat] of Object.entries(blCategories)) {
      categoryMap.set(cat.category_id, slugify(cat.name) || `category-${cat.category_id}`);
    }

    // ── Sync products ──────────────────────────────────────────────────────
    const products = await getAllProductsFromInventory(inventory.inventory_id);

    for (const product of products) {
      try {
        await upsertProduct(product, categoryMap);
        results.productsUpserted++;
      } catch (err) {
        results.errors.push(`Product ${product.product_id}: ${err}`);
      }
    }

    return NextResponse.json({
      success: true,
      inventoryId: inventory.inventory_id,
      inventoryName: inventory.name,
      ...results,
    });
  } catch (err) {
    console.error("[BaseLinker sync] error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

async function upsertProduct(
  product: BLProductData,
  categoryMap: Map<number, string>
) {
  const baseSlug = slugify(product.name) || `product-${product.product_id}`;

  // Gather images (BL sends as { "1": "url", "2": "url", ... })
  const images = Object.values(product.images || {}).filter(Boolean);
  const mainImage = images[0] || null;

  // Find category
  let categoryId: string | null = null;
  if (product.category_id) {
    const catSlug = categoryMap.get(product.category_id);
    if (catSlug) {
      const cat = await prisma.category.findUnique({ where: { slug: catSlug } });
      categoryId = cat?.id ?? null;
    }
  }

  await prisma.product.upsert({
    where: { baselinkerProductId: String(product.product_id) },
    update: {
      name: product.name,
      slug: baseSlug,
      description: product.description || product.description_extra1 || null,
      price: product.price_brutto,
      stock: product.quantity,
      sku: product.sku || null,
      images: images as string[],
      mainImage: mainImage as string | null,
      categoryId,
      baselinkerData: product as object,
      isActive: true,
    },
    create: {
      name: product.name,
      slug: baseSlug,
      description: product.description || product.description_extra1 || null,
      price: product.price_brutto,
      stock: product.quantity,
      sku: product.sku || null,
      images: images as string[],
      mainImage: mainImage as string | null,
      categoryId,
      baselinkerProductId: String(product.product_id),
      baselinkerData: product as object,
      isActive: true,
      isPublished: true,
    },
  });
}
