// MiniMax 开放平台客户端（图像 / 语音 / 视频生成）。零依赖，纯 fetch。
// 凭据只在 Node 进程：从环境变量 MINIMAX_API_KEY 或 config.minimaxApiKey 读，不进 Client/日志/聊天。
// 生成物由调用方落作品库（[[WRITE]] 同款边界），这里只负责调 API 拿回二进制/URL。

const API_BASE = 'https://api.minimax.cn/v1';

/** 解析 API key：环境变量优先，其次 config。返回 null 表示未配置。 */
export function resolveApiKey(env, configValue) {
  const k = (env && env.MINIMAX_API_KEY) || configValue || '';
  return (typeof k === 'string' && k.trim()) ? k.trim() : null;
}

async function post(apiKey, path, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000); // 视频/长 TTS 给足 2 分钟
  try {
    const r = await fetch(API_BASE + path, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'authorization': 'Bearer ' + apiKey },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const j = await r.json().catch(() => null);
    if (!r.ok) throw new Error(`minimax_http_${r.status}:${(j && (j.base_resp?.status_msg || j.error?.message)) || 'unknown'}`);
    return j;
  } finally {
    clearTimeout(timer);
  }
}

/** 文本生图（image-01 系）。返回 { imageUrls: [...] }。
 *  传 refImageUrl 走参考图生图（image-to-image）：以该图为底图按 prompt 改。 */
export async function generateImage(apiKey, prompt, opts = {}) {
  const body = {
    model: opts.model || 'image-01',
    prompt: String(prompt || '').slice(0, 1500),
    aspect_ratio: opts.aspectRatio || '1:1',
    n: 1,
    prompt_optimizer: true,
  };
  if (opts.refImageUrl) body.reference_image = opts.refImageUrl;
  const j = await post(apiKey, '/image_generation', body);
  const urls = j?.data?.image_urls || j?.image_urls || [];
  if (!urls.length) throw new Error('minimax_image_empty');
  return { imageUrls: urls };
}

/** 文本转语音（speech-2.x turbo/hd）。返回 { audioHex }（十六进制 MP3）或 { audioUrl }。 */
export async function synthesizeSpeech(apiKey, text, opts = {}) {
  const j = await post(apiKey, '/t2a_v2', {
    model: opts.model || 'speech-2.8-turbo',
    text: String(text || '').slice(0, 10000),
    stream: false,
    voice_setting: { voice_id: opts.voiceId || 'male-qn-qingse', speed: 1, vol: 1, pitch: 0 },
    audio_setting: { format: 'mp3', sample_rate: 32000, bitrate: 128000, channel: 1 },
  });
  const hex = j?.data?.audio;
  if (hex) return { audioHex: hex };
  if (j?.data?.audio_url) return { audioUrl: j.data.audio_url };
  throw new Error('minimax_tts_empty');
}

/** 文本生视频（H3 系）。异步任务：返回 { taskId }，调用方轮询 queryVideoTask。 */
export async function generateVideo(apiKey, prompt, opts = {}) {
  const j = await post(apiKey, '/video_generation', {
    model: opts.model || 'MiniMax-H3-Max',
    prompt: String(prompt || '').slice(0, 2000),
    duration: opts.duration || 6,
    resolution: opts.resolution || '480P',
  });
  const taskId = j?.task_id || j?.id;
  if (!taskId) throw new Error('minimax_video_no_task');
  return { taskId };
}

/** 轮询视频任务状态。返回 { status, videoUrl? }。status: pending|processing|success|failed */
export async function queryVideoTask(apiKey, taskId) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const r = await fetch(`${API_BASE}/query/video_generation?task_id=${encodeURIComponent(taskId)}`, {
      headers: { authorization: 'Bearer ' + apiKey },
      signal: controller.signal,
    });
    const j = await r.json().catch(() => null);
    if (!r.ok) throw new Error(`minimax_query_http_${r.status}`);
    return { status: j?.status || 'pending', videoUrl: j?.video_url || j?.file_url || null };
  } finally {
    clearTimeout(timer);
  }
}
