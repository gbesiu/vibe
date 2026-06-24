import { inngest } from "./client";
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

// ─── BaseLinker Sync (hourly cron) ────────────────────────────────────────────

export const syncBaselinkterFunction = inngest.createFunction(
  { id: "sync-baselinker", retries: 2 },
  { cron: "0 * * * *" }, // every hour
  async ({ step }) => {
    const inventories = await step.run("get-inventories", async () => {
      return getInventories();
    });

    if (!inventories.length) return { synced: 0 };

    const inventory = inventories[0];

    const blCategories = await step.run("get-categories", async () => {
      return getInventoryCategories(inventory.inventory_id);
    });

    const categoryMap = new Map<number, string>();
    for (const [, cat] of Object.entries(blCategories)) {
      const slug = slugify(cat.name) || `category-${cat.category_id}`;
      await prisma.category.upsert({
        where: { slug },
        update: { name: cat.name },
        create: { name: cat.name, slug },
      });
      categoryMap.set(cat.category_id, slug);
    }

    const products = await step.run("get-all-products", async () => {
      return getAllProductsFromInventory(inventory.inventory_id);
    });

    let synced = 0;
    for (const product of products) {
      await step.run(`upsert-product-${product.product_id}`, async () => {
        const baseSlug = slugify(product.name) || `product-${product.product_id}`;
        const images = Object.values(product.images || {}).filter(Boolean);
        const mainImage = images[0] || null;

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
            price: product.price_brutto,
            stock: product.quantity,
            sku: product.sku || null,
            images,
            mainImage,
            categoryId,
            baselinkerData: product as object,
          },
          create: {
            name: product.name,
            slug: baseSlug,
            description: product.description || product.description_extra1 || null,
            price: product.price_brutto,
            stock: product.quantity,
            sku: product.sku || null,
            images,
            mainImage,
            categoryId,
            baselinkerProductId: String(product.product_id),
            baselinkerData: product as object,
            isActive: true,
            isPublished: true,
          },
        });
        synced++;
        return { synced };
      });
    }

    // Trigger AI content generation for new products without AI content
    await step.sendEvent("trigger-ai-generation", {
      name: "shop/generate-new-product-content",
      data: {},
    });

    return { synced, inventoryId: inventory.inventory_id };
  }
);

// ─── Generate AI content for products without it ─────────────────────────────

export const generateProductContentFunction = inngest.createFunction(
  { id: "generate-product-content", retries: 1, concurrency: 2 },
  { event: "shop/generate-new-product-content" },
  async ({ step }) => {
    // Find products without AI content
    const products = await step.run("find-products-without-ai", async () => {
      return prisma.product.findMany({
        where: { aiGeneratedAt: null, isActive: true },
        take: 10,
        orderBy: { createdAt: "desc" },
      });
    });

    for (const product of products) {
      await step.sendEvent(`trigger-generate-${product.id}`, {
        name: "shop/generate-single-product",
        data: { productId: product.id },
      });
    }

    return { triggered: products.length };
  }
);

export const generateSingleProductFunction = inngest.createFunction(
  { id: "generate-single-product", retries: 1, concurrency: 3 },
  { event: "shop/generate-single-product" },
  async ({ event, step }) => {
    const { productId } = event.data as { productId: string };

    const product = await step.run("get-product", async () => {
      return prisma.product.findUnique({ where: { id: productId } });
    });

    if (!product) return { error: "Product not found" };

    // Generate via our API route
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL!;
    const res = await step.run("call-generate-api", async () => {
      const response = await fetch(`${baseUrl}/api/products/${productId}/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Internal call – bypass auth by adding secret header
          "x-inngest-internal": process.env.INNGEST_SIGNING_KEY || "internal",
        },
      });
      return response.json();
    });

    return res;
  }
);
