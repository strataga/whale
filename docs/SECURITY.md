# Whale Security Notes

## Encryption-at-rest

Whale encrypts workspace AI API keys at rest using AES-256-GCM when an encryption key is configured.

- Set `ENCRYPTION_KEY` to a **64-character hex string** (32 bytes).
- Existing plaintext keys are automatically migrated to encrypted form the next time they are accessed.

Example:

```bash
export ENCRYPTION_KEY=$(openssl rand -hex 32)
```

## Bot request signing

Bot API requests must include:

- `Authorization: Bearer <device-token>`
- `X-Whale-Device-Id: <device-id>`
- `X-Whale-Timestamp: <unix-ms>`
- `X-Whale-Signature: <hex hmac>`

Signature payload (newline-delimited):

```
<timestamp>\n<HTTP_METHOD>\n<path+query>\n<raw body>
```

Compute `X-Whale-Signature` as `hex(hmac_sha256(device-token, payload))`.
Requests are accepted within a 5-minute clock skew window.

## Optional IP allowlist

Restrict bot traffic by setting a comma-separated allowlist in **Settings → Workspace**
(or via environment variables).

Environment variables:

- `WHALE_IP_ALLOWLIST` (preferred)
- `IP_ALLOWLIST` (fallback)

If both workspace and env allowlists are set, Whale allows IPs that appear in **either** list.
Supports exact IPv4/IPv6 values and IPv4 CIDR ranges.

Example:

```bash
export WHALE_IP_ALLOWLIST="203.0.113.10,203.0.113.0/24,::1"
```
