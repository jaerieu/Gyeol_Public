// Prompt-cache hints for the sprint runner, after gyeol site/src/cache-hints.js (read-only reference).
// One breakpoint at the end of the shared prefix (format rules + policy, see buildPrompt sharedChars).
// The runner sends all items of one model and format back to back, so later calls read that prefix.
// Retention is the provider default (Anthropic 5 minutes, OpenAI explicit 30 minutes): writes cost 1.25x input,
// and a run lasts minutes, so the long 1h/12h retention (2x/2.5x writes) would only cost more.
// Minimum cacheable prefix: Haiku 5.5 512 tokens, GPT-6 1024 tokens. A shorter prefix is sent with the hint
// and simply not cached (no error), so natural/json (about 170 tokens) rarely cache; lon (about 900) does on Haiku.
// The joined segments always equal the prompt text byte for byte; if not, no hint is sent.
export const CACHE_WRITE_MULT = 1.25;

export function withCache(api, input, p, key) {
  const shared = p.text.slice(0, p.sharedChars), rest = p.text.slice(p.sharedChars);
  if (!shared || !rest || shared + rest !== p.text) return { input, mode: null };
  if (api === 'anthropic') {
    const content = [{ type: 'text', text: shared, cache_control: { type: 'ephemeral' } }, { type: 'text', text: rest }];
    return { input: { ...input, messages: [{ role: 'user', content }] }, mode: 'anthropic_5m' };
  }
  if (api === 'responses') {
    const content = [
      { type: 'input_text', text: shared, prompt_cache_breakpoint: { mode: 'explicit' } },
      { type: 'input_text', text: rest },
    ];
    return {
      input: { ...input, input: [{ role: 'user', content }], prompt_cache_key: key.slice(0, 64), prompt_cache_options: { mode: 'explicit' } },
      mode: 'openai_explicit',
    };
  }
  return { input, mode: null };
}
