// Post-hoc E13 causal ablation runner (`jsonchain_nogq` on `deepseek_on`, 10 scenarios S01..S10).
// Clones request/retry/cost/telemetry logic from src/run-e13.mjs without modifying locked files.
import { readFileSync, appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { hopPromptNoGQ, readerPromptNoGQ, HOPS } from './ablation-nogq-lib.mjs';
import { costUsd } from './cost.mjs';
import { extractText, usageOf, neuronsOf, finishOf } from '../vendor/gyeol-10fba3d/harness/src/extract.js';

const SETTING = { id: '@cf/deepseek-ai/deepseek-v4.1-flash-1017', costKey: 'deepseek', effort: 'low', max: 24000 };
const EMPTY_RETRIES = 2, ERR_TRIES = 4, ERR_ROWS_CAP = 6, READER = HOPS + 1;

const argv = process.argv.slice(2);
const flag = (f) => argv.includes(f);
const opt = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };

const PROXY = opt('--proxy', 'http://127.0.0.1:8787');
const conc = Number(opt('--concurrency', 5));
const maxUsd = Number(opt('--max-usd', 4.0));
const gapMs = Number(opt('--min-gap-ms', 250));
const maxHop = Math.min(READER, Math.max(1, Number(opt('--max-hop', READER))));
const out = opt('--out', 'results/e13-ablation/e13-deepseek_on-jsonchain_nogq.jsonl');
const file = JSON.parse(readFileSync(opt('--sessions', 'data/sessions-e13.json'), 'utf8'));
const only = opt('--scen', '').split(',').filter(Boolean);
const scens = file.scenarios.filter((s) => !only.length || only.includes(s.id));

mkdirSync(dirname(out), { recursive: true });
const rows = existsSync(out) ? readFileSync(out, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
let spent = rows.reduce((a, r) => a + (r.usd ?? 0), 0), calls = 0, lastStart = 0;

function unwrapResponse(raw) {
  let r = raw;
  for (let i = 0; i < 3 && r && typeof r === 'object' && typeof r.state === 'string' && 'result' in r; i++) {
    if (!/^completed$/i.test(r.state)) throw new Error(`gateway state ${r.state}`);
    r = r.result;
  }
  if (r && typeof r === 'object' && !Array.isArray(r) && r.result && typeof r.result === 'object' && r.response === undefined && !r.choices && !r.output && r.output_text === undefined && !r.content) r = r.result;
  return r;
}

function fitToContext(message, request, margin = 64, floor = 512) {
  const m = String(message ?? '');
  const ctx = Number(m.match(/maximum context length is (\d+)/i)?.[1]);
  const inp = Number(m.match(/contains at least (\d+) input tokens/i)?.[1] ?? m.match(/prompt (?:contains|has) (\d+) tokens/i)?.[1]);
  if (!Number.isFinite(ctx) || !Number.isFinite(inp) || !ctx || !inp) return null;
  const left = ctx - inp - margin;
  if (left < floor || left >= Number(request.max_tokens)) return null;
  return { ...request, max_tokens: left };
}

function stepDownMaxTokens(request) {
  const cur = Number(request.max_tokens ?? 24000);
  const next = cur > 16000 ? 16000 : cur > 12000 ? 12000 : cur > 8192 ? 8192 : null;
  return next ? { ...request, max_tokens: next } : null;
}

function reasoningCharsOf(raw) {
  if (!raw || typeof raw !== 'object') return 0;
  const msg = raw.choices?.[0]?.message;
  if (msg && (msg.reasoning_content || msg.reasoning)) return String(msg.reasoning_content ?? msg.reasoning ?? '').length;
  return 0;
}

function isDeltaOnly(hop, prev, text) {
  if (hop <= 1 || !prev || !text) return false;
  const t = String(text).trim();
  if (!t || t.length >= 0.55 * String(prev).length) return false;
  if (String(prev).split(/\r?\n/).length < 4 && prev.length < 300) return false;
  return !/"n"\s*:\s*1\b/.test(t);
}

function stateOf(sid) {
  const st = { notes: {}, empties: {}, errors: {} };
  for (const r of rows) {
    if (r.sid !== sid) continue;
    if (r.error) st.errors[r.hop] = (st.errors[r.hop] ?? 0) + 1;
    else if (String(r.text ?? '').trim()) st.notes[r.hop] = r.text;
    else st.empties[r.hop] = (st.empties[r.hop] ?? 0) + 1;
  }
  return st;
}

async function callProxy(model, input, affinity) {
  const body = affinity ? { model, input, affinity } : { model, input };
  const res = await fetch(PROXY, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(420000) });
  const j = await res.json().catch(() => ({ error: `bad proxy response ${res.status}` }));
  if (!res.ok || j.error) throw new Error(typeof j.error === 'string' ? j.error : JSON.stringify(j.error ?? `HTTP ${res.status}`));
  return j;
}
const sleep = (ms) => new Promise((s) => setTimeout(s, ms));

