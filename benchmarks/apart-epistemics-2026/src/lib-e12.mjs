// E12 shared helpers (30-hop long session): which payloads, derived versions and lineage events hold at a hop.
// Unlike E10, an item can be revised several times (a chain), and derived values can rest on other derived values.
export const HOPS = 30;
export { norm, idsOf, numRe, countNum, hasNum, mulberry32 } from './lib-e10.mjs';

// Keys inactive (superseded or withdrawn) at or before hop h.
export function inactiveKeysAt(scen, hop) {
  return new Set(scen.payloads.filter((p) => (p.supersedes || p.withdraws) && p.hop <= hop).map((p) => p.supersedes ?? p.withdraws));
}

// Raw payloads in force after hop h.
export function inForce(scen, hop) {
  const gone = inactiveKeysAt(scen, hop);
  return scen.payloads.filter((p) => p.hop <= hop && !gone.has(p.key));
}

// Raw payloads introduced at or before hop h that are no longer in force.
export function inactiveAt(scen, hop) {
  const gone = inactiveKeysAt(scen, hop);
  return scen.payloads.filter((p) => p.hop <= hop && gone.has(p.key));
}

export const allRawAt = (scen, hop) => scen.payloads.filter((p) => p.hop <= hop);

// Chain of one item: the first payload and every revision after it, in order.
export function chainOf(scen, key) {
  const byKey = Object.fromEntries(scen.payloads.map((p) => [p.key, p]));
  let first = byKey[key];
  while (first.supersedes) first = byKey[first.supersedes];
  const out = [first];
  for (;;) {
    const next = scen.payloads.find((p) => p.supersedes === out[out.length - 1].key);
    if (!next) return out;
    out.push(next);
  }
}

// Derived values after hop h: for each derived item, its versions so far (value, hop, input keys) and the current one.
export function derivedAt(scen, hop) {
  return scen.derived
    .map((d) => {
      const versions = d.versions.filter((v) => v.hop <= hop);
      return versions.length ? { key: d.key, label: d.label, unit: d.unit, versions, current: versions[versions.length - 1] } : null;
    })
    .filter(Boolean);
}

// Lineage events introduced at or before hop h:
//   amend (a payload that supersedes another), withdraw (a payload that withdraws another),
//   recompute (every derived version after the first).
export function lineageEventsAt(scen, hop) {
  const byKey = Object.fromEntries(scen.payloads.map((p) => [p.key, p]));
  const events = [];
  for (const p of scen.payloads.filter((x) => x.hop <= hop)) {
    if (p.supersedes) events.push({ id: `A_${p.key}`, kind: 'amend', hop: p.hop, refBy: p.refBy, oldP: byKey[p.supersedes], newP: p });
    if (p.withdraws) events.push({ id: `W_${p.key}`, kind: 'withdraw', hop: p.hop, refBy: p.refBy, oldP: byKey[p.withdraws], newP: p });
  }
  for (const d of derivedAt(scen, hop)) {
    d.versions.slice(1).forEach((v, i) => events.push({ id: `${d.key}_v${i + 2}`, kind: 'recompute', hop: v.hop, der: d.key, oldV: d.versions[i], newV: v }));
  }
  return events.sort((a, b) => a.hop - b.hop);
}
