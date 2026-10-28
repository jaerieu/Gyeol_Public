import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { documentName, canonDocument, short } from '../src/index.ts';

const root = new URL('..', import.meta.url);

test('기본 사전 v0의 먹 이름은 #8811fa 이다(v0의 정규화와 같은지)', async () => {
  const v0 = readFileSync(new URL('sources/dict-v0.txt', root), 'utf8');
  const name = await documentName(v0);
  assert.equal(short(name), '#8811fa');
  assert.equal(name, '8811fa0f1842c8241e79c65be9ae6b501adfb4395cf66c6d57cfe34f60c7aac5');
});

test('문서 정규화: 줄바꿈, 줄 끝 공백, 끝 빈 줄, NFC', async () => {
  const a = '결\n사전\n';
  const variants = ['결\r\n사전\r\n', '결  \n사전\t\n\n\n', '결\n사전', '결\n사전'.normalize('NFD')];
  for (const v of variants) assert.equal(canonDocument(v), a);
  const ref = await documentName(a);
  for (const v of variants) assert.equal(await documentName(v), ref);
});

// 지난 판 v0.2.1·v0.3은 2026-10-14 v0.3.1 뒤, v0.3.1·v0.3.2는 2026-10-15 v0.3.2·v0.4 뒤, v0.4는 2026-10-15 v0.5 뒤 archive/dict/로 옮겼다(archive/README.md). 먹 이름은 거기서 그대로 본다.
test('기본 사전 v0.2·v0.2.1·v0.3·v0.3.1·v0.3.2·v0.4·v0.5의 먹 이름이 dict/HASHES.md 의 기록과 같다', async () => {
  const record = readFileSync(new URL('dict/HASHES.md', root), 'utf8');
  for (const f of ['dict/base-v0.2.txt', 'archive/dict/base-v0.2.1.txt', 'archive/dict/base-v0.3.txt', 'archive/dict/base-v0.3.1.txt', 'archive/dict/base-v0.3.2.txt', 'archive/dict/base-v0.4.txt', 'archive/dict/base-v0.5.txt', 'archive/dict/base-v0.5.1.txt', 'archive/dict/base-v0.5.2.txt', 'dict/base-v0.5.5.txt']) {
    const name = await documentName(readFileSync(new URL(f, root), 'utf8'));
    assert.ok(record.includes(name), `HASHES.md에 ${f}의 ${name}이 없다. node tools/cli.ts hashes 로 다시 만든다`);
  }
});
