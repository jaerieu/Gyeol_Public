// E13 runner: 30-hop hand-over chain sessions through the local proxy (worker/, `wrangler dev`).
// Supports DeepSeek v4.1 flash (on/off), Claude Haiku 5.5 (Anthropic adaptive/disabled thinking), GPT-6 Luna (Responses API).
// Strictly non-interventional telemetry (records `delta_only` without altering outputs).
// Exit code: 0 all settled, 2 some sessions stopped on errors (relaunch), 3 stopped by --max-usd.
import { readFileSync, appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { hopPrompt, readerPrompt, FORMATS } from './prompts-e13.mjs';
import { costUsd, NEURON_USD } from './cost.mjs';
import { withCache } from './cache.mjs';
import { HOPS } from './lib-e12.mjs';
import { mockNote, mockReader } from './mock-e13.mjs';
import { extractText, usageOf, neuronsOf, finishOf } from '../vendor/gyeol-10fba3d/harness/src/extract.js';

export const SETTINGS = {
  deepseek_on: { id: '@cf/deepseek-ai/deepseek-v4.1-flash-1017', costKey: 'deepseek', effort: 'low', max: 24000 },
  deepseek_off: { id: '@cf/deepseek-ai/deepseek-v4.1-flash-1017', costKey: 'deepseek', effort: 'none', max: 24000 },
  haiku_on: { id: 'anthropic/claude-haiku-5.5', costKey: 'haiku', api: 'anthropic', effort: 'low', max: 24000 },
  haiku_off: { id: 'anthropic/claude-haiku-5.5', costKey: 'haiku', api: 'anthropic', effort: 'none', max: 24000 },
  luna_on: { id: 'openai/gpt-6-luna', costKey: 'luna', api: 'responses', effort: 'low', max: 24000 },
  luna_off: { id: 'openai/gpt-6-luna', costKey: 'luna', api: 'responses', effort: 'none', max: 24000 },
};

const EMPTY_RETRIES = 2, ERR_TRIES = 4, ERR_ROWS_CAP = 6, READER = HOPS + 1;
const argv = process.argv.slice(2);
const flag = (f) => argv.includes(f);
const opt = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };

const PROXY = opt('--proxy', 'http://127.0.0.1:8787');
const mock = flag('--mock');
const noCache = flag('--no-cache');
const models = opt('--models', 'deepseek_on,deepseek_off,haiku_on,haiku_off,luna_on,luna_off').split(',').filter(Boolean);
const formats = opt('--formats', FORMATS.join(',')).split(',').filter(Boolean);
const conc = Number(opt('--concurrency', 1));
const maxUsd = Number(opt('--max-usd', 0));
const gapMs = Number(opt('--min-gap-ms', 500));
const maxHop = Math.min(READER, Math.max(1, Number(opt('--max-hop', READER))));
const out = opt('--out', mock ? 'results/dry-e13/mock.jsonl' : 'results/e13/e13.jsonl');
const file = JSON.parse(readFileSync(opt('--sessions', 'data/sessions-e13.json'), 'utf8'));
const only = opt('--scen', '').split(',').filter(Boolean);
const scens = file.scenarios.filter((s) => !only.length || only.includes(s.id));
for (const m of models) if (!SETTINGS[m]) throw new Error(`run-e13: no fixed settings for model ${m}`);

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
  const key = 'max_output_tokens' in request ? 'max_output_tokens' : 'max_tokens';
  const left = ctx - inp - margin;
  if (left < floor || left >= Number(request[key])) return null;
  return { ...request, [key]: left };
}

function stepDownMaxTokens(request) {
  const key = 'max_output_tokens' in request ? 'max_output_tokens' : 'max_tokens';
  const cur = Number(request[key] ?? 24000);
  const next = cur > 16000 ? 16000 : cur > 12000 ? 12000 : cur > 8192 ? 8192 : null;
  return next ? { ...request, [key]: next } : null;
}

