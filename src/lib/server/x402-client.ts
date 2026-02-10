import "server-only";

import { createHmac } from "node:crypto";

/**
 * Signs a payment payload for x402 using the configured wallet.
 * In production this would use proper Web3 signing; here we use
 * HMAC-SHA256 with the wallet private key as a placeholder for
 * the actual on-chain signing mechanism.
 */
function signPayment(payload: string): string {
  const privateKey = process.env.X402_WALLET_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("X402_WALLET_PRIVATE_KEY is not configured");
  }
  return createHmac("sha256", privateKey).update(payload).digest("hex");
}

/**
 * Wraps fetch with automatic x402 payment handling.
 *
 * On a 402 response:
 * 1. Reads the PAYMENT-REQUIRED header for price info
 * 2. Signs the payment with the configured wallet
 * 3. Retries the request with a PAYMENT-SIGNATURE header
 */
export async function x402Fetch(
  url: string,
  options?: RequestInit,
): Promise<Response> {
  const walletAddress = process.env.X402_WALLET_ADDRESS;

  const response = await fetch(url, options);

  if (response.status !== 402) {
    return response;
  }

  // Parse 402 payment requirement
  const paymentRequired = response.headers.get("payment-required");
  if (!paymentRequired || !walletAddress) {
    // Cannot auto-pay -- return the 402 as-is
    return response;
  }

  let priceInfo: { amount?: string; network?: string; asset?: string };
  try {
    priceInfo = JSON.parse(paymentRequired) as {
      amount?: string;
      network?: string;
      asset?: string;
    };
  } catch {
    return response;
  }

  // Build payment signature
  const paymentPayload = JSON.stringify({
    payer: walletAddress,
    amount: priceInfo.amount,
    network: priceInfo.network,
    asset: priceInfo.asset,
    timestamp: Date.now(),
  });

  const signature = signPayment(paymentPayload);

  const paymentSignature = Buffer.from(
    JSON.stringify({ payload: paymentPayload, signature }),
  ).toString("base64");

  // Retry with payment
  const retryHeaders = new Headers(options?.headers);
  retryHeaders.set("payment-signature", paymentSignature);

  return fetch(url, {
    ...options,
    headers: retryHeaders,
  });
}
