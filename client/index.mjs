/**
 * Copyright 2026 Jae (Gyeol Project)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Zero-dependency HTTP client skeleton for api.gyeol.link and
 * standalone offline Ed25519 receipt signature verifier.
 * Contains zero lines of private core, parser, or grammar logic.
 */

export const DEFAULT_API_BASE_URL = 'https://api.gyeol.link';
export const CLIENT_VERSION = '0.8.5';

// RFC 8410 SubjectPublicKeyInfo (SPKI) DER prefix for a raw 32-byte Ed25519 public key.
const ED25519_SPKI_PREFIX = new Uint8Array([
  0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00,
]);

const TEXT_ENCODER = new TextEncoder();

export class GyeolApiError extends Error {
  /**
   * @param {string} message
   * @param {{ status?: number, code?: string, requestId?: string | null, body?: unknown }} [details]
   */
  constructor(message, details = {}) {
    super(message);
    this.name = 'GyeolApiError';
    this.status = details.status ?? 0;
    this.code = details.code ?? 'API_ERROR';
    this.requestId = details.requestId ?? null;
    this.body = details.body ?? null;
  }
}

/**
 * Deterministic canonical JSON serialization (UTF-16 key order, compact form).
 * Suitable for canonical receipt payload signing and verification.
 * @param {unknown} value
 * @returns {string}
 */
export function canonicalizeReceiptPayload(value) {
  const seen = new WeakSet();

  /** @param {unknown} v */
  function serialize(v) {
    if (v === null) return 'null';
    const t = typeof v;
    if (t === 'boolean') return v ? 'true' : 'false';
    if (t === 'string') return JSON.stringify(v);
    if (t === 'number') {
      if (!Number.isFinite(v)) {
        throw new TypeError('Receipt payload cannot contain non-finite numbers');
      }
      return Object.is(v, -0) ? '0' : JSON.stringify(v);
    }
    if (t !== 'object') {
      throw new TypeError(`Unsupported receipt payload type: ${t}`);
    }
    if (seen.has(v)) {
      throw new TypeError('Receipt payload cannot contain circular references');
    }
    seen.add(v);
    try {
      if (Array.isArray(v)) {
        const items = v.map((el) => (el === undefined ? 'null' : serialize(el)));
        return `[${items.join(',')}]`;
      }
      const obj = /** @type {Record<string, unknown>} */ (v);
      const keys = Object.keys(obj)
        .filter((k) => obj[k] !== undefined)
        .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
      const pairs = keys.map((k) => `${JSON.stringify(k)}:${serialize(obj[k])}`);
      return `{${pairs.join(',')}}`;
    } finally {
      seen.delete(v);
    }
  }

  return serialize(value);
}

/**
 * Encode the canonical UTF-8 byte sequence covered by an Ed25519 receipt signature.
 * @param {Record<string, unknown>} receipt
 * @returns {Uint8Array}
 */
export function encodeReceiptSigningBytes(receipt) {
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) {
    throw new TypeError('Receipt must be a plain object');
  }
  const requiredStrings = ['version', 'receiptId', 'issuedAt', 'algorithm', 'keyId'];
  for (const field of requiredStrings) {
    if (typeof receipt[field] !== 'string' || receipt[field].trim() === '') {
      throw new TypeError(`Receipt missing required string field: ${field}`);
    }
  }
  if (receipt.algorithm !== 'Ed25519') {
    throw new TypeError(`Unsupported receipt algorithm: ${String(receipt.algorithm)}`);
  }
  if (receipt.payload === undefined) {
    throw new TypeError('Receipt missing required field: payload');
  }

  const envelope = {
    algorithm: receipt.algorithm,
    issuedAt: receipt.issuedAt,
    keyId: receipt.keyId,
    payload: receipt.payload,
    receiptId: receipt.receiptId,
    version: receipt.version,
  };
  return TEXT_ENCODER.encode(canonicalizeReceiptPayload(envelope));
}

