/**
 * BaseLinker API Client
 * Docs: https://api.baselinker.com/
 * All requests go to: https://api.baselinker.com/connector.php
 */

const BASELINKER_API_URL = "https://api.baselinker.com/connector.php";
const token = process.env.BASELINKER_API_TOKEN!;

type BLResponse<T> = {
  status: "SUCCESS" | "ERROR";
  error_code?: string;
  error_message?: string;
} & T;

async function callBL<T>(method: string, parameters: Record<string, unknown> = {}): Promise<T> {
  const body = new URLSearchParams({
    token,
    method,
    parameters: JSON.stringify(parameters),
  });

  const res = await fetch(BASELINKER_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    throw new Error(`BaseLinker HTTP error: ${res.status}`);
  }

  const data: BLResponse<T> = await res.json();

  if (data.status !== "SUCCESS") {
    throw new Error(`BaseLinker error [${data.error_code}]: ${data.error_message}`);
  }

  return data as T;
}

// ─── Inventories ──────────────────────────────────────────────────────────────

export type BLInventory = {
  inventory_id: number;
  name: string;
  description: string;
  languages: string[];
  default_language: string;
  price_groups: number[];
  default_price_group: number;
  warehouses: string[];
  default_warehouse: string;
  reservations: boolean;
};

export async function getInventories(): Promise<BLInventory[]> {
  const data = await callBL<{ inventories: BLInventory[] }>("getInventories");
  return data.inventories;
}

// ─── Products list ────────────────────────────────────────────────────────────

export type BLProductListItem = {
  product_id: number;
  ean: string;
  sku: string;
  name: string;
  quantity: number;
  price_brutto: number;
};

export async function getInventoryProductsList(
  inventoryId: number,
  page = 1
): Promise<{ products: Record<string, BLProductListItem>; total_products: number }> {
  const data = await callBL<{
    products: Record<string, BLProductListItem>;
    total_products: number;
  }>("getInventoryProductsList", {
    inventory_id: inventoryId,
    page,
  });
  return data;
}

// ─── Product details ──────────────────────────────────────────────────────────

export type BLProductData = {
  product_id: number;
  ean: string;
  sku: string;
  name: string;
  quantity: number;
  price_brutto: number;
  price_netto: number;
  price_wholesale_netto: number;
  tax_rate: number;
  description: string;
  description_extra1: string;
  description_extra2: string;
  description_extra3: string;
  description_extra4: string;
  images: Record<string, string>; // { "1": "url", "2": "url" ... }
  links: Record<string, string>;
  category_id: number;
  weight: number;
  width: number;
  height: number;
  length: number;
};

export async function getInventoryProductsData(
  inventoryId: number,
  productIds: number[]
): Promise<Record<string, BLProductData>> {
  const data = await callBL<{ products: Record<string, BLProductData> }>(
    "getInventoryProductsData",
    {
      inventory_id: inventoryId,
      products: productIds,
    }
  );
  return data.products;
}

// ─── Categories ───────────────────────────────────────────────────────────────

export type BLCategory = {
  category_id: number;
  name: string;
  parent_id: number;
};

export async function getInventoryCategories(
  inventoryId: number
): Promise<Record<string, BLCategory>> {
  const data = await callBL<{ categories: Record<string, BLCategory> }>(
    "getInventoryCategories",
    { inventory_id: inventoryId }
  );
  return data.categories;
}

// ─── Full sync helper ─────────────────────────────────────────────────────────

export async function getAllProductsFromInventory(inventoryId: number): Promise<BLProductData[]> {
  const allProducts: BLProductData[] = [];
  let page = 1;

  while (true) {
    const { products, total_products } = await getInventoryProductsList(inventoryId, page);
    const ids = Object.values(products).map((p) => p.product_id);

    if (ids.length === 0) break;

    const details = await getInventoryProductsData(inventoryId, ids);
    allProducts.push(...Object.values(details));

    if (allProducts.length >= total_products) break;
    page++;
    // Respect 100 req/min limit
    await new Promise((r) => setTimeout(r, 700));
  }

  return allProducts;
}
