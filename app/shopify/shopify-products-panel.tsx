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
import {
  ClockIcon,
  MenuHorizontalIcon,
  SearchIcon
} from "@shopify/polaris-icons";
import { useCallback, useEffect, useMemo, useState } from "react";

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

function copilotBadge(status: string | null, mappingStatus: string) {
  if (mappingStatus === "unmapped" || !status) {
    return { label: "Unmapped", tone: undefined as undefined };
  }
  switch (status) {
    case "active":
      return { label: "Published", tone: "success" as const };
    case "in-progress":
      return { label: "Processing", tone: "info" as const };
    case "processing-error":
      return { label: "Error", tone: "critical" as const };
    default:
      return { label: "Draft", tone: "warning" as const };
  }
}

function rowCreateCopilotUrl(baseUrl: string, externalProductId: string) {
  const url = new URL(baseUrl);
  url.searchParams.set("shopify_product", externalProductId);
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
  const [mappingModal, setMappingModal] = useState<{ id: string; title: string } | null>(null);
  const [selectedCopilotPk, setSelectedCopilotPk] = useState("");

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
      rows = rows.filter((product) => Boolean(product.productPk));
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
        cmp = (a.copilotStatus ?? a.mappingStatus).localeCompare(b.copilotStatus ?? b.mappingStatus);
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });

    return rows;
  }, [products, query, sortColumn, sortDirection, statusFilter]);

  const mappedCount = products.filter((product) => product.productPk).length;
  const lastSynced = formatSyncTime(syncStatus?.latestRun?.completedAt);

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
    const data = (await response.json()) as { ok: boolean; error?: string };
    if (!response.ok || !data.ok) {
      setErrorBanner(data.error ?? "Mapping failed");
      showToast(data.error ?? "Mapping failed", { isError: true });
      return;
    }
    setMappingModal(null);
    setSelectedCopilotPk("");
    showToast("Copilot mapped");
    await loadData();
  }

  async function handleUnmap(externalProductId: string) {
    const response = await fetch(
      `${apiPublicOrigin}/api/commerce/mappings?shop=${encodeURIComponent(shop)}&externalProductId=${encodeURIComponent(externalProductId)}`,
      { method: "DELETE" }
    );
    const data = (await response.json()) as { ok: boolean; error?: string };
    if (!response.ok || !data.ok) {
      showToast(data.error ?? "Unmap failed", { isError: true });
      return;
    }
    showToast("Copilot unmapped");
    await loadData();
  }

  async function handleToggleCta(externalProductId: string, enabled: boolean) {
    const response = await fetch(`${apiPublicOrigin}/api/commerce/mappings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shop, externalProductId, enabled })
    });
    const data = (await response.json()) as { ok: boolean; error?: string };
    if (!response.ok || !data.ok) {
      showToast(data.error ?? "CTA update failed", { isError: true });
      return;
    }
    showToast(enabled ? "Storefront CTA enabled" : "Storefront CTA disabled");
    await loadData();
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
    const badge = copilotBadge(product.copilotStatus, product.mappingStatus);
    const isPopoverOpen = activePopover === product.externalProductId;

    const actions: Array<{
      content: string;
      url?: string;
      external?: boolean;
      destructive?: boolean;
      onAction?: () => void;
    }> = [];

    if (product.launchUrl && product.copilotStatus === "active") {
      actions.push({
        content: "Launch Copilot",
        url: product.launchUrl,
        external: true
      });
    }
    if (product.editUrl) {
      actions.push({
        content: "Edit in Studio",
        url: product.editUrl,
        external: true
      });
    }
    if (!product.productPk && studioCreateCopilotUrl) {
      actions.push({
        content: "Create Copilot",
        url: rowCreateCopilotUrl(studioCreateCopilotUrl, product.externalProductId),
        external: true
      });
    }
    actions.push({
      content: product.productPk ? "Change mapping" : "Map Copilot",
      onAction: () => {
        setActivePopover(null);
        setMappingModal({ id: product.externalProductId, title: product.title });
        setSelectedCopilotPk("");
      }
    });
    if (product.productPk) {
      actions.push({
        content: "Refresh status",
        onAction: () => {
          setActivePopover(null);
          void handleRefreshSnapshots(product.externalProductId);
        }
      });
      actions.push({
        content: "Unmap",
        destructive: true,
        onAction: () => {
          setActivePopover(null);
          void handleUnmap(product.externalProductId);
        }
      });
    }

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
              No copilot mapped
            </Text>
          )}
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone={badge.tone}>{badge.label}</Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>
          {product.productPk ? (
            <Button
              onClick={() =>
                void handleToggleCta(product.externalProductId, !product.storefrontCtaEnabled)
              }
              variant={product.storefrontCtaEnabled ? "primary" : "secondary"}
              size="slim"
            >
              {product.storefrontCtaEnabled ? "On" : "Off"}
            </Button>
          ) : (
            <Text as="span" tone="subdued" variant="bodySm">
              Map first
            </Text>
          )}
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
                <InlineStack gap="200" blockAlign="center">
                  <Badge tone="info">{`${products.length} products`}</Badge>
                  <Badge>{`${mappedCount} mapped`}</Badge>
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
                  { label: "Mapped", value: "mapped" },
                  { label: "Unmapped", value: "unmapped" },
                  { label: "CTA enabled", value: "cta_on" }
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
          <IndexTable
            selectable={false}
            resourceName={resourceName}
            itemCount={filteredProducts.length}
            headings={[
              { title: "Store product", id: "title" },
              { title: "Copilot", id: "copilot" },
              { title: "Status", id: "status" },
              { title: "Storefront CTA" },
              { title: "Actions" }
            ]}
            sortable={[true, true, true, false, false]}
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
        )}
      </Card>

      <Modal
        open={mappingModal !== null}
        onClose={() => {
          setMappingModal(null);
          setSelectedCopilotPk("");
        }}
        title={mappingModal ? `Map copilot — ${mappingModal.title}` : "Map copilot"}
        primaryAction={{
          content: "Map copilot",
          disabled: !selectedCopilotPk,
          onAction: () => {
            if (mappingModal && selectedCopilotPk) {
              void handleMap(mappingModal.id, Number(selectedCopilotPk));
            }
          }
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => {
              setMappingModal(null);
              setSelectedCopilotPk("");
            }
          }
        ]}
      >
        <Modal.Section>
          <Select
            label="Razzl copilot"
            options={[
              { label: "Select copilot…", value: "" },
              ...studioProducts.map((studioProduct) => ({
                label: `${studioProduct.modelName} (${studioProduct.razzlCode})`,
                value: String(studioProduct.productPk)
              }))
            ]}
            value={selectedCopilotPk}
            onChange={setSelectedCopilotPk}
          />
        </Modal.Section>
      </Modal>
    </>
  );
}
