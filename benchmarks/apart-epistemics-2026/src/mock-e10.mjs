// E10 mock writer and reader (no model calls, v2 non-destructive lineage).
// idealNote builds faithful sequential entries across hops 1..hop; supports fault modes for selftest verification:
//   destructive: omits earlier revised/withdrawn raw & computed entries (V=1, L=0)
//   unlinkLineage: retains earlier entries but drops revises/retracts/fix->/err-> pointers (V=1, L=0)
//   shallowFence: forces depth-1 <[ ... ]> fences even when body contains `]>` (breaks whitespace-after-`]>`)
//   rawBackslash: leaves backslashes unescaped in jsonchain (breaks JSON.parse, recovered by salvage)
import { inForce, derivedAt, mulberry32 } from './lib-e10.mjs';

function buildEntries(scen, hop, o = {}) {
  const drop = new Set(o.drop ?? []);
  const liveKeys = new Set(inForce(scen, hop).map((p) => p.key));
  const byKey = Object.fromEntries(scen.payloads.map((p) => [p.key, p]));
  const numOf = {};
  const derNum = {};
  const entries = [];
  let seq = 0;

  for (let h = 1; h <= hop; h++) {
    const hopPayloads = scen.payloads.filter((p) => p.hop === h && !drop.has(p.key));
    for (const p of hopPayloads) {
      if (o.destructive && !liveKeys.has(p.key)) continue;
      const oldKey = p.supersedes ?? p.withdraws;
      const linkKind = p.supersedes ? 'amend' : p.withdraws ? 'withdraw' : null;
      const linkTarget = !o.unlinkLineage && oldKey && numOf[oldKey] ? numOf[oldKey] : null;
      const n = ++seq;
      numOf[p.key] = n;
      entries.push({ kind: 'raw', n, h, p, linkKind, linkTarget });
    }
    for (const d of scen.derived) {
      if (d.fromHop === h && !(o.destructive && hop >= d.revHop)) {
        const baseN = numOf[d.baseKey], ruleN = numOf[d.ruleKey];
        if (!baseN || !ruleN) continue;
        const n = ++seq;
        derNum[`${d.key}_old`] = n;
        entries.push({ kind: 'der', n, h, d, val: d.oldValue, linkTarget: null, inputNs: [baseN, ruleN], inputDocs: [byKey[d.baseKey].doc, byKey[d.ruleKey].doc] });
      }
      if (d.revHop === h) {
        const revN = numOf[d.revKey], ruleN = numOf[d.ruleKey];
        if (!revN || !ruleN) continue;
        const n = ++seq;
        const prevDerN = !o.unlinkLineage && derNum[`${d.key}_old`] ? derNum[`${d.key}_old`] : null;
        derNum[`${d.key}_new`] = n;
        entries.push({ kind: 'der', n, h, d, val: d.newValue, linkTarget: prevDerN, inputNs: [revN, ruleN], inputDocs: [byKey[d.revKey].doc, byKey[d.ruleKey].doc] });
      }
    }
  }
  return entries;
}

export function idealNote(format, scen, hop, o = {}) {
  const entries = buildEntries(scen, hop, o);
  if (format === 'natural') {
    return entries.map((e) => {
      if (e.kind === 'raw') {
        const link = e.linkTarget ? (e.linkKind === 'amend' ? `, revises [${e.linkTarget}]` : `, withdraws [${e.linkTarget}]`) : '';
        return `[${e.n}] ${e.p.doc}: ${e.p.label} is "${e.p.value}"${link}`;
      }
      const rev = e.linkTarget ? `, revises [${e.linkTarget}]` : '';
      return `[${e.n}] ${e.d.label} is "${e.val} ${e.d.unit}", from [${e.inputNs.join('], [')}]${rev}`;
    }).join('\n');
  }
  if (format === 'json') {
    const items = entries.map((e) => {
      if (e.kind === 'raw') {
        return {
          id: e.n, item: e.p.label, value: e.p.value, source: e.p.doc,
          revises: e.linkKind === 'amend' ? e.linkTarget : null,
          retracts: e.linkKind === 'withdraw' ? e.linkTarget : null,
        };
      }
      return {
        id: e.n, item: e.d.label, value: `${e.val} ${e.d.unit}`,
        source: `items ${e.inputNs.join(', ')} (${e.inputDocs.join(', ')})`,
        revises: e.linkTarget ?? null, retracts: null,
      };
    });
    return JSON.stringify({ items });
  }
  if (format === 'jsonchain') {
    const steps = entries.map((e) => {
      if (e.kind === 'raw') {
        return {
          n: e.n, claim: `${e.p.label} is given in ${e.p.doc}`, evidence: e.h === hop ? 'see' : 'rec',
          revises: e.linkKind === 'amend' ? e.linkTarget : null,
          retracts: e.linkKind === 'withdraw' ? e.linkTarget : null,
          grounds: [e.p.doc], quotes: { [e.p.doc]: `${e.p.label}: ${e.p.value}` },
        };
      }
      return {
        n: e.n, claim: `${e.d.label} is ${e.val} ${e.d.unit}`, evidence: 'inf',
        revises: e.linkTarget ?? null, retracts: null,
        grounds: e.inputNs, quotes: {},
      };
    });
    const s = JSON.stringify({ steps });
    return o.rawBackslash ? s.replace(/\\\\/g, '\\') : s;
  }
  // lon: emit valid v0.8.2 clauses + one standalone relay block per doc (deep fence <[[ ... ]]> when text has `]>` unless shallowFence).
  const fence = (t) => (!o.shallowFence && t.includes(']>') ? `<[[${t}]]>` : `<[${t}]>`);
  const clauses = entries.map((e) => {
    if (e.kind === 'raw') {
      const prefix = e.linkTarget ? (e.linkKind === 'amend' ? `fix→${e.linkTarget} ` : `err→${e.linkTarget} `) : '';
      return `lon: <${e.n} · ${prefix}[${e.h === hop ? 'see' : 'rec'},say] ${e.p.label} *G8↓${e.p.doc}>`;
    }
    const prefix = e.linkTarget ? `fix→${e.linkTarget} ` : '';
    return `lon: <${e.n} · ${prefix}[inf,say] ${e.d.label} ${e.val} ${e.d.unit} *G7${e.inputNs.map((x) => `↓${x}`).join('')}>`;
  });
  const docRelays = [];
  for (let h = 1; h <= hop; h++) {
    const doc = scen.docs[h - 1];
    const kept = scen.payloads.filter((p) => p.hop === h && entries.some((e) => e.kind === 'raw' && e.p.key === p.key));
    if (!kept.length) continue;
    const allInDoc = scen.payloads.filter((p) => p.hop === h);
    const body = kept.length === allInDoc.length ? doc.body : kept.map((p) => `${p.label}: ${p.value}`).join('\n');
    docRelays.push(`${doc.id} ${fence(body)}`);
  }
  return [...clauses, ...docRelays].join('\n');
}

export function mockNote(format, scen, hop, salt) {
  const r = mulberry32(salt);
  if (r() < 0.06) return '';
  const live = inForce(scen, hop);
  const drop = live.filter(() => r() < 0.08).map((p) => p.key);
  return idealNote(format, scen, hop, { drop, rawBackslash: format === 'jsonchain' && r() < 0.25 });
}

export function mockReader(scen, salt) {
  const r = mulberry32(salt);
  return scen.questions.map((q) => `Q${q.q}: ${r() < 0.15 ? 'MISSING' : q.answer.replace(/\n/g, ' ')}`).join('\n');
}
