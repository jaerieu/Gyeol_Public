// 모델마다 다른 응답 모양에서 답 본문, 사용량, 끝난 까닭을 꺼낸다.
// 실행기(worker.js)와 저장소 쪽 채점 도구가 같이 쓴다. 외부 의존 없음.
//
// 다루는 모양
//   Workers AI 예전 형식   { response: "…", usage: { prompt_tokens, completion_tokens } }
//   채팅 완성 형식         { choices: [{ message: { content, reasoning_content }, finish_reason }], usage }
//   Responses 형식         { output: [{ type: "reasoning" … }, { type: "message", content: [{ type: "output_text", text }] }], usage: { input_tokens, output_tokens } }
//   Gemini generateContent { candidates: [{ content: { parts: [{ text, thought? }] }, finishReason }], usageMetadata }
//   Anthropic Messages     { content: [{ type: "text", text }], stop_reason, usage: { input_tokens, output_tokens } } (AI Gateway, 2026-10-16)
//   Gemini streamGenerateContent(alt=sse): 위 모양의 조각이 `data:` 줄로 이어진다. mergeGeminiStream이 하나로 합친다.

/**
 * text/event-stream 본문의 data 줄을 JSON으로 읽어 조각 배열로 돌려준다.
 * data 줄이 하나도 없으면 본문 전체를 JSON(조각 배열이나 객체 하나)으로 읽는다.
 */
export function parseSse(text) {
  const s = typeof text === 'string' ? text : '';
  const events = [];
  let sawData = false;
  for (const block of s.split(/\r?\n\r?\n/)) {
    const lines = block.split(/\r?\n/).filter((l) => l.startsWith('data:'));
    if (lines.length === 0) continue;
    sawData = true;
    const data = lines.map((l) => l.slice(5).replace(/^ /, '')).join('\n');
    if (data === '[DONE]') continue;
    try {
      events.push(JSON.parse(data));
    } catch {
      events.push({ unparsed: data.slice(0, 500) });
    }
  }
  if (sawData) return events;
  try {
    const j = JSON.parse(s);
    return Array.isArray(j) ? j : [j];
  } catch {
    return [];
  }
}

/**
 * Gemini 흐름 조각들을 generateContent 한 번의 응답 모양으로 합친다.
 * 글 조각은 생각 여부가 같으면 이어 붙인다. 끝난 까닭·사용량·모델 판은 마지막에 나온 값을 쓴다.
 */
export function mergeGeminiStream(chunks) {
  const out = {};
  const parts = [];
  let cand = null;
  let role = 'model';
  let n = 0;
  for (const c of Array.isArray(chunks) ? chunks : []) {
    if (!c || typeof c !== 'object') continue;
    n += 1;
    if (c.promptFeedback && !out.promptFeedback) out.promptFeedback = c.promptFeedback;
    if (c.usageMetadata) out.usageMetadata = c.usageMetadata;
    if (c.modelVersion) out.modelVersion = c.modelVersion;
    if (c.responseId) out.responseId = c.responseId;
    const k = Array.isArray(c.candidates) ? c.candidates[0] : null;
    if (!k || typeof k !== 'object') continue;
    cand ??= {};
    for (const [key, v] of Object.entries(k)) if (key !== 'content' && v != null) cand[key] = v;
    if (k.content?.role) role = k.content.role;
    for (const p of Array.isArray(k.content?.parts) ? k.content.parts : []) {
      if (!p || typeof p !== 'object') continue;
      const last = parts[parts.length - 1];
      if (last && typeof p.text === 'string' && typeof last.text === 'string' && (p.thought === true) === (last.thought === true)) {
        const { text, ...rest } = p;
        last.text += text;
        Object.assign(last, rest);
      } else {
        parts.push({ ...p });
      }
    }
  }
  if (cand) out.candidates = [{ ...cand, content: { role, parts } }];
  out.streamChunks = n;
  return out;
}

/**
 * 모델이 본문에 흘린 특수 토큰을 지운다.
 * - 도구 호출 구역(<|tool_calls_section_begin|> 또는 <|tool_call_begin|>)부터 끝까지: Kimi K2.6이 판 풀이 끝에 흘렸다(2026-10-14).
 * - gpt-oss 형식이 새면 마지막 final 채널 뒤만 남긴다.
 * - 그 밖의 <|…|> 토큰은 토큰만 지운다.
 */
export function stripSpecialTokens(s) {
  let t = String(s ?? '');
  const FINAL = '<|channel|>final<|message|>';
  const fin = t.lastIndexOf(FINAL);
  if (fin >= 0) t = t.slice(fin + FINAL.length);
  t = t.replace(/<\|tool_call(?:s_section)?_begin\|>[\s\S]*$/u, '');
  t = t.replace(/<\|[a-z_]+\|>/giu, '');
  return t.trim();
}

/** 생각 과정(<think>…</think>)을 뺀다. 여는 꼬리표 없이 닫는 꼬리표만 있으면 그 뒤만 남긴다. 흘린 특수 토큰도 지운다. */
export function stripThink(s) {
  if (typeof s !== 'string') return '';
  let t = s.replace(/<think>[\s\S]*?<\/think>/g, '');
  const close = t.lastIndexOf('</think>');
  if (close >= 0) t = t.slice(close + '</think>'.length);
  return stripSpecialTokens(t);
}

function partsText(parts) {
  if (!Array.isArray(parts)) return '';
  return parts
    .filter((p) => p && p.thought !== true && typeof p.text === 'string')
    .map((p) => p.text)
    .join('');
}

