# Remote Bot Setup

Whale is a web app. Bots run anywhere (laptop, server, Raspberry Pi, another LAN) and communicate with Whale over HTTPS.

## What You Need

- A reachable Whale base URL (recommended: HTTPS with a real domain)
- A bot identity in Whale (bot ID + token)
- Network egress from the bot host to Whale (inbound connectivity to the bot is not required)

## Recommended Architecture

- **Whale (control plane)**: self-hosted Next.js app + database.
- **Bots (execution endpoints)**: stateless workers that poll or stream commands from Whale and post back status/output.

This scales naturally to multiple bots in different locations because communication is always outbound from each bot to Whale.

## Bot Communication (High Level)

Bots should:

1. Authenticate to Whale using their bot token.
2. Send periodic heartbeats so Whale can display online/offline status.
3. Fetch assigned work (or receive it via streaming endpoints, if enabled).
4. Post status updates and artifacts back to Whale as tasks progress/complete.

## Security Notes

- Treat bot tokens like passwords.
- Prefer least-privilege: restrict which projects/tags a bot is allowed to work on.
- If you expose Whale publicly, set an allowlist and/or enforce additional auth at the reverse proxy.

## Payments (x402)

Public task submission can be paywalled with x402.

- If a caller hits a paywalled public endpoint without valid payment, Whale returns `402 Payment Required` and includes a `payment-required` header describing the price.
- Once paid/verified, Whale accepts the request and links the transaction to the created task.

