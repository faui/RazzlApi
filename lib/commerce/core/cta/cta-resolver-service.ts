import {
  findMappingByExternalProductId,
  type ProductMappingListItem
} from "@/lib/commerce/core/mapping/mapping-repo";
import { requireLinkedShopConnection } from "@/lib/commerce/core/connections/adapter-context";
import {
  getOrCreateStorefrontCtaConfig,
  getStorefrontCtaConfig
} from "@/lib/commerce/core/cta/cta-config-repo";
import type { CommerceCtaOpenMode, CommerceCtaStyleMode } from "@/lib/commerce/types/enums";

export type CtaResolveResult = {
  visible: boolean;
  label?: string;
  launchUrl?: string;
  openMode?: CommerceCtaOpenMode;
  styleMode?: CommerceCtaStyleMode;
  showPoweredByRazzl?: boolean;
};

function isLaunchableStatus(status: string | null | undefined): boolean {
  return status === "active";
}

/** Public storefront resolver — fail closed when mapping/CTA/launch preconditions are not met. */
export async function resolveStorefrontCta(
  shop: string,
  externalProductId: string
): Promise<CtaResolveResult> {
  let connection;
  try {
    ({ connection } = await requireLinkedShopConnection(shop));
  } catch {
    return { visible: false };
  }

  if (!connection.tenant_fk || connection.install_status === "uninstalled") {
    return { visible: false };
  }

  const mapping = await findMappingByExternalProductId(
    connection.commerce_platform_connection_pk,
    externalProductId
  );

  if (
    !mapping?.product_fk ||
    mapping.mapping_status === "unmapped" ||
    mapping.mapping_status === "error" ||
    !mapping.storefront_cta_enabled ||
    !isLaunchableStatus(mapping.product_status_snapshot) ||
    !mapping.launch_url_snapshot ||
    !mapping.razzl_code_snapshot
  ) {
    return { visible: false };
  }

  const config =
    (await getStorefrontCtaConfig(connection.commerce_platform_connection_pk)) ??
    (await getOrCreateStorefrontCtaConfig(
      connection.commerce_platform_connection_pk,
      connection.platform_type
    ));

  const label =
    mapping.cta_label_override?.trim() ||
    config.cta_label_default?.trim() ||
    "Setup help";

  const openMode = (mapping.cta_open_mode_override ??
    config.cta_open_mode ??
    "new_tab") as CommerceCtaOpenMode;

  return {
    visible: true,
    label,
    launchUrl: mapping.launch_url_snapshot,
    openMode,
    styleMode: config.cta_style_mode,
    showPoweredByRazzl: Boolean(config.show_powered_by_razzl)
  };
}

export type { ProductMappingListItem };