async function step(s, hop, attempt, prev) {
  const p = hop === READER ? readerPromptNoGQ(s.scen, prev) : hopPromptNoGQ(s.scen, hop, prev);
  const baseInput = { messages: [{ role: 'user', content: p.text }], max_tokens: SETTING.max, reasoning_effort: SETTING.effort };
  const cacheKey = `apart-e13-deepseek_on-jsonchain_nogq-${hop === READER ? 'r' : 'h'}`;
  const affinity = cacheKey;
  const row = {
    key: `${s.sid}|h${hop}|a${attempt}`, sid: s.sid, scen: s.scen.id, model: 'deepseek_on', format: 'jsonchain_nogq',
    hop, kind: hop === READER ? 'reader' : 'hop', attempt, effort: SETTING.effort, max_tokens: SETTING.max,
    cache: null, prompt_chars: p.text.length, ts: new Date().toISOString(),
  };

  try {
    let r, err, curInput = baseInput;
    for (let t = 0; t < ERR_TRIES && !r; t++) {
      const wait = lastStart + gapMs - Date.now();
      if (wait > 0) await sleep(wait);
      lastStart = Date.now();
      try { r = await callProxy(SETTING.id, curInput, affinity); }
      catch (e) {
        err = e;
        const msg = String(e.message ?? e);
        const fit = fitToContext(msg, curInput);
        if (fit) { curInput = fit; row.fitted = true; continue; }
        if (/max(?:_output)?_tokens/i.test(msg)) {
          const stepped = stepDownMaxTokens(curInput);
          if (stepped) { curInput = stepped; row.fitted = true; await sleep(1000); continue; }
        }
        await sleep(/429|rate|3040|3021|2002|capacity|overload/i.test(msg) ? 60000 : 12000);
      }
    }
    if (!r) throw err;
    const raw = unwrapResponse(r.raw);
    const ms = r.ms;
    const u = usageOf(raw);
    row.text = extractText(raw) ?? '';
    row.finish = finishOf(raw);
    row.usage = u;
    row.neurons = neuronsOf(raw);
    row.usd = costUsd(SETTING.costKey, { tin: u.in ?? 0, tout: u.out ?? 0, cached: u.cached ?? 0, write: u.cache_write ?? 0, neurons: row.neurons });
    row.ms = ms;
    row.reasoning_chars = reasoningCharsOf(raw);
    row.reasoning_tokens = raw?.usage?.output_tokens_details?.reasoning_tokens
      ?? raw?.usage?.output_tokens_details?.thinking_tokens
      ?? raw?.usage?.completion_tokens_details?.reasoning_tokens
      ?? null;
    if (hop <= HOPS) row.delta_only = isDeltaOnly(hop, prev, row.text);
  } catch (e) {
    row.error = String(e?.message ?? e);
  }
  rows.push(row);
  appendFileSync(out, JSON.stringify(row) + '\n');
  spent += row.usd ?? 0;
  calls += 1;
  return row;
}

async function runSession(s) {
  const st = stateOf(s.sid);
  let prev = null;
  for (let hop = 1; hop <= maxHop; hop++) {
    if (st.notes[hop] != null) { if (hop <= HOPS) prev = st.notes[hop]; continue; }
    let attempt = st.empties[hop] ?? 0;
    if ((st.errors[hop] ?? 0) >= ERR_ROWS_CAP) return 'stalled';
    let got = false;
    while (attempt <= EMPTY_RETRIES && !got) {
      if (maxUsd && spent >= maxUsd) return 'budget';
      const row = await step(s, hop, attempt, prev);
      if (row.error) return 'error';
      if (String(row.text).trim()) { got = true; if (hop <= HOPS) prev = row.text; } else attempt += 1;
    }
    if (!got) return hop === READER ? 'done' : 'broken';
  }
  return 'done';
}

const sessions = scens.map((scen) => ({ sid: `${scen.id}|deepseek_on|jsonchain_nogq`, scen, model: 'deepseek_on', format: 'jsonchain_nogq' }));
console.log(`${sessions.length} ablation sessions (maxHop=${maxHop}), ${rows.length} existing rows in ${out}, spent ${spent.toFixed(4)} USD, cap ${maxUsd}`);

const tally = {};
let idx = 0;
async function worker() {
  while (idx < sessions.length) {
    const s = sessions[idx++];
    const res = await runSession(s);
    tally[res] = (tally[res] ?? 0) + 1;
    console.log(`${new Date().toISOString()} ${s.sid} -> ${res}  (calls this run ${calls}, spent ${spent.toFixed(4)} USD)`);
  }
}
await Promise.all(Array.from({ length: Math.max(1, conc) }, worker));
console.log(`finished: ${JSON.stringify(tally)}  calls this run ${calls}  total spent in ${out}: ${spent.toFixed(4)} USD`);
if (flag('--selftest')) console.log('note: run score-e13-ablation-nogq.mjs --selftest for scorer verification');
process.exit(tally.budget ? 3 : tally.error ? 2 : 0);
