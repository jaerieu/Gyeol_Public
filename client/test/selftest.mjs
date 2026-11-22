/**
 * Copyright 2026 Jae (Gyeol Project)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Offline self-test for @gyeol/api-client (zero network calls, zero external deps).
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import {
  CLIENT_VERSION,
  DEFAULT_API_BASE_URL,
  GyeolApiError,
  canonicalizeReceiptPayload,
  createApiClient,
  encodeReceiptSigningBytes,
  verifyReceiptSignature,
} from '../index.mjs';

function makeSignedReceipt(privateKey, payload) {
  const baseReceipt = {
    version: CLIENT_VERSION,
    receiptId: 'rcpt_20261119_0001',
    issuedAt: '2026-11-19T03:00:00Z',
    algorithm: 'Ed25519',
    keyId: 'gyeol-ed25519-2026-q4',
    payload,
  };
  const messageBytes = encodeReceiptSigningBytes(baseReceipt);
  const sig = crypto.sign(null, messageBytes, privateKey);
  return {
    ...baseReceipt,
    signature: sig.toString('base64url'),
  };
}

test('Ed25519 valid receipt accepted via node:crypto (PEM, DER, raw 32B, JWK)', async () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const receipt = makeSignedReceipt(privateKey, {
    status: 'verified',
    checksPassed: 12,
    latencyMs: 0.68,
    nested: { b: 2, a: 1 },
  });

  const pem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const der = new Uint8Array(publicKey.export({ type: 'spki', format: 'der' }));
  const raw32 = der.slice(der.byteLength - 32);
  const jwk = publicKey.export({ format: 'jwk' });

  for (const keyMaterial of [pem, der, raw32, jwk, publicKey]) {
    const res = await verifyReceiptSignature(receipt, keyMaterial, { mode: 'node' });
    assert.equal(res.valid, true);
    assert.equal(res.engine, 'node:crypto');
    assert.match(res.digestSha256 ?? '', /^[0-9a-f]{64}$/);
  }
});

test('Ed25519 valid receipt accepted via Web Crypto SubtleCrypto (PEM, raw 32B, JWK)', async () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const receipt = makeSignedReceipt(privateKey, {
    status: 'verified',
    checksPassed: 7,
    digest: 'sha256:abcdef0123456789',
  });

  const pem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const der = new Uint8Array(publicKey.export({ type: 'spki', format: 'der' }));
  const raw32 = der.slice(der.byteLength - 32);
  const jwk = publicKey.export({ format: 'jwk' });

  for (const keyMaterial of [pem, raw32, jwk]) {
    const res = await verifyReceiptSignature(receipt, keyMaterial, { mode: 'webcrypto' });
    assert.equal(res.valid, true);
    assert.equal(res.engine, 'webcrypto');
    assert.match(res.digestSha256 ?? '', /^[0-9a-f]{64}$/);
  }
});

test('Canonicalization invariance: reordered payload keys still verify', async () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const receipt = makeSignedReceipt(privateKey, { z: 3, a: { second: 'y', first: 'x' } });
  const reordered = {
    ...receipt,
    payload: { a: { first: 'x', second: 'y' }, z: 3 },
  };
  const pem = publicKey.export({ type: 'spki', format: 'pem' }).toString();

  assert.equal(
    canonicalizeReceiptPayload(receipt.payload),
    canonicalizeReceiptPayload(reordered.payload),
  );
  const res = await verifyReceiptSignature(reordered, pem);
  assert.equal(res.valid, true);
});

test('Tampered payload is rejected in both node:crypto and webcrypto', async () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const receipt = makeSignedReceipt(privateKey, {
    status: 'verified',
    checksPassed: 12,
  });
  const tampered = {
    ...receipt,
    payload: {
      status: 'verified',
      checksPassed: 13,
    },
  };
  const pem = publicKey.export({ type: 'spki', format: 'pem' }).toString();

  const resNode = await verifyReceiptSignature(tampered, pem, { mode: 'node' });
  const resWeb = await verifyReceiptSignature(tampered, pem, { mode: 'webcrypto' });
  assert.equal(resNode.valid, false);
  assert.equal(resWeb.valid, false);
});

test('Tampered metadata, tampered signature, and wrong public key are all rejected', async () => {
  const keyA = crypto.generateKeyPairSync('ed25519');
  const keyB = crypto.generateKeyPairSync('ed25519');
  const receipt = makeSignedReceipt(keyA.privateKey, { status: 'verified' });
  const pemA = keyA.publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const pemB = keyB.publicKey.export({ type: 'spki', format: 'pem' }).toString();

  // Tampered metadata field
  const tamperedMeta = { ...receipt, issuedAt: '2026-11-19T03:00:01Z' };
  assert.equal((await verifyReceiptSignature(tamperedMeta, pemA)).valid, false);

  // Tampered signature byte
  const sigBuf = Buffer.from(receipt.signature, 'base64url');
  sigBuf[0] ^= 0xff;
  const tamperedSig = { ...receipt, signature: sigBuf.toString('base64url') };
  assert.equal((await verifyReceiptSignature(tamperedSig, pemA)).valid, false);

  // Wrong public key
  assert.equal((await verifyReceiptSignature(receipt, pemB)).valid, false);

  // Wrong algorithm label
  const wrongAlg = { ...receipt, algorithm: 'RSA-PSS' };
  assert.equal((await verifyReceiptSignature(wrongAlg, pemA)).valid, false);
});

test('HTTP client skeleton formats requests and surfaces GyeolApiError cleanly (mocked fetch)', async () => {
  const calls = [];
  const mockFetch = async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith('/v1/audit')) {
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json', 'x-request-id': 'req_123' }),
        json: async () => ({ ok: true, receiptId: 'rcpt_mock_1' }),
      };
    }
    return {
      ok: false,
      status: 401,
      headers: new Headers({ 'content-type': 'application/json', 'x-request-id': 'req_401' }),
      json: async () => ({ code: 'UNAUTHORIZED', message: 'Invalid API key' }),
    };
  };

  const client = createApiClient({
    apiKey: 'gyeol_test_token',
    fetch: mockFetch,
  });
  assert.equal(client.baseUrl, DEFAULT_API_BASE_URL);

  const okResp = await client.audit({ input: 'opaque-structured-payload' });
  assert.deepEqual(okResp, { ok: true, receiptId: 'rcpt_mock_1' });
  assert.equal(calls[0].url, 'https://api.gyeol.link/v1/audit');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer gyeol_test_token');
  assert.equal(calls[0].init.headers['Content-Type'], 'application/json');

  await assert.rejects(
    () => client.health(),
    (err) => {
      assert.ok(err instanceof GyeolApiError);
      assert.equal(err.status, 401);
      assert.equal(err.code, 'UNAUTHORIZED');
      assert.equal(err.requestId, 'req_401');
      return true;
    },
  );
});
