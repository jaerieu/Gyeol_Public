// Prices copied from gyeol harness/src/prices.js (checked 2026-11-13). USD per million tokens; gateway fee 5%.
import { CACHE_WRITE_MULT } from './cache.mjs';
export const NEURON_USD = 0.011 / 1000;
const gw = (id, label, inp, outp, cached, extra = {}) => ({ id, label, usdPerM: [inp, outp], cachedUsdPerM: cached, fee: 1.05, ...extra });
export const MODELS = {
  haiku: gw('anthropic/claude-haiku-5.5', 'Claude Haiku 5.5', 0.1, 0.5, 0.01, { api: 'anthropic' }),
  luna: gw('openai/gpt-6-luna', 'GPT-6 Luna', 0.1, 0.5, 0.01, { api: 'responses' }),
  particle: gw('particle/particle-1', 'Particle 1', 0.25, 1, 0.025),
  m3: gw('minimax/m3', 'MiniMax M3', 0.3, 1.2, 0.03),
  qwenplus: gw('alibaba/qwen3.7-plus', 'Qwen 3.7 Plus', 0.32, 1.28, 0.064),
  deepseek: {
    id: '@cf/deepseek-ai/deepseek-v4.1-flash-1017', label: 'DeepSeek v4.1 flash (Workers AI)',
    neuronsPerM: [27273, 109091], cachedNeuronsPerM: 545,
  },
  glm53: { id: '@cf/zai-org/glm-5.3', label: 'GLM 5.3 (Workers AI)', neuronsPerM: [127273, 400000], cachedNeuronsPerM: 23636 },
  glm53flash: { id: '@cf/zai-org/glm-5.3-flash', label: 'GLM 5.3 flash (Workers AI)', neuronsPerM: [13636, 45455], cachedNeuronsPerM: 2727 },
};

// write = tokens newly written to the prompt cache; they cost CACHE_WRITE_MULT x input (5-minute / 30-minute retention).
export function costUsd(key, { tin = 0, tout = 0, cached = 0, write = 0, neurons = null }) {
  const m = MODELS[key];
  const fresh = Math.max(0, tin - cached);
  const w = Math.min(fresh, write);
  if (m.usdPerM) return ((fresh * m.usdPerM[0] + w * m.usdPerM[0] * (CACHE_WRITE_MULT - 1) + cached * m.cachedUsdPerM + tout * m.usdPerM[1]) / 1e6) * m.fee;
  const n = neurons ?? (fresh * m.neuronsPerM[0] + cached * m.cachedNeuronsPerM + tout * m.neuronsPerM[1]) / 1e6;
  return n * NEURON_USD;
}