function cellUsd(set, { tin = 0, tout = 0, cached = 0, write = 0, neurons = null }) {
  if (set.costKey) return costUsd(set.costKey, { tin, tout, cached, write, neurons });
  const fresh = Math.max(0, tin - cached);
  const [pin, pout] = set.neuronsPerM;
  return (neurons ?? (fresh * pin + cached * pin + tout * pout) / 1e6) * NEURON_USD;
}

function reasoningCharsOf(raw) {
  if (!raw || typeof raw !== 'object') return 0;
  const msg = raw.choices?.[0]?.message;
  if (msg && (msg.reasoning_content || msg.reasoning)) return String(msg.reasoning_content ?? msg.reasoning ?? '').length;
  if (Array.isArray(raw.content)) {
    return raw.content
      .filter((b) => b && (b.type === 'thinking' || b.type === 'redacted_thinking'))
      .reduce((n, b) => n + String(b.thinking ?? b.text ?? b.data ?? '').length, 0);
  }
  if (Array.isArray(raw.output)) {
    return raw.output
      .filter((o) => o && o.type === 'reasoning')
      .reduce((n, o) => n + JSON.stringify(o.summary ?? o.content ?? '').length, 0);
  }
  return 0;
}

function isDeltaOnly(format, hop, prev, text) {
  if (hop <= 1 || !prev || !text) return false;
  const t = String(text).trim();
  if (!t || t.length >= 0.55 * String(prev).length) return false;
  if (String(prev).split(/\r?\n/).length < 4 && prev.length < 300) return false;
  if (format === 'lon') return !/<\s*1\s*·/.test(t);
  if (format === 'json') return !/"id"\s*:\s*1\b/.test(t);
  if (format === 'jsonchain') return !/"n"\s*:\s*1\b/.test(t);
  return !/^\s*(?:[-*•]\s*)?(?:\*\*|__)?\[1\]/m.test(t);
}

