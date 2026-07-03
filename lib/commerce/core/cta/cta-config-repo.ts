import { commerceQuery } from "@/lib/commerce/core/db/query";
import { COMMERCE_TABLES } from "@/lib/commerce/types/enums";
import type {
  CommerceStorefrontCtaConfigRow,
  CommerceStorefrontCtaConfigUpdate
} from "@/lib/commerce/types/commerce-storefront-cta-config";
import type { CommercePlatformType } from "@/lib/commerce/types/enums";

const DEFAULTS = {
  cta_enabled_default: 0,
  cta_label_default: "Setup help",
  cta_open_mode: "new_tab" as const,
  cta_style_mode: "inherit_theme" as const,
  show_powered_by_razzl: 0,
  fallback_behavior: "hide" as const
};

export async function getStorefrontCtaConfig(
  connectionId: number
): Promise<CommerceStorefrontCtaConfigRow | null> {
  const rows = await commerceQuery<CommerceStorefrontCtaConfigRow[]>(
    `SELECT *
     FROM ${COMMERCE_TABLES.storefrontCtaConfig}
     WHERE commerce_platform_connection_fk = ?
     LIMIT 1`,
    [connectionId]
  );
  return rows[0] ?? null;
}

export async function getOrCreateStorefrontCtaConfig(
  connectionId: number,
  platformType: CommercePlatformType
): Promise<CommerceStorefrontCtaConfigRow> {
  const existing = await getStorefrontCtaConfig(connectionId);
  if (existing) {
    return existing;
  }

  await commerceQuery(
    `INSERT INTO ${COMMERCE_TABLES.storefrontCtaConfig} (
       commerce_platform_connection_fk,
       platform_type,
       cta_enabled_default,
       cta_label_default,
       cta_open_mode,
       cta_style_mode,
       show_powered_by_razzl,
       fallback_behavior
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      connectionId,
      platformType,
      DEFAULTS.cta_enabled_default,
      DEFAULTS.cta_label_default,
      DEFAULTS.cta_open_mode,
      DEFAULTS.cta_style_mode,
      DEFAULTS.show_powered_by_razzl,
      DEFAULTS.fallback_behavior
    ]
  );

  const created = await getStorefrontCtaConfig(connectionId);
  if (!created) {
    throw new Error("Failed to create storefront CTA config");
  }
  return created;
}

export async function updateStorefrontCtaConfig(
  connectionId: number,
  patch: CommerceStorefrontCtaConfigUpdate
): Promise<CommerceStorefrontCtaConfigRow> {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (patch.cta_enabled_default !== undefined) {
    sets.push("cta_enabled_default = ?");
    params.push(patch.cta_enabled_default ? 1 : 0);
  }
  if (patch.cta_label_default !== undefined) {
    sets.push("cta_label_default = ?");
    params.push(patch.cta_label_default);
  }
  if (patch.cta_open_mode !== undefined) {
    sets.push("cta_open_mode = ?");
    params.push(patch.cta_open_mode);
  }
  if (patch.cta_style_mode !== undefined) {
    sets.push("cta_style_mode = ?");
    params.push(patch.cta_style_mode);
  }
  if (patch.show_powered_by_razzl !== undefined) {
    sets.push("show_powered_by_razzl = ?");
    params.push(patch.show_powered_by_razzl ? 1 : 0);
  }
  if (patch.fallback_behavior !== undefined) {
    sets.push("fallback_behavior = ?");
    params.push(patch.fallback_behavior);
  }
  if (patch.settings_json !== undefined) {
    sets.push("settings_json = CAST(? AS JSON)");
    params.push(JSON.stringify(patch.settings_json));
  }

  if (sets.length === 0) {
    const row = await getStorefrontCtaConfig(connectionId);
    if (!row) {
      throw new Error("CTA config not found");
    }
    return row;
  }

  sets.push("updated_on = NOW()");
  params.push(connectionId);

  await commerceQuery(
    `UPDATE ${COMMERCE_TABLES.storefrontCtaConfig}
     SET ${sets.join(", ")}
     WHERE commerce_platform_connection_fk = ?`,
    params
  );

  const updated = await getStorefrontCtaConfig(connectionId);
  if (!updated) {
    throw new Error("CTA config not found after update");
  }
  return updated;
}
