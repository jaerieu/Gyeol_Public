// E10 shared helpers: which payloads and lineage events are active/present at a hop, number-token matching, text normalisation.
export const HOPS = 8;
export const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
export const idsOf = (s) => [...new Set([...String(s ?? '').matchAll(/evd\d+/gi)].map((m) => m[0].toLowerCase()))];

// Keys inactive (superseded or withdrawn) at or before hop h.
export function inactiveKeysAt(scen, hop) {
  return new Set(
    scen.payloads
      .filter((p) => (p.supersedes || p.withdraws) && p.hop <= hop)
      .map((p) => p.supersedes ?? p.withdraws),
  );
}

// Raw payloads in force after hop h: introduced at or before h and neither superseded nor withdrawn at or before h.
export function inForce(scen, hop) {
  const gone = inactiveKeysAt(scen, hop);
  return scen.payloads.filter((p) => p.hop <= hop && !gone.has(p.key));
}

// Raw payloads inactive (revised or withdrawn) at or before hop h.
export function inactiveAt(scen, hop) {
  const gone = inactiveKeysAt(scen, hop);
  return scen.payloads.filter((p) => p.hop <= hop && gone.has(p.key));
}

// All raw payloads introduced at or before hop h, in introduction order.
export function allRawAt(scen, hop) {
  return scen.payloads.filter((p) => p.hop <= hop);
}

// Derived values expected after hop h: { key, label, unit, fromHop, revHop, revised, value, stale, baseDoc, oldBaseDoc, ruleDoc, baseKey, oldBaseKey, ruleKey }.
export function derivedAt(scen, hop) {
  const byKey = Object.fromEntries(scen.payloads.map((p) => [p.key, p]));
  const out = [];
  for (const d of scen.derived) {
    if (hop < d.fromHop) continue;
    const revised = hop >= d.revHop;
    const base = byKey[revised ? d.revKey : d.baseKey];
    out.push({
      key: d.key, label: d.label, unit: d.unit, fromHop: d.fromHop, revHop: d.revHop, revised,
      value: revised ? d.newValue : d.oldValue,
      stale: revised ? d.oldValue : null,
      baseDoc: base.doc, oldBaseDoc: byKey[d.baseKey].doc, ruleDoc: byKey[d.ruleKey].doc,
      baseKey: base.key, oldBaseKey: d.baseKey, ruleKey: d.ruleKey,
    });
  }
  return out;
}

// Lineage events introduced at or before hop h:
//   withdraw (W1 at hop 5), amend (R1 at hop 6, R2 at hop 7), derived revision (D1 at hop 6, D2 at hop 7).
export function lineageEventsAt(scen, hop) {
  const byKey = Object.fromEntries(scen.payloads.map((p) => [p.key, p]));
  const events = [];
  const cancelP = scen.payloads.find((p) => p.withdraws && p.hop <= hop);
  if (cancelP) events.push({ id: 'W1', kind: 'withdraw', hop: cancelP.hop, oldP: byKey[cancelP.withdraws], newP: cancelP });
  const amends = scen.payloads.filter((p) => p.supersedes && p.hop <= hop).sort((a, b) => a.hop - b.hop);
  amends.forEach((revP, idx) => {
    events.push({ id: `R${idx + 1}`, kind: 'amend', hop: revP.hop, oldP: byKey[revP.supersedes], newP: revP });
  });
  for (const d of derivedAt(scen, hop)) {
    if (d.revised) events.push({ id: d.key, kind: 'derived', hop: d.revHop, der: d });
  }
  return events;
}

// Number token: 4097 also matches 4,097; never matches inside a longer number or a decimal.
export function numRe(n) {
  const s = String(n);
  const alt = s.length === 4 ? `${s}|${s[0]},${s.slice(1)}` : s;
  return new RegExp(`(?<![\\d.,])(?:${alt})(?![\\d]|[.,]\\d)`, 'g');
}
export const countNum = (text, n) => (String(text ?? '').match(numRe(n)) ?? []).length;
export const hasNum = (text, n) => countNum(text, n) > 0;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
