// E13 mock writer and reader (30-hop v2 schema with chained amendments and nested derived D1..D4).
// Used both by `--selftest` (across all 4 formats + fault injections) and `run-e13.mjs --mock`.
import { inForce, derivedAt, mulberry32 } from './lib-e12.mjs';

function rawInputKeys(scen, hop, inputs) {
  const out = [];
  for (const k of inputs) {
    if (/^D\d$/.test(k)) {
      const d = scen.derived.find((x) => x.key === k);
      const v = d.versions.filter((x) => x.hop <= hop).at(-1);
      if (v) out.push(...rawInputKeys(scen, hop, v.inputs));
    } else {
      out.push(k);
    }
  }
  return out;
}

function buildEntries(scen, hop, o = {}) {
  const drop = new Set(o.drop ?? []);
  const liveKeys = new Set(inForce(scen, hop).map((p) => p.key));
  const latestDer = Object.fromEntries(derivedAt(scen, hop).map((d) => [d.key, d.current.v]));
  const byKey = Object.fromEntries(scen.payloads.map((p) => [p.key, p]));
  const numOf = {};
  const derNum = {};
  const entries = [];
  let seq = 0;

  for (let h = 1; h <= hop; h++) {
    for (const p of scen.payloads.filter((x) => x.hop === h && !drop.has(x.key))) {
      if (o.destructive && !liveKeys.has(p.key)) continue;
      if (o.dropClauseN != null && seq + 1 === o.dropClauseN) { seq += 1; continue; }
      const oldKey = p.supersedes ?? p.withdraws;
      const linkKind = p.supersedes ? 'amend' : p.withdraws ? 'withdraw' : null;
      const linkTarget = !o.unlinkLineage && oldKey && numOf[oldKey] ? numOf[oldKey] : null;
      const n = o.destructive ? ++seq : (o.skipNumAt === seq + 1 ? (seq += 2) : ++seq);
      numOf[p.key] = n;
      entries.push({ kind: 'raw', n, h, p, linkKind, linkTarget });
    }
    for (const d of scen.derived) {
      for (const v of d.versions.filter((x) => x.hop === h)) {
        if (o.destructive && v.v !== latestDer[d.key]) continue;
        const inputNs = v.inputs.map((k) => (/^D\d$/.test(k) ? derNum[k] : numOf[k])).filter((x) => x != null);
        const rKeys = rawInputKeys(scen, h, v.inputs);
        if (inputNs.length < v.inputs.length || rKeys.some((k) => drop.has(k))) continue;
        const n = ++seq;
        const prevDerN = !o.unlinkLineage && derNum[d.key] ? derNum[d.key] : null;
        derNum[d.key] = n;
        const inputDocs = [...new Set(rKeys.map((k) => byKey[k]?.doc).filter(Boolean))];
        entries.push({ kind: 'der', n, h, d, val: v.value, linkTarget: prevDerN, inputNs, inputDocs });
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
        let qv = `${e.p.label}: ${e.p.value}`;
        if (o.tamperQuoteDoc === e.p.doc) qv = `${e.p.label}: TAMPERED_VALUE_999999`;
        return {
          n: e.n, claim: `${e.p.label} is given in ${e.p.doc}`, evidence: e.h === hop ? 'see' : 'rec',
          revises: e.linkKind === 'amend' ? e.linkTarget : null,
          retracts: e.linkKind === 'withdraw' ? e.linkTarget : null,
          grounds: [e.p.doc], quotes: { [e.p.doc]: qv },
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

  // lon: snapshot v0.8 header + sequential clauses + standalone external relays (<[[ ... ]]> when text has `]>`).
  const fence = (t) => (!o.shallowFence && t.includes(']>') ? `<[[${t}]]>` : `<[${t}]>`);
  const lines = [];
  if (!o.omitHeader) lines.push('lon 0.8 · snapshot · lang en');
  entries.forEach((e, idx) => {
    const conf = typeof o.confFn === 'function' ? o.confFn(e, idx) : 8;
    const col = o.colors?.[idx % o.colors.length] ?? 'G';
    if (e.kind === 'raw') {
      const pfx = e.linkTarget ? (e.linkKind === 'amend' ? `fix→${e.linkTarget}` : `err→${e.linkTarget}`) : '';
      const ev = e.h === hop ? 'see' : 'rec';
      const brk = o.bracketPrefix && pfx ? `[${ev},${pfx},say]` : `[${ev},say]`;
      const head = !o.bracketPrefix && pfx ? `${pfx} ` : '';
      lines.push(`lon: <${e.n} · ${head}${brk} ${e.p.label} *${col}${conf}↓${e.p.doc}>`);
    } else {
      const pfx = e.linkTarget ? `fix→${e.linkTarget}` : '';
      const brk = o.bracketPrefix && pfx ? `[inf,${pfx},say]` : `[inf,say]`;
      const head = !o.bracketPrefix && pfx ? `${pfx} ` : '';
      lines.push(`lon: <${e.n} · ${head}${brk} ${e.d.label} ${e.val} ${e.d.unit} *${col}${conf}${e.inputNs.map((x) => `↓${x}`).join('')}>`);
    }
  });
  for (let h = 1; h <= hop; h++) {
    const doc = scen.docs[h - 1];
    const kept = scen.payloads.filter((p) => p.hop === h && entries.some((e) => e.kind === 'raw' && e.p.key === p.key));
    if (!kept.length) continue;
    const allInDoc = scen.payloads.filter((p) => p.hop === h);
    let body = kept.length === allInDoc.length ? doc.body : kept.map((p) => `${p.label}: ${p.value}`).join('\n');
    if (o.tamperRelayDoc === doc.id) body = `${body}\nFORGED_RELAY_LINE: 999999`;
    lines.push(`${doc.id} ${fence(body)}`);
  }
  return lines.join('\n');
}

export function mockNote(format, scen, hop, salt, model = '') {
  const r = mulberry32(salt);
  if (r() < 0.03) return '';
  const live = inForce(scen, hop);
  const dropRate = model.endsWith('_on') ? 0.02 : 0.08;
  const drop = live.filter(() => r() < dropRate).map((p) => p.key);
  const isBrokenJson = format === 'jsonchain' && !model.endsWith('_on') && r() < 0.15;
  const bracketPrefix = format === 'lon' && model === 'deepseek_off' && hop > 20 && r() < 0.1;
  return idealNote(format, scen, hop, {
    drop,
    rawBackslash: isBrokenJson,
    bracketPrefix,
    confFn: (e) => (drop.length && r() < 0.3 ? 6 : model.endsWith('_on') ? 8 : 7),
  });
}

export function mockReader(scen, salt) {
  const r = mulberry32(salt);
  return scen.questions.map((q) => `Q${q.q}: ${r() < 0.08 ? 'MISSING' : q.answer.replace(/\n/g, ' ')}`).join('\n');
}
