/**
 * AP2 (Authorized Payment Protocol v2) mandate types.
 * Based on the Google + 60 partners spec for cryptographic payment authorization.
 */

export type AP2MandateType = "intent" | "cart" | "payment";

export type AP2MandateStatus =
  | "authorized"
  | "captured"
  | "settled"
  | "expired"
  | "revoked";

export interface AP2IntentMandate {
  type: "intent";
  id: string;
  payerIdentity: string;
  maxAmount: string;
  currency: string;
  description: string;
  expiresAt: string;
  signature: string;
}

export interface AP2CartMandate {
  type: "cart";
  id: string;
  payerIdentity: string;
  lineItems: AP2LineItem[];
  totalAmount: string;
  currency: string;
  expiresAt: string;
  signature: string;
}

export interface AP2PaymentMandate {
  type: "payment";
  id: string;
  payerIdentity: string;
  amount: string;
  currency: string;
  recipientIdentity: string;
  reference: string;
  expiresAt: string;
  signature: string;
}

export type AP2Mandate =
  | AP2IntentMandate
  | AP2CartMandate
  | AP2PaymentMandate;

export interface AP2LineItem {
  productId: string;
  name: string;
  quantity: number;
  priceCents: number;
}

export interface AP2MandateVerification {
  valid: boolean;
  mandate?: AP2Mandate;
  error?: string;
  expired?: boolean;
}

export interface AP2MandateCreateRequest {
  type: AP2MandateType;
  payerIdentity: string;
  amount: string;
  currency: string;
  description?: string;
  lineItems?: AP2LineItem[];
  recipientIdentity?: string;
  reference?: string;
  ttlSeconds?: number;
}
