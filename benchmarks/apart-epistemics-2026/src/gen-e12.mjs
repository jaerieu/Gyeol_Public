// E12 scenario generator v2: 30-hop long session, harder lineage (seeded, no model calls).
//   node src/gen-e12.mjs --seed 20261116 --n 10 --prefix L --out data/sessions-e12.json
// Prompts are the E10 prompts unchanged (src/prompts-e10.mjs); only the documents and questions are harder.
// v1 (src/gen-e12-v1.mjs, data/sessions-e12-v1.json) put DeepSeek with reasoning at the ceiling (L 1.000 on 2 pilot
// scenarios), so v2 roughly doubles the lineage load and adds two new ways of pointing at an earlier entry.
//
// Difficulty levers (v1 levers kept, v2 changes marked):
//   1. Revision chains: site-1 figure has six values (v2; v1 four), site-1 base figure of family B four values (v2),
//      both rule figures three values (v2; v1 two).
//   2. Confusable twins on both families (v2; v1 family A only): the same figure name for two sites, each revised
//      several times (site-2 A figure four values, site-2 B figure three values).
//   3. Four reference styles (v2; v1 two): by document id, by label ("the current X"), by document header
//      ("given in the Planning notice, north plant"), and by the old value ("the X that read 4200 units/h").
//      Headers are unique within a scenario, so every reference resolves to one entry.
//   4. Reference to an intermediate: revisions cite the latest value, never the first, so the chain must be kept.
//   5. Nested derived values on both families (v2): D2 = D1 + site-2 A figure, D4 = D3 + site-2 B figure. Every
//      recomputation of D1 or D3 must also recompute D2 or D4. Recomputation is never prompted (policy rule 5 only).
//   6. Revise then withdraw (v2): a free id is revised, and later the revision itself is withdrawn by its value.
//   7. Verbatim revisions: a quote and a path are revised, so earlier exact strings must survive as history.
//   8. Volume and density: 58 raw payloads and 53 lineage events (20 amend, 4 withdraw, 29 recompute; v1: 46 and 25); hops 26 to 29 carry two
//      events each, where v1 notes in lon already broke.
import { writeFileSync } from 'node:fs';
import { mulberry32, inForce, derivedAt, lineageEventsAt, chainOf, HOPS } from './lib-e12.mjs';

const argv = process.argv.slice(2);
const opt = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };
const SEED = Number(opt('--seed', 20261116));
const N = Number(opt('--n', 10));
const PREFIX = opt('--prefix', 'L');
const OUT = opt('--out', 'data/sessions-e12.json');

const FAM_A = [
  { base: 'Rated line capacity', unit: 'units/h', rule: 'Derate factor', derived: 'Derated line capacity', total: 'Two-line working capacity' },
  { base: 'Nominal pump flow', unit: 'L/min', rule: 'Throttle setting', derived: 'Throttled pump flow', total: 'Two-pump working flow' },
  { base: 'Contract batch size', unit: 'kg', rule: 'Yield target', derived: 'Target batch yield', total: 'Two-reactor batch output' },
  { base: 'Licensed storage volume', unit: 'm3', rule: 'Fill limit', derived: 'Permitted fill volume', total: 'Two-tank working volume' },
  { base: 'Feeder design load', unit: 'kW', rule: 'Load ceiling', derived: 'Allowed feeder load', total: 'Two-feeder working load' },
];
const FAM_B = [
  { base: 'Daily inspection quota', unit: 'samples', rule: 'Holdback allowance', derived: 'Net inspection quota', total: 'Two-desk inspection quota' },
  { base: 'Shift energy budget', unit: 'kWh', rule: 'Reserve margin', derived: 'Usable shift energy', total: 'Two-shift usable energy' },
  { base: 'Truck slot allocation', unit: 'slots', rule: 'Maintenance holdback', derived: 'Open truck slots', total: 'Two-gate open slots' },
  { base: 'Coolant stock', unit: 'L', rule: 'Safety reserve', derived: 'Usable coolant stock', total: 'Two-store usable coolant' },
  { base: 'Weekly overtime pool', unit: 'hours', rule: 'Training set-aside', derived: 'Assignable overtime', total: 'Two-crew assignable overtime' },
];
const HEADERS = [
  'Maintenance bulletin', 'Shift log extract', 'Planning notice', 'Quality desk memo', 'Stores advice note', 'Control room bulletin',
  'Logistics desk notice', 'Engineering change memo', 'Safety office circular', 'Production office notice', 'Laboratory release note',
  'Dispatch desk advice', 'Utilities desk note', 'Permit office notice', 'Inventory desk memo',
];
const SITES = ['north', 'south', 'east', 'west', 'river', 'quay'];
const WORDS = ['amber', 'spare', 'legacy', 'bypass', 'standby', 'night', 'relief', 'harbour'];

