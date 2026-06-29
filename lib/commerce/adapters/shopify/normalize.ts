import type {
  NormalizedCommerceProduct,
  NormalizedCommerceVariant
} from "@/lib/commerce/adapters/types";

/** Shopify Admin REST product shape (subset used for normalization). */
export type ShopifyRestProduct = {
  id: number | string;
  title: string;
  handle?: string | null;
  vendor?: string | null;
  product_type?: string | null;
  status?: string;
  tags?: string | string[];
  image?: { src?: string | null } | null;
  images?: Array<{ src?: string | null; position?: number }>;
  options?: Array<{ name: string; position?: number }>;
  variants?: ShopifyRestVariant[];
};

export type ShopifyRestVariant = {
  id: number | string;
  product_id?: number | string;
  title?: string | null;
  sku?: string | null;
  barcode?: string | null;
  status?: string | null;
  option1?: string | null;
  option2?: string | null;
  option3?: string | null;
};

function parseTags(tags: string | string[] | undefined): string[] {
  if (!tags) {
    return [];
  }
  if (Array.isArray(tags)) {
    return tags.map((tag) => tag.trim()).filter(Boolean);
  }
  return tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function resolvePrimaryImageUrl(product: ShopifyRestProduct): string | null {
  if (product.image?.src) {
    return product.image.src;
  }
  const images = product.images ?? [];
  if (images.length === 0) {
    return null;
  }
  const sorted = [...images].sort(
    (a, b) => (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER)
  );
  return sorted[0]?.src ?? null;
}

function buildOptionNameMap(product: ShopifyRestProduct): Map<number, string> {
  const map = new Map<number, string>();
  for (const option of product.options ?? []) {
    const position = option.position ?? map.size + 1;
    map.set(position, option.name);
  }
  if (map.size === 0) {
    map.set(1, "Option1");
    map.set(2, "Option2");
    map.set(3, "Option3");
  }
  return map;
}

function normalizeVariant(
  variant: ShopifyRestVariant,
  externalProductId: string,
  optionNames: Map<number, string>
): NormalizedCommerceVariant {
  const optionValues: Record<string, string> = {};
  const optionFields: Array<[number, string | null | undefined]> = [
    [1, variant.option1],
    [2, variant.option2],
    [3, variant.option3]
  ];

  for (const [position, value] of optionFields) {
    if (value) {
      optionValues[optionNames.get(position) ?? `Option${position}`] = value;
    }
  }

  return {
    externalVariantId: String(variant.id),
    externalProductId,
    title: variant.title ?? null,
    sku: variant.sku ?? null,
    barcode: variant.barcode ?? null,
    status: variant.status ?? null,
    optionValues,
    rawPayload: variant
  };
}

/** Map a Shopify Admin REST product payload to Razzl normalized types. */
export function normalizeShopifyProduct(product: ShopifyRestProduct): NormalizedCommerceProduct {
  const externalProductId = String(product.id);
  const optionNames = buildOptionNameMap(product);
  const variants = (product.variants ?? []).map((variant) =>
    normalizeVariant(variant, externalProductId, optionNames)
  );

  return {
    externalProductId,
    externalHandle: product.handle ?? null,
    title: product.title,
    vendorOrBrand: product.vendor ?? null,
    productType: product.product_type ?? null,
    status: product.status ?? "unknown",
    primaryImageUrl: resolvePrimaryImageUrl(product),
    tags: parseTags(product.tags),
    variants,
    rawPayload: product
  };
}
