// Copyright 2026 Jae (Gyeol Project)
// SPDX-License-Identifier: Apache-2.0

export declare const DEFAULT_API_BASE_URL: 'https://api.gyeol.link';
export declare const CLIENT_VERSION: '0.8.5';

export interface SignedReceiptEnvelope<TPayload = Record<string, unknown>> {
  version: string;
  receiptId: string;
  issuedAt: string;
  algorithm: 'Ed25519';
  keyId: string;
  payload: TPayload;
  signature: string | Uint8Array;
}

export interface ReceiptVerifyOptions {
  mode?: 'auto' | 'node' | 'webcrypto';
}

export interface ReceiptVerifyResult {
  valid: boolean;
  engine: 'node:crypto' | 'webcrypto' | 'none';
  digestSha256: string | null;
  reason?: string;
}

export interface ApiClientOptions {
  baseUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
  fetch?: typeof globalThis.fetch;
}

export interface RequestOptions {
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

export class GyeolApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId: string | null;
  readonly body: unknown;
  constructor(
    message: string,
    details?: {
      status?: number;
      code?: string;
      requestId?: string | null;
      body?: unknown;
    },
  );
}

export interface GyeolApiClient {
  readonly baseUrl: string;
  health(reqOptions?: RequestOptions): Promise<unknown>;
  verify(payload: Record<string, unknown>, reqOptions?: RequestOptions): Promise<unknown>;
  audit(payload: Record<string, unknown>, reqOptions?: RequestOptions): Promise<unknown>;
  getReceipt(receiptId: string, reqOptions?: RequestOptions): Promise<unknown>;
  getPublicKey(keyId?: string, reqOptions?: RequestOptions): Promise<unknown>;
}

export declare function canonicalizeReceiptPayload(value: unknown): string;

export declare function encodeReceiptSigningBytes(
  receipt: Omit<SignedReceiptEnvelope, 'signature'> & { signature?: string | Uint8Array },
): Uint8Array;

export declare function verifyReceiptSignature(
  receipt: SignedReceiptEnvelope | Record<string, unknown>,
  publicKey: string | Uint8Array | Record<string, unknown>,
  options?: ReceiptVerifyOptions,
): Promise<ReceiptVerifyResult>;

export declare function createApiClient(options?: ApiClientOptions): GyeolApiClient;
