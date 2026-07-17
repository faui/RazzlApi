import { getShopifyEnvConfig } from "@/lib/commerce/config/shopify-env";
import { pingCommerceDb } from "@/lib/commerce/core/db/query";
import {
  decryptPlatformToken,
  encryptPlatformToken
} from "@/lib/commerce/core/crypto/token-crypto";

export type OAuthInfrastructureStatus = {
  ok: boolean;
  checks: {
    shopifyConfig: boolean;
    tokenEncryption: boolean;
    database: boolean;
  };
  errors: string[];
};

/** Pre-flight checks before starting or completing Shopify OAuth. */
export async function getShopifyOAuthInfrastructureStatus(): Promise<OAuthInfrastructureStatus> {
  const errors: string[] = [];
  let shopifyConfig = false;
  let tokenEncryption = false;

  try {
    getShopifyEnvConfig();
    shopifyConfig = true;
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  try {
    const encrypted = encryptPlatformToken("__oauth_readiness__");
    decryptPlatformToken(encrypted);
    tokenEncryption = true;
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  const database = await pingCommerceDb();
  if (!database) {
    errors.push("Commerce database ping failed");
  }

  return {
    ok: shopifyConfig && tokenEncryption && database,
    checks: { shopifyConfig, tokenEncryption, database },
    errors
  };
}
