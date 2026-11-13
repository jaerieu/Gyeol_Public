// 결 v0.8.2 명령줄 도구.
//   node tools/cli.ts check  <파일|-> [--rules08] [--lon|--profile lon|gyeol] [--issued evd103] [--lang xx]  구문 분석하고 오류·경고를 보인다.
//   node tools/cli.ts format <파일|->            정규형 글
//   node tools/cli.ts gloss  <파일|-> [--lang xx]  절마다 표지 풀이(ko·en …)
//   node tools/cli.ts json   <파일|->            틀(JSON)
//   node tools/cli.ts name   <파일|-> [--doc]    먹 이름(메시지, 또는 --doc이면 문서)
//   node tools/cli.ts fold   <파일|-> <점|절|펼침>
//   node tools/cli.ts hashes                    dict/HASHES.md 를 다시 만든다

import { readFileSync, writeFileSync } from 'node:fs';
import { parse, format, foldMessage, documentName, messageName, short, rules08, glossClause } from '../src/index.ts';
import type { FoldLevel, Profile } from '../src/index.ts';

const root = new URL('..', import.meta.url);
const [cmd, file, ...rest] = process.argv.slice(2);
const flags = new Set(rest.filter((a) => a.startsWith('--')));
const flagValue = (name: string) => {
  const i = rest.indexOf(name);
  return i >= 0 && rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[i + 1] : undefined;
};
const arg = rest.find((a) => !a.startsWith('--') && !['--lang', '--profile', '--issued'].includes(rest[rest.indexOf(a) - 1] ?? ''));

function read(f: string | undefined): string {
  if (!f || f === '-') return readFileSync(0, 'utf8');
  return readFileSync(f, 'utf8');
}

async function main() {
  switch (cmd) {
    case 'check': {
      // v0.8.1(3.22절): --issued evd103,evd201 = 호출부가 미리 준 받은 자료 번호(선언 없이 가리켜도 E17을 내지 않는다)
      const issued = (flagValue('--issued') ?? '').split(',').map((x) => x.trim()).filter(Boolean);
      const r = parse(read(file), { v08: true, issued });
      for (const d of r.diagnostics) console.log(`${d.severity} ${d.code}${d.line ? ` (줄 ${d.line})` : ''}: ${d.message}`);
      const lang = flagValue('--lang') ?? null;
      const profRaw = flags.has('--lon') ? 'lon' : flagValue('--profile');
      const profile: Profile | null = profRaw === 'lon' || profRaw === '론' ? 'lon' : profRaw === 'gyeol' || profRaw === '결' ? 'gyeol' : null;
      const written = rules08(r, { lang, profile });
      for (const d of written) console.log(`${d.severity} ${d.code} (절 ${d.line}째, 쓰기 규칙): ${d.message}`);
      const ok = r.ok && !written.some((d) => d.severity === '오류');
      console.log(ok ? `통과 · 절 ${r.message.clauses.length}개 · ${short(await messageName(r.message))}` : '오류 있음');
      process.exitCode = ok ? 0 : 1;
      break;
    }
    case 'format':
      process.stdout.write(format(parse(read(file), { v08: true }).message));
      break;
    case 'gloss': {
      const r = parse(read(file), { v08: true });
      const lang = flagValue('--lang') ?? r.message.lang ?? 'ko';
      r.message.clauses.forEach((c, i) => console.log(`${(c.label ?? `절${i + 1}`).replace(/^[절점]/u, '')}: ${glossClause(c, lang)}`));
      break;
    }
    case 'json':
      console.log(JSON.stringify(parse(read(file), { v08: true }).message, null, 2));
      break;
    case 'name': {
      const text = read(file);
      const name = flags.has('--doc') ? await documentName(text) : await messageName(parse(text, { v08: true }).message);
      console.log(name);
      break;
    }
    case 'fold':
      process.stdout.write(format(foldMessage(parse(read(file), { v08: true }).message, (arg ?? '점') as FoldLevel)));
      break;
    case 'hashes': {
      const files = ['sources/dict-v0.txt', 'archive/dict/base-v0.2.txt', 'archive/dict/base-v0.2.1.txt', 'archive/dict/base-v0.3.txt', 'archive/dict/base-v0.3.1.txt', 'archive/dict/base-v0.3.2.txt', 'archive/dict/base-v0.4.txt', 'archive/dict/base-v0.5.txt', 'archive/dict/base-v0.5.1.txt', 'archive/dict/base-v0.5.2.txt', 'archive/dict/base-v0.5.5.txt', 'archive/dict/base-v0.6.txt', 'archive/dict/base-v0.6.5.txt', 'archive/dict/base-v0.7.txt', 'dict/base-v0.8.txt', 'dict/lon-v0.8.txt', 'archive/dict/examples-v0.2.txt'];
      // v0.8.2(2026-11-13, spec/09-names.md 9.4): 사전 정본은 영어(dict/base-v0.8.txt·dict/lon-v0.8.txt)이고 그 해시가 사전의 먹 이름이다. 번역본은 정체가 아니라 따로 적는다
      const translations = [
        ...['ko', 'zh-Hans', 'zh-Hant', 'ja', 'de', 'fr', 'it', 'es', 'ru'].map((l) => `dict/base-v0.8.${l}.txt`),
        ...['ko', 'zh-Hans', 'zh-Hant', 'ja', 'de', 'fr', 'it', 'es', 'ru'].map((l) => `dict/lon-v0.8.${l}.txt`),
      ];
      const rows: string[] = [];
      for (const f of files) {
        const name = await documentName(readFileSync(new URL(f, root), 'utf8'));
        rows.push(`| \`${f}\` | \`${short(name)}\` | \`${name}\` |`);
      }
      const trRows: string[] = [];
      for (const f of translations) {
        const name = await documentName(readFileSync(new URL(f, root), 'utf8'));
        trRows.push(`| \`${f}\` | \`${short(name)}\` | \`${name}\` |`);
      }
      const md = [
        '# 사전의 먹 이름',
        '',
        '`node tools/cli.ts hashes` 가 만든다. 문서 정규화(spec/02-text.md 2.3절) 뒤 SHA-256이다.',
        '',
        '| 파일 | 짧은 이름 | 전체 |',
        '| --- | --- | --- |',
        ...rows,
        '',
        '## 번역본 (정체가 아니다)',
        '',
        'v0.8.2(2026-11-13, `spec/09-names.md` 9.4)부터 현행 사전 정본은 영어(`dict/base-v0.8.txt` · `dict/lon-v0.8.txt`)이고 위 표의 그 해시가 사전의 먹 이름이다. 번역본은 정본을 한 문장씩 따르되 언어의 정체가 아니다. 참고로만 적는다.',
        '',
        '| 파일 | 짧은 이름 | 전체 |',
        '| --- | --- | --- |',
        ...trRows,
        '',
      ].join('\n');
      writeFileSync(new URL('dict/HASHES.md', root), md);
      console.log(md);
      break;
    }
    default:
      console.log('명령: check [--rules08] [--lon|--profile lon|gyeol] [--issued evd103,evd201] [--lang xx] | format | json | name [--doc] | gloss [--lang xx] | fold <점|절|펼침> | hashes');
      process.exitCode = 2;
  }
}

await main();
