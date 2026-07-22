"use client";

import {
  ActionList,
  Badge,
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
  EmptyState,
  Icon,
  IndexTable,
  InlineStack,
  Modal,
  Popover,
  Select,
  SkeletonBodyText,
  Text,
  TextField,
  Thumbnail
} from "@shopify/polaris";
import { ClockIcon, MenuHorizontalIcon, SearchIcon } from "@shopify/polaris-icons";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  getProductWorkflowStatus,
  productMatchesStatusFilter,
  type ProductStatusFilter,
  ProductExperienceControl
} from "@/app/shopify/product-status-select";
import { useCommerceToast } from "@/app/shopify/shopify-polaris-provider";
import { loadProductsAfterSync } from "@/app/shopify/shopify-sync-retry";

type SyncStatusResponse = {
  ok: boolean;
  productCount?: number;
  latestRun?: {
    status: string;
    completedAt?: string | null;
    errorMessage?: string | null;
  } | null;
  error?: string;
};

type ProductRow = {
  externalProductId: string;
  title: string;
  imageUrl: string | null;
  mappingStatus: string;
  productPk: number | null;
  mappedModelName: string | null;
  copilotStatus: string | null;
  launchUrl: string | null;
  editUrl: string | null;
  storefrontCtaEnabled: boolean;
};

type StudioProduct = {
  productPk: number;
  modelName: string;
  razzlCode: string;
  statusCode: string | null;
};

type ProductsResponse = {
  ok: boolean;
  items?: ProductRow[];
  studioProducts?: StudioProduct[];
  studioDashboardUrl?: string;
  studioCreateCopilotUrl?: string;
  error?: string;
};

type ProductStats = {
  productCount: number;
  mappedCount: number;
  ctaEnabledCount: number;
};

type Props = {
  shop: string;
  apiPublicOrigin: string;
  tenantLinked: boolean;
  refreshVersion?: number;
  onProductStatsChange?: (stats: ProductStats) => void;
  onCreateCopilotUrl?: (url: string | null) => void;
  onStudioDashboardUrlChange?: (url: string | null) => void;
};

type SortColumn = "title" | "copilot" | "status";
type SortDirection = "asc" | "desc";

type MappingModalState = {
  id: string;
  title: string;
  imageUrl: string | null;
};

type UnmapModalState = {
  id: string;
  title: string;
  copilotName: string;
  fromStatus: "mapped" | "cta_on";
};

function rowCreateCopilotUrl(baseUrl: string, product: Pick<ProductRow, "externalProductId" | "title" | "imageUrl">) {
  const url = new URL(baseUrl);
  url.searchParams.set("shopify_product", product.externalProductId);
  if (product.title) {
    url.searchParams.set("shopify_title", product.title);
  }
  if (product.imageUrl) {
    url.searchParams.set("shopify_image", product.imageUrl);
  }
  return url.toString();
}

function formatSyncTime(value: string | null | undefined): string | null {
  if (!value) return null;
  return new Date(String(value)).toLocaleString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function workflowStatusSortKey(product: ProductRow): string {
  const status = getProductWorkflowStatus(product);
  if (status === "unmapped") return "0_unmapped";
  if (status === "mapped") return "1_mapped";
  return "2_cta_on";
}

function mappingProgressStorageKey(shop: string): string {
  return `razzl:shopify:mapping-progress:${shop}`;
}

function persistMappingProgress(shop: string, values: Set<string>) {
  try {
    window.localStorage.setItem(mappingProgressStorageKey(shop), JSON.stringify([...values]));
  } catch {
    // localStorage can be unavailable in privacy-restricted embedded contexts.
  }
}

function readMappingProgress(shop: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const stored = window.localStorage.getItem(mappingProgressStorageKey(shop));
    const parsed = stored ? (JSON.parse(stored) as unknown) : [];
    return new Set(
      Array.isArray(parsed)
        ? parsed.filter((value): value is string => typeof value === "string")
        : []
    );
  } catch {
    return new Set();
  }
}

