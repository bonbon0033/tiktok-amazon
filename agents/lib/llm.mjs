// Ollama HTTP client + rule-based fallback.
// Env: OLLAMA_URL (default http://127.0.0.1:11434), OLLAMA_MODEL (default llama3.1:8b)
//
// All agents call llmAvailable() first; if false, they fall back to rule-based generation.

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.1:8b';

export const config = { OLLAMA_URL, OLLAMA_MODEL };

export async function llmAvailable() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const r = await fetch(`${OLLAMA_URL}/api/tags`, { signal: controller.signal });
    clearTimeout(timer);
    if (!r.ok) return false;
    const j = await r.json();
    const models = (j.models || []).map(m => m.name);
    return models.some(n => n.startsWith(OLLAMA_MODEL.split(':')[0]));
  } catch {
    return false;
  }
}

export async function llmChat({ system, user, temperature = 0.7, format = 'text', maxTokens = 1024 }) {
  const payload = {
    model: OLLAMA_MODEL,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    stream: false,
    options: { temperature, num_predict: maxTokens },
  };
  if (format === 'json') payload.format = 'json';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90000);
  let r;
  try {
    r = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (!r.ok) throw new Error(`Ollama ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return j.message?.content ?? '';
}

export function parseJson(text) {
  // Trim leading/trailing markdown fences if the LLM ignored format=json
  const cleaned = text.trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '');
  return JSON.parse(cleaned);
}
