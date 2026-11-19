# `@gyeol/api-client` (`0.8.5`, `Apache-2.0`)

Ultra-lightweight, zero-dependency HTTP client skeleton for the upcoming `api.gyeol.link` verification service and standalone offline `Ed25519` receipt verifier (`Node.js 22.18+` and Web Crypto `SubtleCrypto`).

This package intentionally contains **zero lines of private core engine, grammar, or parser code**.

## Features

- Zero third-party runtime dependencies (`"dependencies": {}`).
- `createApiClient(options)`: typed JSON transport wrapper targeting `https://api.gyeol.link` (`/v1/health`, `/v1/verify`, `/v1/audit`, `/v1/receipts/:id`, `/v1/keys/:keyId`).
- `verifyReceiptSignature(receipt, publicKey, options)`: deterministic offline `Ed25519` signature verification supporting PEM SPKI, DER SPKI, raw 32-byte keys, and JWK across both `node:crypto` and Web Crypto `SubtleCrypto`.

## Self-Test

Run the offline self-test suite (zero network calls):

```bash
node client/test/selftest.mjs
```

## Example Usage

```js
import { createApiClient, verifyReceiptSignature } from './index.mjs';

const client = createApiClient({
  baseUrl: 'https://api.gyeol.link',
  apiKey: process.env.GYEOL_API_KEY,
});

// Offline verification of a signed receipt returned by api.gyeol.link
const result = await verifyReceiptSignature(receipt, publicKeyPem);
if (!result.valid) {
  throw new Error(result.reason);
}
```