function buildBaseInput(set, p) {
  if (set.api === 'responses') {
    return { input: p.text, max_output_tokens: set.max, reasoning: { effort: set.effort } };
  }
  if (set.api === 'anthropic') {
    if (set.effort === 'none' || set.effort === 'off') {
      return { messages: [{ role: 'user', content: p.text }], max_tokens: set.max, thinking: { type: 'disabled' } };
    }
    return {
      messages: [{ role: 'user', content: p.text }],
      max_tokens: set.max,
      thinking: { type: 'adaptive' },
      output_config: { effort: set.effort },
    };
  }
  return {
    messages: [{ role: 'user', content: p.text }],
    max_tokens: set.max,
    ...(set.kwargs ? { chat_template_kwargs: set.kwargs } : { reasoning_effort: set.effort }),
  };
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
  const p = hop === READER ? readerPrompt(s.format, s.scen, prev) : hopPrompt(s.format, s.scen, hop, prev);
  const set = SETTINGS[s.model];
  const baseInput = buildBaseInput(set, p);
  const cacheKey = `apart-e13-${s.model}-${s.format}-${hop === READER ? 'r' : 'h'}`;
  const hinted = (noCache || !set.api) ? { input: baseInput, mode: null } : withCache(set.api, baseInput, p, cacheKey);
  const affinity = set.id.startsWith('@cf/') ? cacheKey : undefined;
  const row = {
    key: `${s.sid}|h${hop}|a${attempt}`, sid: s.sid, scen: s.scen.id, model: s.model, format: s.format,
    hop, kind: hop === READER ? 'reader' : 'hop', attempt, effort: set.effort, max_tokens: set.max,
    cache: hinted.mode, prompt_chars: p.text.length, ts: new Date().toISOString(),
  };

  try {
    let raw, ms = 0;
    if (mock) {
      const salt = [...row.key].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
      const text = hop === READER ? mockReader(s.scen, salt) : mockNote(s.format, s.scen, hop, salt, s.model);
      const thinkOut = set.effort === 'none' || set.effort === 'off' ? 0 : 320;
      if (set.api === 'anthropic') {
        raw = {
          content: [...(thinkOut ? [{ type: 'thinking', thinking: 'reasoning trace '.repeat(12) }] : []), { type: 'text', text }],
          stop_reason: 'end_turn',
          usage: { input_tokens: Math.round(p.text.length / 4), output_tokens: Math.round(text.length / 4) + thinkOut, cache_read_input_tokens: hop > 1 ? Math.round(p.sharedChars / 4) : 0 },
        };
      } else {
        raw = {
          choices: [{ message: { content: text }, finish_reason: 'stop' }],
          usage: { prompt_tokens: Math.round(p.text.length / 4), completion_tokens: Math.round(text.length / 4) + thinkOut, output_tokens_details: { reasoning_tokens: thinkOut } },
        };
      }
    } else {
      let r, err, curInput = hinted.input, cacheDropped = !hinted.mode;
      for (let t = 0; t < ERR_TRIES && !r; t++) {
        const wait = lastStart + gapMs - Date.now();
        if (wait > 0) await sleep(wait);
        lastStart = Date.now();
        try { r = await callProxy(set.id, curInput, affinity); }
        catch (e) {
          err = e;
          const msg = String(e.message ?? e);
          const fit = fitToContext(msg, curInput);
          if (fit) { curInput = fit; row.fitted = true; continue; }
          if (set.api === 'anthropic' && curInput.thinking?.type === 'adaptive' && /adaptive|output_config|thinking/i.test(msg)) {
            const { output_config: _drop, ...rest } = curInput;
            curInput = { ...rest, max_tokens: Math.min(Number(rest.max_tokens ?? 16000), 16000), thinking: { type: 'enabled', budget_tokens: 2048 } };
            row.thinking_fallback = 'enabled_2048';
            await sleep(1000);
            continue;
          }
          if (/max(?:_output)?_tokens/i.test(msg)) {
            const stepped = stepDownMaxTokens(curInput);
            if (stepped) { curInput = stepped; row.fitted = true; await sleep(1000); continue; }
          }
          if (!cacheDropped && /cache|breakpoint|cache_control|prompt_cache|400|7003|invalid/i.test(msg)) {
            curInput = buildBaseInput(set, p);
            cacheDropped = true;
            row.cache = 'rejected';
            await sleep(2000);
            continue;
          }
          await sleep(/429|rate|3040|3021|2002|capacity|overload/i.test(msg) ? 60000 : 12000);
        }
      }
      if (!r) throw err;
      raw = unwrapResponse(r.raw);
      ms = r.ms;
    }
    const u = usageOf(raw);
    row.text = extractText(raw) ?? '';
    row.finish = finishOf(raw);
    row.usage = u;
    row.neurons = neuronsOf(raw);
    row.usd = cellUsd(set, { tin: u.in ?? 0, tout: u.out ?? 0, cached: u.cached ?? 0, write: u.cache_write ?? 0, neurons: row.neurons });
    row.ms = ms;
    row.reasoning_chars = reasoningCharsOf(raw);
    row.reasoning_tokens = raw?.usage?.output_tokens_details?.reasoning_tokens
      ?? raw?.usage?.output_tokens_details?.thinking_tokens
      ?? raw?.usage?.completion_tokens_details?.reasoning_tokens
      ?? null;
    if (hop <= HOPS) row.delta_only = isDeltaOnly(s.format, hop, prev, row.text);
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

const sessions = [];
for (const scen of scens) for (const model of models) for (const format of formats) {
  sessions.push({ sid: `${scen.id}|${model}|${format}`, scen, model, format });
}
console.log(`${mock ? 'MOCK ' : ''}${sessions.length} sessions (${scens.length} scenarios x ${models.join(',')} x ${formats.join(',')}, maxHop=${maxHop}), ${rows.length} rows in ${out}, spent ${spent.toFixed(4)} USD${maxUsd ? `, cap ${maxUsd}` : ''}`);
console.log(`settings ${JSON.stringify(Object.fromEntries(models.map((m) => [m, SETTINGS[m]])))}`);

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
process.exit(tally.budget ? 3 : tally.error ? 2 : 0);