function scenario(index, seed) {
  const r = mulberry32(seed);
  const int = (a, b) => a + Math.floor(r() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const L = () => 'ABCDEFGHJKLMNPQRTUVWXY'[Math.floor(r() * 22)];
  const D = (n) => Array.from({ length: n }, () => int(0, 9)).join('');
  const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const takeDistinct = (arr, n) => shuffle(arr).slice(0, n);
  const distinctSeq = (n, make, gap) => { const out = []; let guard = 0; while (out.length < n) { const v = make(); if (out.every((x) => Math.abs(x - v) >= gap)) out.push(v); if (++guard > 1000) return null; } return out; };

  const A = pick(FAM_A), B = pick(FAM_B);
  const [s1, s2] = takeDistinct(SITES, 2);
  const X1L = `${A.base}, ${s1} unit`, X2L = `${A.base}, ${s2} unit`;
  const Y1L = `${B.base}, ${s1} unit`, Y2L = `${B.base}, ${s2} unit`;
  const xs = distinctSeq(10, () => int(60, 490) * 20, 200);
  const pcts = takeDistinct([35, 45, 55, 65, 70, 85, 90, 95], 3);
  const ys = distinctSeq(7, () => int(800, 6000), 50);
  const q = distinctSeq(3, () => int(20, 280), 10);
  if (!xs || !ys || !q) return null;
  const x1 = xs.slice(0, 6), x2 = xs.slice(6, 10), y1 = ys.slice(0, 4), y2 = ys.slice(4, 7);

  const PROV_FORMS = [
    ['Provisional permit', () => `PVM-${D(4)}-${L()}${L()}`],
    ['Standby ticket', () => `STB-${D(4)}-${L()}${L()}`],
    ['Temporary clearance', () => `TCL/${D(4)}/${L()}${L()}`],
    ['Interim waiver', () => `IWV ${D(3)}-${L()}${D(2)}`],
  ];
  const [prov1, prov2] = takeDistinct(PROV_FORMS, 2);

  const gens = {
    id: () => [
      ['Work order', () => `WO-${D(4)}-${L()}${L()}`], ['Lot code', () => `LOT ${D(2)}${L()}-${D(4)}`],
      ['Permit number', () => `PRM/${D(4)}/${L()}${L()}`], ['Asset tag', () => `AT-${L()}${D(3)}-${D(2)}`],
      ['Batch ticket', () => `BT ${L()}${L()}${D(5)}`], ['Calibration certificate', () => `CAL-${D(3)}/${L()}${D(2)}`],
      ['Seal number', () => `SL ${D(6)}`], ['Route code', () => `RT-${L()}${L()}-${D(3)}`],
    ],
    quote: () => [
      ['Operator remark', () => `hold at "${pick(WORDS)}" until QA signs off`],
      ['Alarm caption', () => `display reads "E-${D(2)} low flow" after restart`],
      ['Signage wording', () => `tank marked "DO NOT FILL" on the ${pick(SITES)} side`],
      ['Supervisor note', () => `valve tagged "${pick(WORDS)}" is the live one`],
      ['Panel label', () => `crew calls it "the ${pick(WORDS)} line", not line ${L()}`],
      ['Radio call sign', () => `answer to "${pick(WORDS)} ${D(1)}" on channel ${D(2)}`],
    ],
    path: () => [
      ['Config file', () => `C:\\plant\\${pick(SITES)}\\tmp\\r${D(1)}_v${D(1)}.ini`],
      ['Report share', () => `\\\\srv${D(2)}\\share\\new\\table${D(1)}.csv`],
      ['Backup target', () => `D:\\backup\\${pick(SITES)}\\reports\\final_${L()}.xlsx`],
      ['Log folder', () => `E:\\logs\\night\\run${D(2)}\\trace.bin`],
      ['Recipe file', () => `\\\\nas${D(1)}\\recipes\\batch\\blend_${L()}${D(1)}.rcp`],
      ['Export folder', () => `F:\\export\\${pick(SITES)}\\u${D(2)}\\raw.dat`],
    ],
    jsonish: () => [
      ['Controller preset', () => `{"mode":"derate","step":${D(1)},"until":"0${D(1)}:${pick(['00', '15', '30', '45'])}"}`],
      ['Scheduler rule', () => `{"job":"flush","every":"${D(1)}h","skip":["sat","sun"]}`],
      ['Alarm profile', () => `{"level":"${pick(WORDS)}","latch":true,"ack":"${L()}${L()}"}`],
      ['Interlock map', () => `{"trip":["P${D(1)}","V${D(1)}"],"reset":"manual"}`],
    ],
    multi: () => [
      ['Placard text (2 lines)', () => `CAUTION HOT SURFACE\nKEEP CLEAR OF BAY ${L()}`],
      ['Delivery address (2 lines)', () => `Gate ${L()}, Kestrel Yard\nNorth Quay, Berth ${D(1)}`],
      ['Shipping mark (2 lines)', () => `FRAGILE THIS SIDE UP\nSTACK LIMIT ${D(1)} HIGH`],
      ['Hold tag (2 lines)', () => `QA HOLD ${D(2)}\nDO NOT RELEASE`],
    ],
    lonA: () => [
      ['Filter expression', () => `tags[${D(1)}]>=${D(2)} and zone[${D(1)}]>${D(1)}`],
      ['Query clause', () => `load[${D(1)}]>limit[${D(1)}]>floor`],
    ],
    lonB: () => [
      ['Tag template', () => `<[SITE]> <[LOT]> ${L()}${L()}`],
      ['Alarm mask', () => `mask <[${L()}${D(1)}]> active`],
    ],
  };
  const HAZ = { id: 'plain', quote: 'json', path: 'json', jsonish: 'json', multi: 'json', lonA: 'lon', lonB: 'lon' };
  const CLS = { lonA: 'lonhostile', lonB: 'lonhostile' };
  const makers = {};
  const free = [];
  for (const [cls, n] of [['id', 6], ['quote', 5], ['path', 5], ['jsonish', 3], ['multi', 3], ['lonA', 2], ['lonB', 2]]) {
    for (const [label, make] of takeDistinct(gens[cls](), n)) { makers[label] = make; free.push({ role: 'free', label, value: make(), cls: CLS[cls] ?? cls, hazard: HAZ[cls] }); }
  }

  // Structural schedule. Hops 26 to 29 carry two events each.
  const H = {
    x1_0: 1, prov1: 1, y1_0: 2, p_0: 3, q_0: 4, x2_0: 5, y2_0: 6,
    x1_1: 7, prov2: 8, x2_1: 9, y1_1: 10, cnl1: 11, p_1: 12, x1_2: 13, q_1: 14, idRev: 15, y2_1: 16, x1_3: 17,
    x2_2: 18, y1_2: 19, quoteRev: 20, x1_4: 21, p_2: 22, freeW: 23, y2_2: 24, idW: 25,
    x2_3: 26, q_2: 26, cnl2: 27, y1_3: 27, x1_5: 28, pathRev: 29,
  };
  const noFree = new Set([1, 26, 27, 28]);
  const freeHops = []; for (let h = 2; h <= HOPS; h++) if (!noFree.has(h)) freeHops.push(h);
  if (freeHops.length !== free.length) throw new Error(`gen-e12: ${freeHops.length} free hops for ${free.length} free payloads`);
  const freeQ = shuffle(free);
  freeQ.forEach((p, i) => { p.hop = freeHops[i]; });
  const pickTarget = (cls, before) => { const c = freeQ.filter((p) => p.cls === cls && p.hop < before - 6); return c.length ? pick(c) : null; };
  const quoteT = pickTarget('quote', H.quoteRev), pathT = pickTarget('path', H.pathRev), jsonT = pickTarget('jsonish', H.freeW), idT = pickTarget('id', H.idRev);
  if (!quoteT || !pathT || !jsonT || !idT) return null;

  const fig = (role, label, n, unit, hop, extra = {}) => ({ role, label, value: `${n} ${unit}`, num: n, cls: 'figure', hazard: 'plain', hop, ...extra });
  const idp = (role, label, value, hop, extra = {}) => ({ role, label, value, cls: 'id', hazard: 'plain', hop, ...extra });
  const chainA = (pre, label, vals, unit, refs) => vals.map((v, i) => fig(`${pre}_${i}`, label, v, unit, H[`${pre}_${i}`], i ? { revOf: `${pre}_${i - 1}`, refBy: refs[i - 1] } : {}));
  const struct = [
    ...chainA('x1', X1L, x1, A.unit, ['doc', 'label', 'header', 'value', 'doc']),
    ...chainA('x2', X2L, x2, A.unit, ['label', 'value', 'header']),
    ...chainA('y1', Y1L, y1, B.unit, ['label', 'doc', 'header']),
    ...chainA('y2', Y2L, y2, B.unit, ['value', 'label']),
    ...chainA('p', A.rule, pcts, 'percent', ['doc', 'label']),
    ...chainA('q', B.rule, q, B.unit, ['header', 'value']),
    idp('prov1', prov1[0], prov1[1](), H.prov1),
    idp('prov2', prov2[0], prov2[1](), H.prov2),
    idp('cnl1', 'Cancellation code', `CNL-${D(4)}-${L()}${L()}`, H.cnl1, { wdOf: 'prov1', refBy: 'doc' }),
    { role: 'idRev', label: idT.label, value: makers[idT.label](), cls: 'id', hazard: 'plain', hop: H.idRev, revOf: idT, refBy: 'label' },
    { role: 'quoteRev', label: quoteT.label, value: makers[quoteT.label](), cls: 'quote', hazard: 'json', hop: H.quoteRev, revOf: quoteT, refBy: 'label' },
    idp('freeW', 'Withdrawal notice', `WDN-${D(4)}-${L()}${L()}`, H.freeW, { wdOf: jsonT, refBy: 'header' }),
    idp('idW', 'Void notice', `VDN-${D(4)}-${L()}${L()}`, H.idW, { wdOf: 'idRev', refBy: 'value' }),
    idp('cnl2', 'Retraction slip', `RTS-${D(4)}-${L()}${L()}`, H.cnl2, { wdOf: 'prov2', refBy: 'label' }),
    { role: 'pathRev', label: pathT.label, value: makers[pathT.label](), cls: 'path', hazard: 'json', hop: H.pathRev, revOf: pathT, refBy: 'header' },
  ];
  const byRole = Object.fromEntries(struct.map((p) => [p.role, p]));
  if (byRole.quoteRev.value === quoteT.value || byRole.pathRev.value === pathT.value || byRole.idRev.value === idT.value) return null;

  const ids = []; while (ids.length < HOPS) { const id = `evd${int(101, 989)}`; if (!ids.includes(id)) ids.push(id); }
  // Unique headers (a header reference must resolve to one document).
  const headers = shuffle(HEADERS.flatMap((h) => SITES.map((s) => `${h}, ${s} plant`))).slice(0, HOPS);

  // Assemble documents; give keys in introduction order.
  const all = [...struct, ...freeQ];
  const target = (t) => (typeof t === 'string' ? byRole[t] : t);
  const payloads = [], docs = [];
  let k = 0;
  for (let hop = 1; hop <= HOPS; hop++) {
    const here = shuffle(all.filter((p) => p.hop === hop));
    for (const p of here) { p.key = `p${String(++k).padStart(2, '0')}`; p.doc = ids[hop - 1]; }
    payloads.push(...here);
  }
  for (const p of struct) {
    if (p.revOf) p.supersedes = target(p.revOf).key;
    if (p.wdOf) p.withdraws = target(p.wdOf).key;
  }
  const instr = {
    p_0: `Instruction: state the ${A.derived}, which is the ${A.rule} applied as a percentage to the ${X1L}. Name the entries it was computed from.`,
    x2_0: `Instruction: state the ${A.total}, which is the ${A.derived} plus the ${X2L}. Name the entries it was computed from.`,
    q_0: `Instruction: state the ${B.derived}, which is the ${Y1L} minus the ${B.rule}. Name the entries it was computed from.`,
    y2_0: `Instruction: state the ${B.total}, which is the ${B.derived} plus the ${Y2L}. Name the entries it was computed from.`,
  };
  const where = (t, by) => (by === 'doc' ? `the ${t.label} given in ${t.doc}` : by === 'header' ? `the ${t.label} given in the ${headers[t.hop - 1]}`
    : by === 'value' ? `the ${t.label} that read ${t.value}` : null);
  const noteFor = (p) => {
    if (instr[p.role]) return instr[p.role];
    if (p.revOf) {
      const t = target(p.revOf);
      return p.refBy === 'label' ? `Note: this revises the current ${t.label} to the new value above.` : `Note: this revises ${where(t, p.refBy)} to the new value above.`;
    }
    if (p.wdOf) {
      const t = target(p.wdOf);
      return p.refBy === 'label' ? `Note: this withdraws the ${t.label} currently on record. That item is cancelled and no longer in force.`
        : `Note: this withdraws ${where(t, p.refBy)}. That item is cancelled and no longer in force.`;
    }
    return null;
  };
  for (let hop = 1; hop <= HOPS; hop++) {
    const lines = [];
    for (const p of payloads.filter((x) => x.hop === hop)) {
      lines.push(`${p.label}: ${p.value}`);
      const n = noteFor(p); if (n) lines.push(n);
    }
    docs.push({ hop, id: ids[hop - 1], header: headers[hop - 1], body: lines.join('\n') });
  }
  for (const p of payloads) { delete p.revOf; delete p.wdOf; }

  // Derived versions by replay: D1 = X1 x P / 100, D2 = D1 + X2, D3 = Y1 - Q, D4 = D3 + Y2.
  const cur = {}; const derived = [
    { key: 'D1', label: A.derived, unit: A.unit, versions: [] },
    { key: 'D2', label: A.total, unit: A.unit, versions: [] },
    { key: 'D3', label: B.derived, unit: B.unit, versions: [] },
    { key: 'D4', label: B.total, unit: B.unit, versions: [] },
  ];
  const push = (d, hop, value, inputs) => { const v = d.versions[d.versions.length - 1]; if (!v || v.value !== value) d.versions.push({ hop, value, inputs }); };
  for (let hop = 1; hop <= HOPS; hop++) {
    for (const p of payloads.filter((x) => x.hop === hop && x.cls === 'figure')) cur[p.role.split('_')[0]] = p;
    if (cur.p) push(derived[0], hop, (cur.x1.num * cur.p.num) / 100, [cur.x1.key, cur.p.key]);
    if (cur.p && cur.x2) push(derived[1], hop, derived[0].versions.at(-1).value + cur.x2.num, ['D1', cur.x2.key]);
    if (cur.q) push(derived[2], hop, cur.y1.num - cur.q.num, [cur.y1.key, cur.q.key]);
    if (cur.q && cur.y2) push(derived[3], hop, derived[2].versions.at(-1).value + cur.y2.num, ['D3', cur.y2.key]);
  }
  for (const d of derived) d.versions.forEach((v, i) => { v.v = i + 1; });

  // Uniqueness: every figure and derived number is a digit run that appears nowhere else in the scenario.
  const keyNums = [...payloads.filter((p) => p.cls === 'figure').map((p) => p.num), ...derived.flatMap((d) => d.versions.map((v) => v.value))];
  if (new Set(keyNums).size !== keyNums.length || keyNums.some((n) => !Number.isInteger(n) || n < 10)) return null;
  const elsewhere = [...ids, ...headers, ...payloads.filter((p) => p.cls !== 'figure').map((p) => p.value)].join(' ').match(/\d+/g) ?? [];
  if (elsewhere.some((x) => keyNums.includes(Number(x)))) return null;
  const freeLabels = free.map((p) => p.label);
  if (new Set(freeLabels).size !== freeLabels.length || freeLabels.some((l) => [X1L, X2L, Y1L, Y2L, A.rule, B.rule, prov1[0], prov2[0]].includes(l))) return null;

  // Questions for the reader after hop 30.
  const final = inForce({ payloads }, HOPS);
  const dv = Object.fromEntries(derived.map((d) => [d.key, d]));
  const chain = (role) => chainOf({ payloads }, byRole[role].key);
  const val = (d, v) => `${v.value} ${d.unit}`;
  const lin = (key, sub, label, answer, extra = {}) => ({ kind: 'lineage', group: 'lineage', subkind: sub, key, label, answer, ...extra });
  const dq = (key, label, d, v) => lin(key, 'derived', label, val(d, v), { num: v.value });
  const x1c = chain('x1_0'), x2c = chain('x2_0'), y1c = chain('y1_0'), y2c = chain('y2_0'), pc = chain('p_0'), qc = chain('q_0');
  const qs = shuffle([
    ...final.map((p) => ({ kind: 'raw', group: 'current', key: p.key, label: `Current ${p.label} (in force)`, answer: p.value, cls: p.cls, hazard: p.hazard, hop: p.hop, chainLen: chainOf({ payloads }, p.key).length })),
    ...derived.map((d) => ({ kind: 'derived', group: 'current', key: d.key, label: `Current ${d.label} (in force)`, answer: val(d, d.versions.at(-1)), num: d.versions.at(-1).value, versions: d.versions.length })),
    lin('lin_x1_first', 'chain', `${X1L} as first recorded`, x1c[0].value),
    lin('lin_x1_second', 'chain', `${X1L} as recorded after its first revision`, x1c[1].value),
    lin('lin_x1_fourth', 'chain', `${X1L} as recorded after its third revision`, x1c[3].value),
    lin('lin_x1_prev', 'chain', `${X1L} immediately before its most recent revision`, x1c.at(-2).value),
    lin('lin_x2_first', 'twin', `${X2L} as first recorded`, x2c[0].value),
    lin('lin_x2_prev', 'twin', `${X2L} immediately before its most recent revision`, x2c.at(-2).value),
    lin('lin_y1_first', 'chain', `${Y1L} as first recorded`, y1c[0].value),
    lin('lin_y1_prev', 'chain', `${Y1L} immediately before its most recent revision`, y1c.at(-2).value),
    lin('lin_y2_first', 'twin', `${Y2L} as first recorded`, y2c[0].value),
    lin('lin_y2_prev', 'twin', `${Y2L} immediately before its most recent revision`, y2c.at(-2).value),
    lin('lin_p_first', 'raw', `${A.rule} as first recorded`, pc[0].value),
    lin('lin_p_prev', 'raw', `${A.rule} immediately before its most recent revision`, pc.at(-2).value),
    lin('lin_q_first', 'raw', `${B.rule} as first recorded`, qc[0].value),
    lin('lin_q_prev', 'raw', `${B.rule} immediately before its most recent revision`, qc.at(-2).value),
    lin('lin_prov1', 'withdraw', `${prov1[0]} that was later withdrawn`, byRole.prov1.value),
    lin('lin_prov2', 'withdraw', `${prov2[0]} that was later withdrawn`, byRole.prov2.value),
    lin('lin_freeW', 'withdraw', `${jsonT.label} that was later withdrawn`, jsonT.value, { hazard: 'json' }),
    lin('lin_id_first', 'chain', `${idT.label} as first recorded`, idT.value),
    lin('lin_idW', 'withdraw', `${idT.label} as revised, which was later withdrawn`, byRole.idRev.value),
    lin('lin_quote_prev', 'verbatim', `${quoteT.label} before it was revised`, quoteT.value, { hazard: 'json' }),
    lin('lin_path_prev', 'verbatim', `${pathT.label} before it was revised`, pathT.value, { hazard: 'json' }),
    dq('lin_D1_first', `${A.derived} as first stated`, dv.D1, dv.D1.versions[0]),
    dq('lin_D1_prev', `${A.derived} immediately before its most recent recomputation`, dv.D1, dv.D1.versions.at(-2)),
    dq('lin_D2_prev', `${A.total} immediately before its most recent recomputation`, dv.D2, dv.D2.versions.at(-2)),
    dq('lin_D3_first', `${B.derived} as first stated`, dv.D3, dv.D3.versions[0]),
    dq('lin_D4_first', `${B.total} as first stated`, dv.D4, dv.D4.versions[0]),
    dq('lin_D4_prev', `${B.total} immediately before its most recent recomputation`, dv.D4, dv.D4.versions.at(-2)),
    lin('src_x1', 'provenance', `Document id (evdN) that set the current ${X1L}`, x1c.at(-1).doc),
    lin('src_x2', 'provenance', `Document id (evdN) that set the current ${X2L}`, x2c.at(-1).doc),
    lin('src_y1', 'provenance', `Document id (evdN) that set the current ${Y1L}`, y1c.at(-1).doc),
    lin('src_y2', 'provenance', `Document id (evdN) that set the current ${Y2L}`, y2c.at(-1).doc),
  ]).map((qq, i) => ({ q: i + 1, ...qq }));

  return { id: `${PREFIX}${String(index + 1).padStart(2, '0')}`, seed, docs, payloads, derived, questions: qs };
}

// Self-check: the answer keys must follow from the documents by the stated rules.
function check(s) {
  const fails = [];
  const final = inForce(s, HOPS);
  const evs = lineageEventsAt(s, HOPS);
  const ders = derivedAt(s, HOPS);
  for (const d of ders) for (const v of d.versions) if (!Number.isInteger(v.value) || v.value <= 0) fails.push(`${d.key} v${v.v} ${v.value}`);
  for (const q of s.questions.filter((x) => x.kind === 'raw')) if (!final.some((p) => p.key === q.key && p.value === q.answer)) fails.push(`raw ${q.key}`);
  const labels = s.questions.map((x) => x.label);
  if (new Set(labels).size !== labels.length) fails.push('duplicate question label');
  if (new Set(s.docs.map((d) => d.header)).size !== s.docs.length) fails.push('duplicate header');
  for (const doc of s.docs) for (const p of s.payloads.filter((x) => x.hop === doc.hop)) if (!doc.body.includes(`${p.label}: ${p.value}`)) fails.push(`doc ${p.key}`);
  for (const e of evs.filter((x) => x.kind !== 'recompute')) {
    const note = s.docs[e.hop - 1].body.split('\n').find((l) => l.startsWith('Note') && l.includes(e.oldP.label)) ?? '';
    if (!note) { fails.push(`note ${e.id}`); continue; }
    const hasEvd = /\bevd\d+/.test(note);
    if (e.refBy === 'doc' && !note.includes(e.oldP.doc)) fails.push(`ref doc ${e.id}`);
    if (e.refBy !== 'doc' && hasEvd) fails.push(`ref ${e.refBy} names a doc ${e.id}`);
    if (e.refBy === 'header' && !note.includes(s.docs[e.oldP.hop - 1].header)) fails.push(`ref header ${e.id}`);
    if (e.refBy === 'value' && !note.includes(e.oldP.value)) fails.push(`ref value ${e.id}`);
    // The old entry must be the one in force just before this event (references always point at the latest value).
    if (!inForce(s, e.hop - 1).some((p) => p.key === e.oldP.key)) fails.push(`stale target ${e.id}`);
  }
  return { fails, events: evs.length, byKind: evs.reduce((m, e) => ((m[e.kind] = (m[e.kind] ?? 0) + 1), m), {}), inForce: final.length };
}

const scenarios = [];
for (let i = 0; i < N; i++) {
  let s = null, bump = 0;
  while (!s) { s = scenario(i, SEED + i * 1000 + bump); bump += 1; if (bump > 2000) throw new Error('gen-e12: no valid scenario'); }
  const c = check(s);
  if (c.fails.length) throw new Error(`gen-e12 ${s.id}: ${c.fails.join('; ')}`);
  s.stats = { events: c.events, byKind: c.byKind, inForce: c.inForce, payloads: s.payloads.length, derivedVersions: s.derived.reduce((n, d) => n + d.versions.length, 0), questions: s.questions.length };
  scenarios.push(s);
}
writeFileSync(OUT, JSON.stringify({ meta: { experiment: 'E12', version: 2, hops: HOPS, seed: SEED, n: N, prefix: PREFIX }, scenarios }, null, 1) + '\n');
console.log(`${scenarios.length} scenarios -> ${OUT}`);
for (const s of scenarios) console.log(s.id, 'seed', s.seed, JSON.stringify(s.stats));