/** 답 본문. 생각 과정은 넣지 않는다. 모르는 모양이면 빈 문자열. */
export function extractText(raw) {
  if (raw == null) return '';
  if (typeof raw === 'string') return stripThink(raw);
  if (typeof raw !== 'object') return '';

  if (typeof raw.response === 'string') return stripThink(raw.response);

  if (Array.isArray(raw.choices) && raw.choices.length > 0) {
    const c = raw.choices[0] ?? {};
    const m = c.message ?? c;
    const content = m.content ?? c.text;
    if (typeof content === 'string') return stripThink(content);
    if (Array.isArray(content)) return stripThink(partsText(content));
    return '';
  }

  if (Array.isArray(raw.output)) {
    const text = raw.output
      .filter((o) => o && o.type === 'message')
      .flatMap((o) => (Array.isArray(o.content) ? o.content : []))
      .filter((p) => p && p.type === 'output_text' && typeof p.text === 'string')
      .map((p) => p.text)
      .join('');
    if (text) return stripThink(text);
  }
  if (typeof raw.output_text === 'string') return stripThink(raw.output_text);

  if (Array.isArray(raw.candidates) && raw.candidates.length > 0) {
    return partsText(raw.candidates[0]?.content?.parts).trim();
  }
  // Anthropic Messages(AI Gateway 바깥 제공자, 2026-10-16): { content: [{ type: 'text', text }, { type: 'thinking' … }], stop_reason }
  if (Array.isArray(raw.content)) {
    return stripThink(raw.content.filter((p) => p && p.type === 'text' && typeof p.text === 'string').map((p) => p.text).join(''));
  }
  return '';
}

const int = (x) => (Number.isFinite(x) ? Math.round(x) : null);

/** 사용량 { in, out }. out에는 생각 과정 토큰도 넣는다(값을 매기는 기준이 그렇다). 모르면 null. */
export function usageOf(raw) {
  if (!raw || typeof raw !== 'object') return { in: null, out: null, cached: null };
  const g = raw.usageMetadata;
  if (g && typeof g === 'object') {
    const has = g.candidatesTokenCount != null || g.thoughtsTokenCount != null;
    const out = has ? (g.candidatesTokenCount ?? 0) + (g.thoughtsTokenCount ?? 0) : null;
    return { in: int(g.promptTokenCount), out: int(out), cached: int(g.cachedContentTokenCount) };
  }
  const u = raw.usage;
  if (u && typeof u === 'object') {
    // Anthropic Messages 꼴은 input_tokens에 캐시에서 읽은 토큰·캐시에 쓴 토큰이 빠져 있다(2026-11-08). 세 칸을 더해 전체 입력으로 맞춘다.
    const anth = u.prompt_tokens == null && (u.cache_read_input_tokens != null || u.cache_creation_input_tokens != null);
    const tin = anth ? (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) : u.prompt_tokens ?? u.input_tokens;
    return {
      in: int(tin),
      out: int(u.completion_tokens ?? u.output_tokens),
      cached: cachedOf(u),
      // 캐시에 새로 쓴 토큰: Anthropic cache_creation_input_tokens, OpenAI Responses input_tokens_details.cache_write_tokens(2026-11-08 GPT-6 Luna 확인)
      ...((cw) => (cw != null ? { cache_write: int(cw) } : {}))(anth ? u.cache_creation_input_tokens : u.input_tokens_details?.cache_write_tokens),
    };
  }
  return { in: null, out: null, cached: null };
}

/**
 * 입력 가운데 접두 캐시에서 읽은 토큰(2026-11-04 H-261104-1). 칸이 없으면 null.
 * Workers AI·OpenAI 꼴 prompt_tokens_details.cached_tokens, Responses 꼴 input_tokens_details.cached_tokens,
 * 평평한 cached_tokens, Anthropic cache_read_input_tokens를 차례로 본다(Gemini는 usageMetadata.cachedContentTokenCount).
 */
function cachedOf(u) {
  const v = u.prompt_tokens_details?.cached_tokens ?? u.input_tokens_details?.cached_tokens ?? u.cached_tokens ?? u.cache_read_input_tokens;
  return int(v);
}

/**
 * Workers AI가 답의 usage에 적어 주는 실제 뉴런. 없으면 null(그때는 prices.js의 어림을 쓴다).
 * 2026-10-14 확인: 유료 모델 답에 usage.neurons가 온다(DeepSeek V4 Pro 2,046+8,447토큰 → 3,286.44, 어림과 같다).
 */
export function neuronsOf(raw) {
  const v = raw && typeof raw === 'object' ? raw.usage?.neurons : null;
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

/** 끝난 까닭. stop·length·MAX_TOKENS·SAFETY 따위. 모르면 null. */
export function finishOf(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (Array.isArray(raw.choices) && raw.choices[0]) return raw.choices[0].finish_reason ?? null;
  if (Array.isArray(raw.candidates) && raw.candidates[0]) return raw.candidates[0].finishReason ?? null;
  if (raw.promptFeedback?.blockReason) return `blocked:${raw.promptFeedback.blockReason}`;
  if (typeof raw.stop_reason === 'string') return raw.stop_reason; // Anthropic Messages
  if (typeof raw.status === 'string') {
    const why = raw.incomplete_details?.reason;
    return why ? `${raw.status}:${why}` : raw.status;
  }
  return null;
}