/**
 * Decode a base64 or base64url string into Uint8Array without runtime-specific dependencies.
 * @param {string} input
 * @returns {Uint8Array}
 */
function decodeBase64Flexible(input) {
  const cleaned = input.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cleaned) || cleaned.length % 4 === 1) {
    throw new TypeError('Invalid base64 encoding');
  }
  const padded = cleaned.length % 4 === 0 ? cleaned : cleaned + '='.repeat(4 - (cleaned.length % 4));
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(padded, 'base64'));
  }
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

/**
 * Convert a PEM-encoded SPKI public key into DER bytes.
 * @param {string} pem
 * @returns {Uint8Array}
 */
function pemToDer(pem) {
  const body = pem
    .replace(/-----BEGIN PUBLIC KEY-----/g, '')
    .replace(/-----END PUBLIC KEY-----/g, '')
    .replace(/\s+/g, '');
  if (!body) {
    throw new TypeError('Empty PEM public key');
  }
  return decodeBase64Flexible(body);
}

/**
 * Wrap a raw 32-byte Ed25519 public key into a 44-byte RFC 8410 SPKI DER buffer.
 * @param {Uint8Array} raw32
 * @returns {Uint8Array}
 */
function wrapRawEd25519ToSpki(raw32) {
  const out = new Uint8Array(ED25519_SPKI_PREFIX.length + raw32.length);
  out.set(ED25519_SPKI_PREFIX, 0);
  out.set(raw32, ED25519_SPKI_PREFIX.length);
  return out;
}

/**
 * Convert bytes to lowercase hexadecimal string.
 * @param {Uint8Array} bytes
 * @returns {string}
 */
function toHex(bytes) {
  let hex = '';
  for (let i = 0; i < bytes.length; i += 1) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Normalize an Ed25519 signature into a 64-byte Uint8Array.
 * @param {string | Uint8Array} signature
 * @returns {Uint8Array}
 */
function normalizeSignature(signature) {
  const bytes =
    signature instanceof Uint8Array
      ? signature
      : typeof signature === 'string'
        ? decodeBase64Flexible(signature)
        : null;
  if (!bytes || bytes.byteLength !== 64) {
    throw new TypeError('Ed25519 signature must be exactly 64 bytes');
  }
  return bytes;
}

/**
 * Verify a receipt using Node's built-in node:crypto module.
 * @param {Uint8Array} messageBytes
 * @param {Uint8Array} signatureBytes
 * @param {unknown} publicKey
 */
async function verifyWithNodeCrypto(messageBytes, signatureBytes, publicKey) {
  const nodeCrypto = await import('node:crypto');
  let keyObject;

  if (publicKey && typeof publicKey === 'object' && 'type' in publicKey && publicKey.type === 'public') {
    keyObject = publicKey;
  } else if (typeof publicKey === 'string') {
    if (publicKey.includes('BEGIN PUBLIC KEY')) {
      keyObject = nodeCrypto.createPublicKey(publicKey);
    } else {
      const decoded = decodeBase64Flexible(publicKey);
      const spki = decoded.byteLength === 32 ? wrapRawEd25519ToSpki(decoded) : decoded;
      keyObject = nodeCrypto.createPublicKey({ key: Buffer.from(spki), format: 'der', type: 'spki' });
    }
  } else if (publicKey instanceof Uint8Array) {
    const spki = publicKey.byteLength === 32 ? wrapRawEd25519ToSpki(publicKey) : publicKey;
    keyObject = nodeCrypto.createPublicKey({ key: Buffer.from(spki), format: 'der', type: 'spki' });
  } else if (publicKey && typeof publicKey === 'object' && 'kty' in publicKey) {
    keyObject = nodeCrypto.createPublicKey({ key: publicKey, format: 'jwk' });
  } else {
    throw new TypeError('Unsupported Ed25519 public key format for node:crypto');
  }

  const valid = nodeCrypto.verify(null, messageBytes, keyObject, signatureBytes);
  const digestSha256 = nodeCrypto.createHash('sha256').update(messageBytes).digest('hex');
  return { valid, engine: /** @type {const} */ ('node:crypto'), digestSha256 };
}

/**
 * Verify a receipt using standard Web Crypto SubtleCrypto.
 * @param {Uint8Array} messageBytes
 * @param {Uint8Array} signatureBytes
 * @param {unknown} publicKey
 */
async function verifyWithWebCrypto(messageBytes, signatureBytes, publicKey) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('Web Crypto SubtleCrypto is unavailable in this runtime');
  }

  let cryptoKey;
  if (typeof CryptoKey !== 'undefined' && publicKey instanceof CryptoKey) {
    cryptoKey = publicKey;
  } else if (typeof publicKey === 'string') {
    if (publicKey.includes('BEGIN PUBLIC KEY')) {
      cryptoKey = await subtle.importKey('spki', pemToDer(publicKey), { name: 'Ed25519' }, false, ['verify']);
    } else {
      const decoded = decodeBase64Flexible(publicKey);
      const format = decoded.byteLength === 32 ? 'raw' : 'spki';
      cryptoKey = await subtle.importKey(format, decoded, { name: 'Ed25519' }, false, ['verify']);
    }
  } else if (publicKey instanceof Uint8Array) {
    const format = publicKey.byteLength === 32 ? 'raw' : 'spki';
    cryptoKey = await subtle.importKey(format, publicKey, { name: 'Ed25519' }, false, ['verify']);
  } else if (publicKey && typeof publicKey === 'object' && 'kty' in publicKey) {
    cryptoKey = await subtle.importKey('jwk', publicKey, { name: 'Ed25519' }, false, ['verify']);
  } else {
    throw new TypeError('Unsupported Ed25519 public key format for Web Crypto');
  }

  const valid = await subtle.verify({ name: 'Ed25519' }, cryptoKey, signatureBytes, messageBytes);
  const digestBuf = await subtle.digest('SHA-256', messageBytes);
  return { valid, engine: /** @type {const} */ ('webcrypto'), digestSha256: toHex(new Uint8Array(digestBuf)) };
}

