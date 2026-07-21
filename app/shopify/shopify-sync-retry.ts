export type ProductReadResult<T> = {
  ok: boolean;
  items?: T[];
  error?: string;
};

type RetryOptions = {
  maxRetries?: number;
  retryDelayMs?: number;
  delay?: (milliseconds: number) => Promise<void>;
};

const defaultDelay = (milliseconds: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));

/**
 * Shopify sync can finish just before the read replica/next request can see rows.
 * Retry only the specific impossible-looking state: sync saw products but GET is empty.
 */
export async function loadProductsAfterSync<TResult extends ProductReadResult<unknown>>(
  loadProducts: () => Promise<TResult>,
  productsSeen: number,
  options: RetryOptions = {}
): Promise<TResult> {
  const maxRetries = options.maxRetries ?? 3;
  const retryDelayMs = options.retryDelayMs ?? 500;
  const delay = options.delay ?? defaultDelay;

  let result = await loadProducts();
  for (
    let retry = 0;
    result.ok && productsSeen > 0 && (result.items?.length ?? 0) === 0 && retry < maxRetries;
    retry += 1
  ) {
    await delay(retryDelayMs);
    result = await loadProducts();
  }

  return result;
}
