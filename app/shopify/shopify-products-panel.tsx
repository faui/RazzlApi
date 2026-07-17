"use client";

import {
  ActionList,
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
  ChoiceList,
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
  ProductStatusSelect,
  type ProductWorkflowStatus
} from "@/app/shopify/product-status-select";
import { useCommerceToast } from "@/app/shopify/shopify-polaris-provider";

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
  onProductStatsChange?: (stats: ProductStats) => void;
  onCreateCopilotUrl?: (url: string | null) => void;
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

export function ShopifyProductsPanel({
  shop,
  apiPublicOrigin,
  tenantLinked,
  onProductStatsChange,
  onCreateCopilotUrl
}: Props) {
  const showToast = useCommerceToast();
  const [syncStatus, setSyncStatus] = useState<SyncStatusResponse | null>(null);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [studioProducts, setStudioProducts] = useState<StudioProduct[]>([]);
  const [studioCreateCopilotUrl, setStudioCreateCopilotUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortColumn, setSortColumn] = useState<SortColumn>("title");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [activePopover, setActivePopover] = useState<string | null>(null);
  const [mappingModal, setMappingModal] = useState<MappingModalState | null>(null);
  const [unmapModal, setUnmapModal] = useState<UnmapModalState | null>(null);
  const [mapMode, setMapMode] = useState<"existing" | "create">("existing");
  const [copilotSearch, setCopilotSearch] = useState("");
  const [selectedCopilotPk, setSelectedCopilotPk] = useState("");
  const [statusInlineErrors, setStatusInlineErrors] = useState<Record<string, string>>({});

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

  const loadData = useCallback(async () => {
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
          setStudioProducts(productsData.studioProducts ?? []);
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
    }
  }, [apiPublicOrigin, onCreateCopilotUrl, shop, tenantLinked, updateStats]);

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
  }, [loadData]);

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

    if (statusFilter === "mapped") {
      rows = rows.filter((product) => Boolean(product.productPk) && !product.storefrontCtaEnabled);
    } else if (statusFilter === "unmapped") {
      rows = rows.filter((product) => !product.productPk);
    } else if (statusFilter === "cta_on") {
      rows = rows.filter((product) => product.storefrontCtaEnabled);
    }

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

  function clearStatusInlineError(externalProductId: string) {
    setStatusInlineErrors((prev) => {
      if (!prev[externalProductId]) {
        return prev;
      }
      const next = { ...prev };
      delete next[externalProductId];
      return next;
    });
  }

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
      await loadData();
    } catch {
      setErrorBanner("Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setErrorBanner(null);
    try {
      const response = await fetch(`${apiPublicOrigin}/api/commerce/sync?shop=${encodeURIComponent(shop)}`, {
        method: "POST"
      });
      const data = (await response.json()) as SyncStatusResponse & {
        error?: string;
        stats?: { productsSeen?: number };
      };
      if (!response.ok || !data.ok) {
        setErrorBanner(data.error ?? "Sync failed");
        showToast(data.error ?? "Sync failed", { isError: true });
      } else {
        showToast(`Sync complete — ${data.stats?.productsSeen ?? 0} products processed`);
      }
      await loadData();
    } catch {
      setErrorBanner("Sync failed");
      showToast("Sync failed", { isError: true });
    } finally {
      setSyncing(false);
    }
  }

  async function handleMap(externalProductId: string, productPk: number) {
    setErrorBanner(null);
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
          ? "Approve a Shopify plan in the Billing section before mapping."
          : (data.error ?? "Mapping failed");
      setErrorBanner(message);
      showToast(message, { isError: true });
      return false;
    }
    setMappingModal(null);
    setSelectedCopilotPk("");
    setCopilotSearch("");
    clearStatusInlineError(externalProductId);
    showToast("Copilot mapped");
    await loadData();
    return true;
  }

  async function handleUnmap(externalProductId: string) {
    const response = await fetch(
      `${apiPublicOrigin}/api/commerce/mappings?shop=${encodeURIComponent(shop)}&externalProductId=${encodeURIComponent(externalProductId)}`,
      { method: "DELETE" }
    );
    const data = (await response.json()) as { ok: boolean; error?: string };
    if (!response.ok || !data.ok) {
      showToast(data.error ?? "Remove mapping failed", { isError: true });
      return false;
    }
    setUnmapModal(null);
    clearStatusInlineError(externalProductId);
    showToast("Mapping removed");
    await loadData();
    return true;
  }

  async function handleToggleCta(externalProductId: string, enabled: boolean) {
    const response = await fetch(`${apiPublicOrigin}/api/commerce/mappings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shop, externalProductId, enabled })
    });
    const data = (await response.json()) as { ok: boolean; error?: string };
    if (!response.ok || !data.ok) {
      showToast(data.error ?? "Status update failed", { isError: true });
      return false;
    }
    clearStatusInlineError(externalProductId);
    showToast(enabled ? "Storefront CTA enabled" : "Storefront CTA disabled");
    await loadData();
    return true;
  }

  function handleStatusChange(product: ProductRow, nextStatus: ProductWorkflowStatus) {
    const currentStatus = getProductWorkflowStatus(product);
    if (nextStatus === currentStatus) {
      return;
    }

    clearStatusInlineError(product.externalProductId);

    if (currentStatus === "unmapped" && nextStatus === "cta_on") {
      setStatusInlineErrors((prev) => ({
        ...prev,
        [product.externalProductId]: "Map a copilot first before enabling the storefront CTA."
      }));
      return;
    }

    if (currentStatus === "unmapped" && nextStatus === "mapped") {
      openMappingModal(product);
      return;
    }

    if (currentStatus === "mapped" && nextStatus === "cta_on") {
      void handleToggleCta(product.externalProductId, true);
      return;
    }

    if (currentStatus === "cta_on" && nextStatus === "mapped") {
      void handleToggleCta(product.externalProductId, false);
      return;
    }

    if (currentStatus === "mapped" && nextStatus === "unmapped") {
      setUnmapModal({
        id: product.externalProductId,
        title: product.title,
        copilotName: product.mappedModelName ?? "Copilot",
        fromStatus: "mapped"
      });
      return;
    }

    if (currentStatus === "cta_on" && nextStatus === "unmapped") {
      setUnmapModal({
        id: product.externalProductId,
        title: product.title,
        copilotName: product.mappedModelName ?? "Copilot",
        fromStatus: "cta_on"
      });
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

    const actions: Array<{
      content: string;
      url?: string;
      external?: boolean;
      disabled?: boolean;
      onAction?: () => void;
    }> = [
      {
        content: "Launch Copilot",
        url: product.launchUrl ?? undefined,
        external: true,
        disabled: !isMapped || !product.launchUrl
      },
      {
        content: "Edit in Studio",
        url: product.editUrl ?? undefined,
        external: true,
        disabled: !isMapped || !product.editUrl
      },
      {
        content: "Change mapping",
        onAction: () => {
          setActivePopover(null);
          openMappingModal(product);
        }
      },
      {
        content: "Refresh status",
        disabled: !isMapped,
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
            <Text as="span" variant="bodyMd">
              {product.mappedModelName}
            </Text>
          ) : (
            <Text as="span" tone="subdued" variant="bodySm">
              —
            </Text>
          )}
        </IndexTable.Cell>
        <IndexTable.Cell>
          <div className="shopify-product-status-select-wrap">
            <ProductStatusSelect
              value={workflowStatus}
              productTitle={product.title}
              inlineError={statusInlineErrors[product.externalProductId] ?? null}
              onChange={(next) => handleStatusChange(product, next)}
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
                  Store products
                </Text>
                <Text as="p" tone="subdued">
                  Map Shopify products to Razzl copilots or create a new copilot from a PDF.
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  {products.length} products · {mappedCount} mapped
                </Text>
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
                  disabled={loading}
                >
                  Refresh status
                </Button>
                <Button variant="primary" onClick={() => void handleSync()} loading={syncing}>
                  Sync now
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
                  { label: "Unmapped", value: "unmapped" },
                  { label: "Mapped", value: "mapped" },
                  { label: "Storefront CTA On", value: "cta_on" }
                ]}
                value={statusFilter}
                onChange={setStatusFilter}
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

        {loading ? (
          <Box padding="400">
            <SkeletonBodyText lines={6} />
          </Box>
        ) : products.length === 0 ? (
          <EmptyState
            heading="No products imported yet"
            action={{ content: "Sync now", onAction: () => void handleSync(), loading: syncing }}
            image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
          >
            <p>Import your Shopify catalog to start mapping copilots.</p>
          </EmptyState>
        ) : (
          <div className="shopify-index-table-wrap">
            <IndexTable
              selectable={false}
              resourceName={resourceName}
              itemCount={filteredProducts.length}
              headings={[
                { title: "Store product", id: "title" },
                { title: "Copilot", id: "copilot" },
                { title: "Status", id: "status" },
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
                Showing {filteredProducts.length} of {products.length} products · {mappedCount} mapped
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
        title={mappingModal ? `Map copilot — ${mappingModal.title}` : "Map copilot"}
        primaryAction={
          mapMode === "existing"
            ? {
                content: "Map copilot",
                disabled: !selectedCopilotPk,
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
            <ChoiceList
              title="How would you like to map this product?"
              choices={[
                { label: "Map existing copilot", value: "existing" },
                { label: "Create new copilot from PDF", value: "create" }
              ]}
              selected={[mapMode]}
              onChange={(selected) => setMapMode((selected[0] as "existing" | "create") ?? "existing")}
            />

            {mapMode === "existing" ? (
              <BlockStack gap="300">
                <TextField
                  label="Search copilots"
                  value={copilotSearch}
                  onChange={setCopilotSearch}
                  placeholder="Search by name or Razzl code"
                  autoComplete="off"
                  clearButton
                  onClearButtonClick={() => setCopilotSearch("")}
                />
                <Select
                  label="Razzl copilot"
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
                  Create a new copilot in Razzl Studio from a PDF, then return here to map it to this
                  product.
                </Text>
                <Button
                  url={rowCreateCopilotUrl(studioCreateCopilotUrl, {
                    externalProductId: mappingModal.id,
                    title: mappingModal.title,
                    imageUrl: mappingModal.imageUrl
                  })}
                  external
                  variant="primary"
                >
                  Create copilot from PDF in Studio
                </Button>
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
        title={
          unmapModal?.fromStatus === "cta_on"
            ? "Remove mapping and disable storefront CTA?"
            : "Remove copilot mapping?"
        }
        primaryAction={{
          content: "Remove mapping",
          destructive: true,
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
            {unmapModal?.fromStatus === "cta_on"
              ? "Remove mapping and disable storefront CTA? Customers on this product page will no longer see the Setup Copilot button."
              : `Remove copilot mapping? This will disconnect ${unmapModal?.copilotName ?? "this copilot"} from ${unmapModal?.title ?? "this product"}. The storefront CTA will be hidden immediately if active.`}
          </Text>
        </Modal.Section>
      </Modal>
    </>
  );
}