export function ShopifyProductsPanel({
  shop,
  apiPublicOrigin,
  tenantLinked,
  refreshVersion = 0,
  onProductStatsChange,
  onCreateCopilotUrl,
  onStudioDashboardUrlChange
}: Props) {
  const showToast = useCommerceToast();
  const [syncStatus, setSyncStatus] = useState<SyncStatusResponse | null>(null);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [studioProducts, setStudioProducts] = useState<StudioProduct[]>([]);
  const [studioCreateCopilotUrl, setStudioCreateCopilotUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [reloadingProducts, setReloadingProducts] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProductStatusFilter>("all");
  const [sortColumn, setSortColumn] = useState<SortColumn>("title");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [activePopover, setActivePopover] = useState<string | null>(null);
  const [mappingModal, setMappingModal] = useState<MappingModalState | null>(null);
  const [unmapModal, setUnmapModal] = useState<UnmapModalState | null>(null);
  const [mapMode, setMapMode] = useState<"existing" | "create">("existing");
  const [copilotSearch, setCopilotSearch] = useState("");
  const [selectedCopilotPk, setSelectedCopilotPk] = useState("");
  const [updatingProducts, setUpdatingProducts] = useState<Set<string>>(() => new Set());
  const [mappingInProgress, setMappingInProgress] = useState<Set<string>>(() =>
    readMappingProgress(shop)
  );

  const setMappingProgress = useCallback(
    (externalProductId: string, inProgress: boolean) => {
      setMappingInProgress((current) => {
        const next = new Set(current);
        if (inProgress) {
          next.add(externalProductId);
        } else {
          next.delete(externalProductId);
        }
        persistMappingProgress(shop, next);
        return next;
      });
    },
    [shop]
  );

  function setProductUpdating(externalProductId: string, updating: boolean) {
    setUpdatingProducts((current) => {
      const next = new Set(current);
      if (updating) next.add(externalProductId);
      else next.delete(externalProductId);
      return next;
    });
  }

  const clearCompletedMappingProgress = useCallback(
    (items: ProductRow[]) => {
      const completedIds = new Set(
        items.filter((item) => Boolean(item.productPk)).map((item) => item.externalProductId)
      );
      if (completedIds.size === 0) return;
      setMappingInProgress((current) => {
        const next = new Set([...current].filter((id) => !completedIds.has(id)));
        if (next.size === current.size) return current;
        persistMappingProgress(shop, next);
        return next;
      });
    },
    [shop]
  );

  const updateStats = useCallback(
    (items: ProductRow[], count: number) => {
      onProductStatsChange?.({
        productCount: count,
        mappedCount: items.filter((item) => item.productPk).length,
        ctaEnabledCount: items.filter((item) => item.storefrontCtaEnabled).length
      });
    },
    [onProductStatsChange]
  );

  const loadData = useCallback(async (options?: { refreshing?: boolean }) => {
    if (options?.refreshing) {
      setReloadingProducts(true);
    }
    setErrorBanner(null);
    try {
      const [syncRes, productsRes] = await Promise.all([
        fetch(`${apiPublicOrigin}/api/commerce/sync?shop=${encodeURIComponent(shop)}`),
        tenantLinked
          ? fetch(`${apiPublicOrigin}/api/commerce/products?shop=${encodeURIComponent(shop)}`)
          : Promise.resolve(null)
      ]);

      const syncData = (await syncRes.json()) as SyncStatusResponse;
      setSyncStatus(syncData);

      if (productsRes) {
        const productsData = (await productsRes.json()) as ProductsResponse;
        if (productsData.ok) {
          const items = productsData.items ?? [];
          setProducts(items);
          clearCompletedMappingProgress(items);
          setStudioProducts(productsData.studioProducts ?? []);
          onStudioDashboardUrlChange?.(productsData.studioDashboardUrl ?? null);
          const createUrl = productsData.studioCreateCopilotUrl ?? null;
          setStudioCreateCopilotUrl(createUrl);
          onCreateCopilotUrl?.(createUrl);
          updateStats(items, syncData.productCount ?? items.length);
        } else {
          setErrorBanner(productsData.error ?? "Unable to load products");
        }
      } else {
        updateStats([], syncData.productCount ?? 0);
      }
    } catch {
      setErrorBanner("Unable to load product data");
    } finally {
      setLoading(false);
      setReloadingProducts(false);
    }
  }, [
    apiPublicOrigin,
    clearCompletedMappingProgress,
    onCreateCopilotUrl,
    onStudioDashboardUrlChange,
    shop,
    tenantLinked,
    updateStats
  ]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      await loadData();
      if (cancelled) return;
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [loadData, refreshVersion]);

  const filteredStudioProducts = useMemo(() => {
    const normalized = copilotSearch.trim().toLowerCase();
    if (!normalized) {
      return studioProducts;
    }
    return studioProducts.filter(
      (product) =>
        product.modelName.toLowerCase().includes(normalized) ||
        product.razzlCode.toLowerCase().includes(normalized)
    );
  }, [copilotSearch, studioProducts]);

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    let rows = [...products];

    if (normalizedQuery) {
      rows = rows.filter(
        (product) =>
          product.title.toLowerCase().includes(normalizedQuery) ||
          (product.mappedModelName?.toLowerCase().includes(normalizedQuery) ?? false)
      );
    }

    rows = rows.filter((product) => productMatchesStatusFilter(product, statusFilter));

    rows.sort((a, b) => {
      let cmp = 0;
      if (sortColumn === "title") {
        cmp = a.title.localeCompare(b.title);
      } else if (sortColumn === "copilot") {
        cmp = (a.mappedModelName ?? "").localeCompare(b.mappedModelName ?? "");
      } else {
        cmp = workflowStatusSortKey(a).localeCompare(workflowStatusSortKey(b));
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });

    return rows;
  }, [products, query, sortColumn, sortDirection, statusFilter]);

  const mappedCount = products.filter((product) => product.productPk).length;
  const lastSynced = formatSyncTime(syncStatus?.latestRun?.completedAt);

  function openMappingModal(product: ProductRow) {
    setMapMode("existing");
    setCopilotSearch("");
    setSelectedCopilotPk("");
    setMappingModal({ id: product.externalProductId, title: product.title, imageUrl: product.imageUrl });
  }

  async function handleRefreshSnapshots(externalProductId?: string) {
    setRefreshing(true);
    setErrorBanner(null);
    try {
      const response = await fetch(`${apiPublicOrigin}/api/commerce/mappings/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(externalProductId ? { shop, externalProductId } : { shop })
      });
      const data = (await response.json()) as { ok: boolean; refreshed?: number; error?: string };
      if (!response.ok || !data.ok) {
        setErrorBanner(data.error ?? "Refresh failed");
        return;
      }
      showToast(`Refreshed ${data.refreshed ?? 0} copilot snapshot(s)`);
      await loadData({ refreshing: true });
    } catch {
      setErrorBanner("Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setReloadingProducts(true);
    setErrorBanner(null);
    try {
      const response = await fetch(`${apiPublicOrigin}/api/commerce/sync?shop=${encodeURIComponent(shop)}`, {
        method: "POST"
      });
      const data = (await response.json()) as SyncStatusResponse & {
        error?: string;
        code?: string;
        stats?: { productsSeen?: number };
      };
      if (!response.ok || !data.ok) {
        const message =
          data.code === "BILLING_REQUIRED"
            ? "Complete the subscription step above before syncing products."
            : data.code === "TOKEN_REAUTH_REQUIRED"
              ? "Reconnect your Shopify store, then try sync again."
              : (data.error ?? "Sync failed");
        setErrorBanner(message);
        showToast(message, { isError: true });
      } else {
        const productsSeen = data.stats?.productsSeen ?? 0;
        const productsData = await loadProductsAfterSync(async () => {
          const productsResponse = await fetch(
            `${apiPublicOrigin}/api/commerce/products?shop=${encodeURIComponent(shop)}`
          );
          const result = (await productsResponse.json()) as ProductsResponse;
          return productsResponse.ok ? result : { ...result, ok: false };
        }, productsSeen);

        if (!productsData.ok) {
          throw new Error(productsData.error ?? "Unable to reload products after sync");
        }

        const items = productsData.items ?? [];
        if (productsSeen > 0 && items.length === 0) {
          throw new Error(
            "Sync finished, but the product list is still updating. Wait a moment and try again."
          );
        }

        setProducts(items);
        clearCompletedMappingProgress(items);
        setStudioProducts(productsData.studioProducts ?? []);
        onStudioDashboardUrlChange?.(productsData.studioDashboardUrl ?? null);
        const createUrl = productsData.studioCreateCopilotUrl ?? null;
        setStudioCreateCopilotUrl(createUrl);
        onCreateCopilotUrl?.(createUrl);
        updateStats(items, Math.max(productsSeen, items.length));
        showToast(`Sync complete — ${productsSeen} products processed`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sync failed";
      setErrorBanner(message);
      showToast(message, { isError: true });
    } finally {
      setSyncing(false);
      setReloadingProducts(false);
    }
  }

  async function handleMap(externalProductId: string, productPk: number) {
    setProductUpdating(externalProductId, true);
    setErrorBanner(null);
    try {
      const response = await fetch(`${apiPublicOrigin}/api/commerce/mappings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop, externalProductId, productPk })
      });
      const data = (await response.json()) as {
        ok: boolean;
        error?: string;
        code?: string;
      };
      if (!response.ok || !data.ok) {
        const message =
          data.code === "BILLING_REQUIRED"
            ? "Choose a Shopify plan before connecting a copilot."
            : (data.error ?? "Could not connect this copilot");
        setErrorBanner(message);
        showToast(message, { isError: true });
        return false;
      }
      setMappingModal(null);
      setMappingProgress(externalProductId, false);
      setSelectedCopilotPk("");
      setCopilotSearch("");
      showToast("Copilot connected");
      await loadData();
      return true;
    } catch {
      const message = "Could not connect this copilot. Check your connection and try again.";
      setErrorBanner(message);
      showToast(message, { isError: true });
      return false;
    } finally {
      setProductUpdating(externalProductId, false);
    }
  }

  async function handleUnmap(externalProductId: string) {
    setProductUpdating(externalProductId, true);
    try {
      const response = await fetch(
        `${apiPublicOrigin}/api/commerce/mappings?shop=${encodeURIComponent(shop)}&externalProductId=${encodeURIComponent(externalProductId)}`,
        { method: "DELETE" }
      );
      const data = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !data.ok) {
        showToast(data.error ?? "Could not disconnect this copilot", { isError: true });
        return false;
      }
      setUnmapModal(null);
      showToast("Copilot disconnected");
      await loadData();
      return true;
    } catch {
      showToast("Could not disconnect this copilot. Try again.", { isError: true });
      return false;
    } finally {
      setProductUpdating(externalProductId, false);
    }
  }

  async function handleToggleCta(externalProductId: string, enabled: boolean) {
    setProductUpdating(externalProductId, true);
    try {
      const response = await fetch(`${apiPublicOrigin}/api/commerce/mappings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop, externalProductId, enabled })
      });
      const data = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !data.ok) {
        showToast(data.error ?? "Could not update setup help", { isError: true });
        return false;
      }
      showToast(enabled ? "Setup help is now live" : "Setup help turned off");
      await loadData();
      return true;
    } catch {
      showToast("Could not update setup help. Try again.", { isError: true });
      return false;
    } finally {
      setProductUpdating(externalProductId, false);
    }
  }

  if (!tenantLinked) {
    return (
      <Card>
        <Text as="p" tone="subdued">
          Link your Razzl Studio account before syncing Shopify products.
        </Text>
      </Card>
    );
  }

  const resourceName = { singular: "product", plural: "products" };

  const rowMarkup = filteredProducts.map((product, index) => {
    const workflowStatus = getProductWorkflowStatus(product);
    const isPopoverOpen = activePopover === product.externalProductId;
    const isMapped = Boolean(product.productPk);
    const isUpdating = updatingProducts.has(product.externalProductId);
    const isMappingInProgress = mappingInProgress.has(product.externalProductId) && !isMapped;

    const actions: Array<{
      content: string;
      url?: string;
      external?: boolean;
      disabled?: boolean;
      destructive?: boolean;
      onAction?: () => void;
    }> = isMapped
      ? [
          {
            content: "Preview setup copilot",
            url: product.launchUrl ?? undefined,
            external: true,
            disabled: !product.launchUrl
          },
          {
            content: "Edit in Razzl Studio",
            url: product.editUrl ?? undefined,
            external: true,
            disabled: !product.editUrl
          },
          {
            content: "Change copilot",
            disabled: isUpdating,
            onAction: () => {
              setActivePopover(null);
              openMappingModal(product);
            }
          },
          {
            content: "Disconnect copilot",
            destructive: true,
            disabled: isUpdating,
            onAction: () => {
              setActivePopover(null);
              setUnmapModal({
                id: product.externalProductId,
                title: product.title,
                copilotName: product.mappedModelName ?? "Copilot",
                fromStatus: product.storefrontCtaEnabled ? "cta_on" : "mapped"
              });
            }
          },
          {
            content: "Refresh connection",
            disabled: isUpdating,
            onAction: () => {
              setActivePopover(null);
              void handleRefreshSnapshots(product.externalProductId);
            }
          }
        ]
      : [
          {
            content: "Connect a copilot",
            disabled: isUpdating,
            onAction: () => {
              setActivePopover(null);
              openMappingModal(product);
            }
          },
          {
            content: "Refresh connection",
            disabled: !isMappingInProgress || isUpdating,
            onAction: () => {
              setActivePopover(null);
              void handleRefreshSnapshots(product.externalProductId);
            }
          }
        ];

    return (
      <IndexTable.Row id={product.externalProductId} key={product.externalProductId} position={index}>
        <IndexTable.Cell>
          <InlineStack gap="300" blockAlign="center" wrap={false}>
            {product.imageUrl ? (
              <Thumbnail source={product.imageUrl} alt={product.title} size="small" />
            ) : (
              <Box minWidth="40px" minHeight="40px" background="bg-surface-secondary" borderRadius="200" />
            )}
            <Text as="span" variant="bodyMd" fontWeight="semibold">
              {product.title}
            </Text>
          </InlineStack>
        </IndexTable.Cell>
        <IndexTable.Cell>
          {product.mappedModelName ? (
            <BlockStack gap="100">
              <Text as="span" variant="bodyMd" fontWeight="semibold">
                {product.mappedModelName}
              </Text>
              <Text as="span" variant="bodySm" tone="subdued">
                Connected
              </Text>
            </BlockStack>
          ) : isMappingInProgress ? (
            <Badge tone="info">Connecting…</Badge>
          ) : (
            <Button size="slim" disabled={isUpdating} onClick={() => openMappingModal(product)}>
              Connect copilot
            </Button>
          )}
        </IndexTable.Cell>
        <IndexTable.Cell>
          <div className="shopify-product-experience-control">
            <ProductExperienceControl
              value={workflowStatus}
              productTitle={product.title}
              loading={isUpdating}
              onToggle={(enabled) => void handleToggleCta(product.externalProductId, enabled)}
            />
          </div>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Popover
            active={isPopoverOpen}
            activator={
              <Button
                icon={MenuHorizontalIcon}
                variant="plain"
                accessibilityLabel={`Actions for ${product.title}`}
                disabled={isUpdating}
                onClick={() =>
                  setActivePopover(isPopoverOpen ? null : product.externalProductId)
                }
              />
            }
            autofocusTarget="first-node"
            onClose={() => setActivePopover(null)}
          >
            <ActionList items={actions} />
          </Popover>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <>
      <Card padding="0">
        <Box padding="400">
          <BlockStack gap="400">
            <InlineStack align="space-between" blockAlign="start" gap="400">
              <BlockStack gap="100">
                <Text as="h2" variant="headingMd">
                  Products &amp; setup help
                </Text>
                <Text as="p" tone="subdued">
                  Connect each product to its setup copilot, then decide where setup help is live.
                </Text>
                <InlineStack gap="150">
                  <Badge>{`${products.length} products`}</Badge>
                  <Badge tone="info">{`${mappedCount} connected`}</Badge>
                  <Badge tone="success">
                    {`${products.filter((product) => product.storefrontCtaEnabled).length} live`}
                  </Badge>
                </InlineStack>
              </BlockStack>
              <InlineStack gap="200" blockAlign="center">
                {lastSynced ? (
                  <InlineStack gap="100" blockAlign="center">
                    <Icon source={ClockIcon} tone="subdued" />
                    <Text as="span" variant="bodySm" tone="subdued">
                      Last synced: {lastSynced}
                    </Text>
                  </InlineStack>
                ) : null}
                <Button
                  onClick={() => void handleRefreshSnapshots()}
                  loading={refreshing}
                  disabled={loading || reloadingProducts}
                >
                  Refresh connections
                </Button>
                <Button
                  variant="primary"
                  onClick={() => void handleSync()}
                  loading={syncing || reloadingProducts}
                  disabled={syncing || reloadingProducts}
                >
                  Sync catalog
                </Button>
              </InlineStack>
            </InlineStack>

            <InlineStack gap="300" wrap>
              <Box minWidth="240px" width="100%">
                <TextField
                  label="Search products"
                  labelHidden
                  value={query}
                  onChange={setQuery}
                  placeholder="Search by product or copilot name"
                  prefix={<Icon source={SearchIcon} />}
                  autoComplete="off"
                  clearButton
                  onClearButtonClick={() => setQuery("")}
                />
              </Box>
              <Select
                label="Filter"
                labelHidden
                options={[
                  { label: "All products", value: "all" },
                  { label: "Needs a copilot", value: "unmapped" },
                  { label: "Connected", value: "mapped" },
                  { label: "Live on storefront", value: "cta_on" }
                ]}
                value={statusFilter}
                onChange={(value) => setStatusFilter(value as ProductStatusFilter)}
              />
            </InlineStack>
          </BlockStack>
        </Box>

        {errorBanner ? (
          <Box paddingInline="400" paddingBlockEnd="300">
            <Banner tone="critical" onDismiss={() => setErrorBanner(null)}>
              {errorBanner}
            </Banner>
          </Box>
        ) : null}

        {syncStatus?.latestRun?.errorMessage ? (
          <Box paddingInline="400" paddingBlockEnd="300">
            <Banner tone="warning">{syncStatus.latestRun.errorMessage}</Banner>
          </Box>
        ) : null}

        {reloadingProducts ? (
          <Box paddingInline="400" paddingBlockEnd="300">
            <Banner tone="info">Updating product list…</Banner>
          </Box>
        ) : null}

        {loading || reloadingProducts ? (
          <Box padding="400">
            <SkeletonBodyText lines={6} />
          </Box>
        ) : products.length === 0 ? (
          <EmptyState
            heading="No products imported yet"
            action={{
              content: "Sync now",
              onAction: () => void handleSync(),
              loading: syncing || reloadingProducts
            }}
            image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
          >
            <p>Import your Shopify catalog to start connecting setup copilots.</p>
          </EmptyState>
        ) : (
          <div className="shopify-index-table-wrap">
            <IndexTable
              selectable={false}
              resourceName={resourceName}
              itemCount={filteredProducts.length}
              headings={[
                { title: "Store product", id: "title" },
                { title: "Razzl Copilot", id: "copilot" },
                { title: "Setup help visibility", id: "status" },
                { title: "Actions" }
              ]}
              sortable={[true, true, true, false]}
              sortDirection={sortDirection === "asc" ? "ascending" : "descending"}
              sortColumnIndex={sortColumn === "title" ? 0 : sortColumn === "copilot" ? 1 : 2}
              onSort={(headingIndex, direction) => {
                const column: SortColumn =
                  headingIndex === 0 ? "title" : headingIndex === 1 ? "copilot" : "status";
                setSortColumn(column);
                setSortDirection(direction === "ascending" ? "asc" : "desc");
              }}
            >
              {rowMarkup}
            </IndexTable>
            <div className="shopify-index-table-footer">
              <Text as="p" variant="bodySm" tone="subdued">
                Showing {filteredProducts.length} of {products.length} products · {mappedCount}{" "}
                connected · {products.filter((product) => product.storefrontCtaEnabled).length} live
              </Text>
            </div>
          </div>
        )}
      </Card>

      <Modal
        open={mappingModal !== null}
        onClose={() => {
          setMappingModal(null);
          setSelectedCopilotPk("");
          setCopilotSearch("");
          setMapMode("existing");
        }}
        title="Connect a setup copilot"
        primaryAction={
          mapMode === "existing"
            ? {
                content: "Connect copilot",
                disabled: !selectedCopilotPk,
                loading: mappingModal ? updatingProducts.has(mappingModal.id) : false,
                onAction: () => {
                  if (mappingModal && selectedCopilotPk) {
                    void handleMap(mappingModal.id, Number(selectedCopilotPk));
                  }
                }
              }
            : undefined
        }
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => {
              setMappingModal(null);
              setSelectedCopilotPk("");
              setCopilotSearch("");
              setMapMode("existing");
            }
          }
        ]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <BlockStack gap="100">
              <Text as="p" variant="bodyMd">
                Choose the setup guide customers should use for{" "}
                <strong>{mappingModal?.title ?? "this product"}</strong>.
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                The same Razzl copilot can be connected to more than one Shopify product.
              </Text>
            </BlockStack>

            <BlockStack gap="200">
              <Text as="h3" variant="headingSm">
                Where is the copilot?
              </Text>
              <InlineStack gap="200">
                <Button
                  variant={mapMode === "existing" ? "primary" : undefined}
                  onClick={() => setMapMode("existing")}
                >
                  Already in Razzl
                </Button>
                <Button
                  variant={mapMode === "create" ? "primary" : undefined}
                  onClick={() => setMapMode("create")}
                >
                  Create from a PDF
                </Button>
              </InlineStack>
            </BlockStack>

            {mapMode === "existing" ? (
              <BlockStack gap="300">
                <TextField
                  label="Find a copilot"
                  value={copilotSearch}
                  onChange={setCopilotSearch}
                  placeholder="Search by name or Razzl code"
                  autoComplete="off"
                  clearButton
                  onClearButtonClick={() => setCopilotSearch("")}
                />
                <Select
                  label="Choose a Razzl copilot"
                  options={[
                    { label: "Select copilot…", value: "" },
                    ...filteredStudioProducts.map((studioProduct) => ({
                      label: `${studioProduct.modelName} (${studioProduct.razzlCode})`,
                      value: String(studioProduct.productPk)
                    }))
                  ]}
                  value={selectedCopilotPk}
                  onChange={setSelectedCopilotPk}
                />
              </BlockStack>
            ) : studioCreateCopilotUrl && mappingModal ? (
              <BlockStack gap="200">
                <Text as="p" tone="subdued">
                  Create a polished setup copilot from an instruction PDF in Razzl Studio. When
                  it is ready, Studio will connect it back to this product automatically.
                </Text>
                <Button
                  variant="primary"
                  onClick={() => {
                    const externalProductId = mappingModal.id;
                    const url = rowCreateCopilotUrl(studioCreateCopilotUrl, {
                      externalProductId,
                      title: mappingModal.title,
                      imageUrl: mappingModal.imageUrl
                    });
                    setMappingProgress(externalProductId, true);
                    setMappingModal(null);
                    setMapMode("existing");
                    window.open(url, "_blank", "noopener,noreferrer");
                  }}
                >
                  Create in Razzl Studio
                </Button>
                <Text as="p" variant="bodySm" tone="subdued">
                  This row will show “Connecting…” until the new copilot is ready. Use Refresh
                  connections when you return.
                </Text>
              </BlockStack>
            ) : (
              <Text as="p" tone="subdued">
                Studio create URL is not available for this shop.
              </Text>
            )}
          </BlockStack>
        </Modal.Section>
      </Modal>

      <Modal
        open={unmapModal !== null}
        onClose={() => setUnmapModal(null)}
        title="Disconnect copilot from this product?"
        primaryAction={{
          content: "Disconnect copilot",
          destructive: true,
          loading: unmapModal ? updatingProducts.has(unmapModal.id) : false,
          onAction: () => {
            if (unmapModal) {
              void handleUnmap(unmapModal.id);
            }
          }
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => setUnmapModal(null)
          }
        ]}
      >
        <Modal.Section>
          <Text as="p" variant="bodyMd">
            <strong>{unmapModal?.copilotName ?? "This copilot"}</strong> will stay safely in Razzl
            and remain connected to any other Shopify products. Setup help will be removed from{" "}
            <strong>{unmapModal?.title ?? "this product"}</strong>
            {unmapModal?.fromStatus === "cta_on" ? " immediately." : "."}
          </Text>
        </Modal.Section>
      </Modal>
    </>
  );
}
