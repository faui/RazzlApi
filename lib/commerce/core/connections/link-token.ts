import { createHmac, randomBytes, timingSafeEqual } from "crypto";

const TOKEN_TTL_MS = 30 * 60 * 1000;

export type CommerceLinkTokenPayload = {
  shop: string;
  connectionId: number;
  exp: number;
  nonce: string;
};

function getLinkSigningSecret(): string {
  const secret = process.env.COMMERCE_STUDIO_LINK_SECRET?.trim();
  if (!secret) {
    throw new Error("COMMERCE_STUDIO_LINK_SECRET is not configured");
  }
  return secret;
}

function encodePayload(payload: CommerceLinkTokenPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodePayload(encoded: string): CommerceLinkTokenPayload {
  const json = Buffer.from(encoded, "base64url").toString("utf8");
  const payload = JSON.parse(json) as CommerceLinkTokenPayload;
  if (!payload.shop || !payload.connectionId || !payload.exp || !payload.nonce) {
    throw new Error("Invalid link token payload");
  }
  return payload;
}

/** Create a short-lived signed token for Studio → API tenant linking. */
export function createCommerceLinkToken(shop: string, connectionId: number): string {
  const payload: CommerceLinkTokenPayload = {
    shop,
    connectionId,
    exp: Date.now() + TOKEN_TTL_MS,
    nonce: randomBytes(8).toString("hex")
  };
  const encoded = encodePayload(payload);
  const signature = createHmac("sha256", getLinkSigningSecret()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

/** Verify token signature and expiry; returns payload if valid. */
export function verifyCommerceLinkToken(token: string): CommerceLinkTokenPayload {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) {
    throw new Error("Malformed link token");
  }

  const expected = createHmac("sha256", getLinkSigningSecret()).update(encoded).digest("base64url");
  try {
    if (!timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
      throw new Error("Invalid link token signature");
    }
  } catch {
    throw new Error("Invalid link token signature");
  }

  const payload = decodePayload(encoded);
  if (Date.now() > payload.exp) {
    throw new Error("Link token expired");
  }

  return payload;
}
