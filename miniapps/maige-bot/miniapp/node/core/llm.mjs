// 模型调用层：OpenAI 兼容 /chat/completions，支持非流式与 SSE 流式。

export const LLM_MODEL = process.env.MAIGE_LLM_MODEL || 'kimi-k3';
export const CHAT_MAX_TOKENS = parseInt(process.env.MAIGE_CHAT_MAX_TOKENS || '600', 10);
// 聊天模型筛选：排除明显非对话模型（图像/语音/视频/向量）
export const NON_CHAT_MODEL = /image|tts|video|embedding|vl-/i;

/** 调一次模型，返回 { text, usage }；失败抛错。model/maxTokens 为空时用全局默认。
 *  userContent 可为字符串或 content 数组（带图）；onChunk 传入时走 SSE 流式，逐段回调累计文本。 */
export async function callLlm(llm, system, userContent, model, onChunk, maxTokens) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90000);
  try {
    const r = await fetch(llm.baseURL + '/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'authorization': 'Bearer ' + llm.apiKey },
      body: JSON.stringify({
        model: model || LLM_MODEL,
        max_tokens: maxTokens || CHAT_MAX_TOKENS,
        thinking: { type: 'disabled' },
        stream: !!onChunk,
        ...(onChunk ? { stream_options: { include_usage: true } } : {}),
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userContent },
        ],
      }),
      signal: controller.signal,
    });
    if (!r.ok) throw new Error('llm_http_' + r.status);
    if (!onChunk) {
      const j = await r.json().catch(() => null);
      const text = j?.choices?.[0]?.message?.content;
      if (!text || !text.trim()) throw new Error('llm_empty');
      return { text: text.trim(), usage: j?.usage ?? null };
    }
    if (!r.body) throw new Error('llm_no_stream');
    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    let text = '';
    let usage = null;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf('\n\n')) >= 0) {
        const event = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        for (const line of event.split('\n')) {
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (payload === '[DONE]') continue;
          try {
            const j = JSON.parse(payload);
            const delta = j?.choices?.[0]?.delta?.content;
            if (delta) { text += delta; onChunk(text); }
            if (j?.usage) usage = j.usage;
          } catch { /* 半包忽略，下一段补齐 */ }
        }
      }
    }
    if (!text.trim()) throw new Error('llm_empty');
    return { text: text.trim(), usage };
  } finally {
    clearTimeout(timer);
  }
}