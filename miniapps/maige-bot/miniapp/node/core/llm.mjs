// 模型调用层：OpenAI 兼容 /chat/completions，支持非流式与 SSE 流式。
// 兼容不同厂商：思考参数、usage 统计、鉴权头都可按 provider 开关（陌生字段会让部分服务 400）。

export const LLM_MODEL = process.env.MAIGE_LLM_MODEL || 'kimi-k3';
export const CHAT_MAX_TOKENS = parseInt(process.env.MAIGE_CHAT_MAX_TOKENS || '600', 10);
// 聊天模型筛选：排除明显非对话模型（图像/语音/音乐/视频/向量）
export const NON_CHAT_MODEL = /image|tts|speech|voice|music|video|embedding|vl-/i;

/** 组装请求体：按 provider 能力决定带哪些可选字段 */
export function buildChatBody(provider, opts = {}) {
  const body = {
    model: opts.model || provider.defaultModel || LLM_MODEL,
    max_tokens: opts.maxTokens || CHAT_MAX_TOKENS,
    stream: !!opts.stream,
    messages: [
      { role: 'system', content: opts.system },
      { role: 'user', content: opts.userContent },
    ],
  };
  // dashscope/Qwen 系：reasoning 模型必须显式关思考，否则 content 为空
  if (provider.thinking) body.thinking = { type: 'disabled' };
  if (opts.stream && provider.streamUsage !== false) body.stream_options = { include_usage: true };
  return body;
}

/** 组装请求头：鉴权头名/前缀可配（Azure 用 api-key，多数用 authorization: Bearer） */
export function buildChatHeaders(provider) {
  const h = { 'content-type': 'application/json' };
  const name = provider.authHeader || 'authorization';
  const prefix = provider.authPrefix ?? 'Bearer ';
  h[name] = prefix + provider.apiKey;
  return h;
}

/** 调一次模型，返回 { text, usage }；失败抛错。model/maxTokens 为空时用 provider 默认。
 *  userContent 可为字符串或 content 数组（带图）；onChunk 传入时走 SSE 流式，逐段回调累计文本。
 *  兼容不支持流式的服务：流式拿不到内容时自动回退一次非流式请求。
 *  externalSignal：外部中止信号（面板的「停止」按钮），中止时抛 llm_aborted。 */
export async function callLlm(provider, system, userContent, model, onChunk, maxTokens, externalSignal) {
  const request = async (stream) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 90000);
    const onExternalAbort = () => controller.abort();
    if (externalSignal) {
      if (externalSignal.aborted) { clearTimeout(timer); throw new Error('llm_aborted'); }
      externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }
    try {
      const r = await fetch(provider.baseURL + '/chat/completions', {
        method: 'POST',
        headers: buildChatHeaders(provider),
        body: JSON.stringify(buildChatBody(provider, { system, userContent, model, maxTokens, stream })),
        signal: controller.signal,
      });
      if (!r.ok) {
        let detail = '';
        try { detail = String((await r.json())?.error?.message || '').slice(0, 120); } catch { /* 非 JSON 错误体 */ }
        throw new Error('llm_http_' + r.status + (detail ? ':' + detail : ''));
      }
      if (!stream) {
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
      return { text: text.trim(), usage };
    } catch (e) {
      // 外部中止（用户点了停止）与超时区分开：前者不是故障
      if (externalSignal && externalSignal.aborted) throw new Error('llm_aborted');
      throw e;
    } finally {
      clearTimeout(timer);
      if (externalSignal) externalSignal.removeEventListener('abort', onExternalAbort);
    }
  };

  if (!onChunk) return request(false);
  const streamed = await request(true);
  if (streamed.text) return streamed;
  // 有些自建服务/代理不支持 SSE 流式：回退一次非流式，别让用户卡在"没话说"
  const plain = await request(false);
  if (onChunk) onChunk(plain.text);
  return plain;
}
