import { CommerceAdapterError } from "@/lib/commerce/adapters/types";

export type OAuthCallbackFailure = {
  status: number;
  body: {
    ok: false;
    error: string;
    code: string;
    retryable?: boolean;
  };
};

export function mapOAuthCallbackFailure(error: unknown): OAuthCallbackFailure {
  if (error instanceof CommerceAdapterError) {
    const status =
      error.code === "TOKEN_EXCHANGE_FAILED" || error.code === "SHOP_FETCH_FAILED"
        ? 502
        : 500;
    return {
      status,
      body: {
        ok: false,
        error: error.message,
        code: error.code,
        retryable: error.retryable
      }
    };
  }

  if (error instanceof Error) {
    return {
      status: 500,
      body: {
        ok: false,
        error: error.message,
        code: "OAUTH_CALLBACK_FAILED"
      }
    };
  }

  return {
    status: 500,
    body: {
      ok: false,
      error: "OAuth callback failed",
      code: "OAUTH_CALLBACK_FAILED"
    }
  };
}