/**
 * Offline Ed25519 verification for receipts issued by api.gyeol.link.
 * Never throws on malformed input or invalid signatures; returns structured result.
 *
 * @param {Record<string, unknown>} receipt
 * @param {string | Uint8Array | Record<string, unknown>} publicKey
 * @param {{ mode?: 'auto' | 'node' | 'webcrypto' }} [options]
 * @returns {Promise<{ valid: boolean, engine: 'node:crypto' | 'webcrypto' | 'none', digestSha256: string | null, reason?: string }>}
 */
export async function verifyReceiptSignature(receipt, publicKey, options = {}) {
  const mode = options.mode ?? 'auto';
  let messageBytes;
  let signatureBytes;

  try {
    messageBytes = encodeReceiptSigningBytes(receipt);
    signatureBytes = normalizeSignature(/** @type {string | Uint8Array} */ (receipt.signature));
  } catch (err) {
    return {
      valid: false,
      engine: 'none',
      digestSha256: null,
      reason: err instanceof Error ? err.message : String(err),
    };
  }

  const isNodeRuntime =
    typeof process !== 'undefined' && Boolean(process.versions && process.versions.node);

  try {
    const useNode = mode === 'node' || (mode === 'auto' && isNodeRuntime);
    const result = useNode
      ? await verifyWithNodeCrypto(messageBytes, signatureBytes, publicKey)
      : await verifyWithWebCrypto(messageBytes, signatureBytes, publicKey);

    return result.valid
      ? { valid: true, engine: result.engine, digestSha256: result.digestSha256 }
      : {
          valid: false,
          engine: result.engine,
          digestSha256: result.digestSha256,
          reason: 'Ed25519 signature verification failed',
        };
  } catch (err) {
    return {
      valid: false,
      engine: mode === 'webcrypto' ? 'webcrypto' : isNodeRuntime ? 'node:crypto' : 'webcrypto',
      digestSha256: null,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Create a lightweight, zero-dependency HTTP client skeleton targeting api.gyeol.link.
 *
 * @param {{
 *   baseUrl?: string,
 *   apiKey?: string,
 *   timeoutMs?: number,
 *   headers?: Record<string, string>,
 *   fetch?: typeof globalThis.fetch
 * }} [options]
 */
export function createApiClient(options = {}) {
  const baseUrl = (options.baseUrl ?? DEFAULT_API_BASE_URL).replace(/\/+$/, '');
  const apiKey = options.apiKey ?? '';
  const timeoutMs = options.timeoutMs ?? 15_000;
  const baseHeaders = options.headers ?? {};
  const fetchImpl = options.fetch ?? globalThis.fetch;

  if (typeof fetchImpl !== 'function') {
    throw new Error('Global fetch is unavailable; pass a custom fetch implementation');
  }

  /**
   * @param {'GET' | 'POST'} method
   * @param {string} path
   * @param {unknown} [body]
   * @param {{ signal?: AbortSignal, headers?: Record<string, string> }} [reqOptions]
   */
  async function request(method, path, body, reqOptions = {}) {
    const controller = new AbortController();
    const timer = timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;
    const onExternalAbort = () => controller.abort();
    if (reqOptions.signal) {
      if (reqOptions.signal.aborted) controller.abort();
      else reqOptions.signal.addEventListener('abort', onExternalAbort, { once: true });
    }

    const headers = {
      Accept: 'application/json',
      'X-Gyeol-Client': `@gyeol/api-client/${CLIENT_VERSION}`,
      ...baseHeaders,
      ...(reqOptions.headers ?? {}),
    };
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    try {
      const response = await fetchImpl(`${baseUrl}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const requestId = response.headers?.get?.('x-request-id') ?? null;
      const contentType = response.headers?.get?.('content-type') ?? '';
      const parsedBody = contentType.includes('application/json')
        ? await response.json().catch(() => null)
        : await response.text().catch(() => '');

      if (!response.ok) {
        const errCode =
          parsedBody && typeof parsedBody === 'object' && 'code' in parsedBody
            ? String(parsedBody.code)
            : `HTTP_${response.status}`;
        const errMessage =
          parsedBody && typeof parsedBody === 'object' && 'message' in parsedBody
            ? String(parsedBody.message)
            : `Gyeol API request failed with status ${response.status}`;
        throw new GyeolApiError(errMessage, {
          status: response.status,
          code: errCode,
          requestId,
          body: parsedBody,
        });
      }

      return parsedBody;
    } finally {
      if (timer) clearTimeout(timer);
      if (reqOptions.signal) reqOptions.signal.removeEventListener('abort', onExternalAbort);
    }
  }

  return {
    baseUrl,
    /** Check hosted service status (GET /v1/health). */
    health(reqOptions) {
      return request('GET', '/v1/health', undefined, reqOptions);
    },
    /** Submit a structured payload for hosted verification (POST /v1/verify). */
    verify(payload, reqOptions) {
      return request('POST', '/v1/verify', payload, reqOptions);
    },
    /** Submit a structured payload for deterministic auditing and signed receipt issuance (POST /v1/audit). */
    audit(payload, reqOptions) {
      return request('POST', '/v1/audit', payload, reqOptions);
    },
    /** Retrieve a signed verification receipt by identifier (GET /v1/receipts/:id). */
    getReceipt(receiptId, reqOptions) {
      if (typeof receiptId !== 'string' || !receiptId.trim()) {
        throw new TypeError('receiptId must be a non-empty string');
      }
      return request('GET', `/v1/receipts/${encodeURIComponent(receiptId)}`, undefined, reqOptions);
    },
    /** Fetch hosted Ed25519 public verification keys (GET /v1/keys or /v1/keys/:keyId). */
    getPublicKey(keyId, reqOptions) {
      const path =
        typeof keyId === 'string' && keyId.trim()
          ? `/v1/keys/${encodeURIComponent(keyId)}`
          : '/v1/keys';
      return request('GET', path, undefined, reqOptions);
    },
  };
}
