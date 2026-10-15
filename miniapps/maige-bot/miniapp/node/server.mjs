// @ts-check
// 麦格面板 Node 服务：概览 + 记忆 CRUD + 作品库（预览）+ 设置（版本号见 PANEL_VERSION / plugin.json）
// 数据源：本地授权目录（记忆目录 / 作品目录 / maige-bot 插件根只读版本号）。
// 安全：所有文件访问经 realpath 校验，fail-closed 限定在授权目录内；不做任意文件系统代理。

import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { readFile, readdir, stat, unlink, realpath, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as minimax from './minimax.mjs';

/** @typedef {import('./miniapp-api.js').MiniAppContext} MiniAppContext */
/** @typedef {import('./miniapp-api.js').MiniAppLifecycle} MiniAppLifecycle */

// 路径可配置（公开仓库不写死个人绝对路径）：优先 MAIGE_* 环境变量，否则用 HOME 推导默认。
// 默认布局约定：<ROOT> = $HOME/Documents/minimax项目（可用 MAIGE_ROOT 覆盖）。
import { homedir } from 'node:os';
const HOME = process.env.HOME || homedir();
const MAIGE_ROOT = process.env.MAIGE_ROOT || join(HOME, 'Documents', 'minimax项目');
const MINIMAX_HOME = process.env.MINIMAX_HOME || join(HOME, '.minimax');

const DEFAULTS = {
  memoryDir: process.env.MAIGE_MEMORY_DIR || join(MAIGE_ROOT, 'maige-bot', 'memory'),
  outputsDir: process.env.MAIGE_OUTPUTS_DIR || join(MAIGE_ROOT, 'maige-outputs'),
};
// 面板的业务边界：除两个可配目录外，只读 maige-bot 插件清单里的版本号
const MAIGE_PLUGIN_MANIFEST = process.env.MAIGE_PLUGIN_MANIFEST || join(MINIMAX_HOME, 'plugins', 'maige-bot', '.minimax-plugin', 'plugin.json');
// 团队页只读目录：MCode 自定义 agent 注册位置。
// 团队不是固定名单：凡 agent.md frontmatter 带 `team: maige` 标记的都是麦格成员（动态组队）。
const AGENTS_DIR = process.env.MAIGE_AGENTS_DIR || join(MINIMAX_HOME, 'agents');
// 头像目录：icons-v2（Q 版）优先，icons（商业符号风）兜底。成员 key → display 名小写 → <名>.png/.jpg。
const ICONS_DIRS = (process.env.MAIGE_ICONS_DIRS
  ? process.env.MAIGE_ICONS_DIRS.split(':')
  : [join(MAIGE_ROOT, 'maige-outputs', 'icons-v2'), join(MAIGE_ROOT, 'maige-outputs', 'icons')]);
const ICON_EXTS = ['.png', '.jpg'];

/** 解析 agent.md frontmatter 为键值对 */
function parseAgentFrontmatter(raw) {
  const out = {};
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return out;
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (kv) out[kv[1].toLowerCase()] = kv[2].trim();
  }
  return out;
}

const ID_PATTERN = /^[A-Za-z0-9._-]+$/;
const SOURCES = ['user', 'maige', 'tool'];
const MEDIA_TYPES = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg',
  '.md': 'text/markdown; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
};

function extOf(name) {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i).toLowerCase() : '';
}

/** 确定性头像：key 哈希 → 品牌紫系 HSL 色 + 5×5 左右对称几何图案（identicon 风）。
 *  同一 key 永远同一图案，不同 key 图案/颜色都不同——新 bot 零素材即得独一无二头像。 */
export function avatarSvgFor(seed) {
  const h = createHash('sha256').update(String(seed)).digest();
  const hue = 240 + (h[0] % 60);            // 240~300 蓝紫带（品牌紫系）
  const sat = 55 + (h[1] % 25);             // 55~80
  const bgL = 22 + (h[2] % 12);             // 深色底 22~34
  const fgL = 62 + (h[3] % 14);             // 亮色前景 62~76
  const N = 5, cell = 96 / N;
  const bit = (x, y) => (h[4 + ((y * 3 + x) % 28)] >> ((y * 3 + x) % 8)) & 1; // 取左 3 列做对称源
  let cells = '';
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const mx = x < 3 ? x : N - 1 - x;     // 右半镜像左半 → 左右对称
      if (!bit(mx, y)) continue;
      cells += `<rect x="${(x * cell).toFixed(1)}" y="${(y * cell).toFixed(1)}" width="${cell.toFixed(1)}" height="${cell.toFixed(1)}"/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">`
    + `<rect width="96" height="96" rx="20" fill="hsl(${hue} ${sat}% ${bgL}%)"/>`
    + `<g fill="hsl(${hue} ${sat}% ${fgL}%)">${cells}</g></svg>`;
}

function kindOf(name) {
  const mime = MEDIA_TYPES[extOf(name)] || '';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return 'file';
}

/** 解析 bot 回复里的工具指令（一条回复最多认 1 个，WRITE 必须是回复的结尾） */
export function parseTool(text) {
  let m = text.match(/\[\[SEARCH:([^\]]+)\]\]/);
  if (m) return { name: 'search', arg: m[1].trim(), raw: m[0] };
  m = text.match(/\[\[READ:([^\]]+)\]\]/);
  if (m) return { name: 'read', arg: m[1].trim(), raw: m[0] };
  m = text.match(/\[\[LS:([^\]]+)\]\]/);
  if (m) return { name: 'ls', arg: m[1].trim(), raw: m[0] };
  m = text.match(/\[\[WRITE:([^\]\n]+)\]\]\s*\n([\s\S]+)$/);
  if (m) return { name: 'write', arg: m[1].trim(), content: m[2].trim(), raw: m[0] };
  m = text.match(/\[\[TASK:([A-Za-z]+):([^\]\n]+)\]\]\s*\n([\s\S]+)$/);
  if (m) return { name: 'task', kind: m[1].trim().toLowerCase(), arg: m[2].trim(), content: m[3].trim(), raw: m[0] };
  m = text.match(/\[\[HIRE:([a-z][a-z0-9-]{1,30}):([^\]\n:]+):([^\]]+)\]\]\s*\n([\s\S]+)$/);
  if (m) return { name: 'hire', arg: m[1].trim(), role: m[2].trim(), display: m[3].trim(), content: m[4].trim(), raw: m[0] };
  // [[CONFIG:key:field:value]] 调整成员配置（field: maxTokens/model），一条一个，不用换行接内容
  m = text.match(/\[\[CONFIG:([a-z][a-z0-9-]{1,30}):(maxTokens|model):([^\]]+)\]\]/);
  if (m) return { name: 'config', arg: m[1].trim(), field: m[2].trim(), value: m[3].trim(), raw: m[0] };
  // [[GENERATE_IMAGE:提示词]] 文生图；[[SPEAK:文本]] 文转语音。提示词在指令内，不换行
  m = text.match(/\[\[GENERATE_IMAGE:([^\]\n]+)\]\]/);
  if (m) return { name: 'generate_image', arg: m[1].trim(), raw: m[0] };
  m = text.match(/\[\[SPEAK:([^\]\n]+)\]\]/);
  if (m) return { name: 'speak', arg: m[1].trim(), raw: m[0] };
  return null;
}

/** 把路径限定在工作区内（支持子路径；realpath 解析软链；fail-closed） */
export async function resolveWorkspace(root, p) {
  const realRoot = await realpath(root).catch(() => null);
  if (!realRoot) return null;
  const abs = p.startsWith('/') ? p : join(realRoot, p);
  const target = await realpath(abs).catch(() => null);
  if (!target || (target !== realRoot && !target.startsWith(realRoot + '/'))) return null;
  return target;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// ================= 群聊引擎 =================
// 模型来源：解析本机 config.yaml 的 OpenAI 兼容 provider（dashscope/Alibaba 块），
// 直连 /chat/completions。凭据只留在 Node 进程，不进 Client、不进日志。

const LLM_MODEL = 'kimi-k3';
const CHAT_MAX_TOKENS = 600;
// 每 bot maxTokens 上限对齐 kimi-k3 真实输出上限（config.yaml limit.output = 1000000）
const MAX_TOKENS_LIMIT = 1000000;
// 新 bot 入职自动分档（按职责关键词，命中即用；DEFAULT_MAX_TOKENS 兜底）。存量的手动配值优先级更高（config.maxTokens 覆盖）。
const ROLE_MAX_TOKENS = [
  { match: /写|文案|编剧|歌词|脚本|创作|成文/, tokens: 200000 },
  { match: /技术|代码|工程|开发|架构/, tokens: 50000 },
  { match: /主管|chief|收口|总结/, tokens: 8000 },
  { match: /评审|挑刺|压力测试|审/, tokens: 4000 },
  { match: /视觉|分镜|画面|美术|设计/, tokens: 4000 },
  { match: /查证|调研|搜索|溯源|研究/, tokens: 2000 },
  { match: /记录|纪要|归档|备忘/, tokens: 2000 },
];
const DEFAULT_MAX_TOKENS = 4000;
export function maxTokensForRole(role) {
  const text = String(role || '');
  for (const r of ROLE_MAX_TOKENS) {
    if (r.match.test(text)) return r.tokens;
  }
  return DEFAULT_MAX_TOKENS;
}
const PANEL_VERSION = '0.22.0';
// 新成员 key 规则（agent 目录名）：小写字母开头，小写字母/数字/连字符
const BOT_KEY = /^[a-z][a-z0-9-]{2,30}$/;
// 整活单（任务）：文件存储在 maige-bot/tasks/，面板与 MCode 会话共享同一目录（交接靠文件，不靠 API）
const TASKS_DIR = process.env.MAIGE_TASKS_DIR || join(MAIGE_ROOT, 'maige-bot', 'tasks');
// 任务状态机：draft 待确认 → ready 提示词就绪 → making 制作中 → done 已交付；cancelled 可复活到 draft
const TASK_TRANSITIONS = {
  draft: ['ready', 'cancelled'],
  ready: ['making', 'draft', 'cancelled'],
  making: ['done', 'ready', 'cancelled'],
  done: [],
  cancelled: ['draft'],
};
const TASK_KINDS = ['image', 'video', 'audio', 'text'];
// 非敏感任务类型：开单后免确认直通 ready（提示词就绪）；video/audio 成本高，保留人工确认闸
const AUTO_READY_KINDS = ['image', 'text'];
// 工具层：bot 回复里的指令由服务端解析执行（[[SEARCH]]/[[READ]]/[[LS]]/[[WRITE]]），
// 结果作为【工具】系统消息回注上下文，同一人接着说。每位发言者最多 TOOL_ROUNDS 轮。
const TOOL_ROUNDS = 3;
const WORKSPACE_ROOT = process.env.MAIGE_WORKSPACE_ROOT || MAIGE_ROOT;
// 上下文压缩：会话超过 TRIGGER 条就把旧消息压成纪要（保留最近 KEEP 条原文）；
// 距上次压缩又涨 EVERY 条再重压。env 可调（手动验证脚本用小阈值）。
const COMPRESS_TRIGGER = parseInt(process.env.MAIGE_COMPRESS_TRIGGER || '60', 10);
const COMPRESS_KEEP = parseInt(process.env.MAIGE_COMPRESS_KEEP || '20', 10);
const COMPRESS_EVERY = parseInt(process.env.MAIGE_COMPRESS_EVERY || '40', 10);
// 联网搜索触发词（命中即先搜后答，结果作为系统消息进入对话上下文）
const SEARCH_TRIGGER = /搜索|搜一下|搜搜|查一下|查查|最新|新闻|今天.{0,8}(发生|热点)|search/i;
// 所有 bot 的 system prompt 都会带这段工具说明
const TOOL_PROMPT = `
你可以用的工具（把指令写在回复里即可生效，一条回复最多 1 个）：
- [[SEARCH:关键词]] 联网搜索（要最新/实时信息时用）
- [[READ:路径]] 读工作区里的文本文件（支持子路径，如 maige-bot/README.md）
- [[LS:路径]] 列目录（如 maige-bot）
- [[WRITE:文件名]] 换行后接完整内容——写入作品库（只在交付作品时用；写完把要点说给人听，不要复述全文）
- [[TASK:类型:标题]] 换行后接需求描述与提示词包——开一张整活单（类型：image/video/audio/text；image/text 开单即就绪、点开始即制作，video/audio 需 Mike 确认。你没有直接生成图/视频的能力，别假装生成了）
- [[HIRE:key:职责:显示名]] 换行后接人格与能力说明——现场招聘新成员（key 用小写字母/连字符，如 tech-lead；团队缺角色时先向 Mike 提议并说明理由，他点头后才写指令）
- [[CONFIG:key:maxTokens:值]] 或 [[CONFIG:key:model:模型id]] —— 调整成员配置（只能改别人，不能改自己；maxTokens 范围 128~1000000，模型限当前 provider 的对话模型）。发现成员被 token 掐脖子或模型不对路时主动调，调完说一句为什么
- [[GENERATE_IMAGE:提示词]] 文生图、[[SPEAK:文本]] 文转语音——生成物自动进作品库（需要 Mike 已配 MiniMax API key；没配就说没配，别假装生成了）
工具结果会以【工具】消息回来，看完接着说你该说的。没事别乱用工具。

【纪律】先说后做等于撒谎：没有写对应指令，就绝不要说「已入职/已写好/已开单/已搜到」。宣布了动作，指令就必须出现在同一条回复里。`;
// 能力包目录：纯文本提示词包（.md，frontmatter 写 name/description），可挂载到任意 bot
const CAPS_DIR = process.env.MAIGE_CAPS_DIR || join(MAIGE_ROOT, 'maige-bot', 'capabilities');
// 聊天模型筛选：排除明显非对话模型（图像/语音/视频/向量）
const NON_CHAT_MODEL = /image|tts|video|embedding|vl-/i;

/** 从 config.yaml 提取 OpenAI 兼容 provider（含 dashscope 的块） */
function loadLlmConfig() {
  try {
    const raw = readFileSync(join(MINIMAX_HOME, 'config.yaml'), 'utf8');
    const lines = raw.split('\n');
    const blocks = [];
    let cur = null;
    for (const l of lines) {
      const m = l.match(/^  ([A-Za-z0-9_-]+):\s*$/);
      if (m) { if (cur) blocks.push(cur); cur = { key: m[1], lines: [] }; continue; }
      if (cur) cur.lines.push(l);
      if (/^\S/.test(l) && cur) { blocks.push(cur); cur = null; }
    }
    if (cur) blocks.push(cur);
    const found = blocks.find((b) => b.lines.join('\n').includes('dashscope'))
      || blocks.find((b) => b.lines.join('\n').includes('api.claudecode.net.cn'));
    if (!found) return null;
    const block = found.lines.join('\n');
    const apiKey = block.match(/apiKey:\s*(\S+)/)?.[1];
    const baseURL = block.match(/baseURL:\s*(\S+)/)?.[1];
    if (!apiKey || !baseURL) return null;
    return { apiKey, baseURL: baseURL.replace(/\/$/, ''), models: modelsFromBlock(found.lines) };
  } catch {
    return null;
  }
}

/** 从 provider 块提取 models: 映射里的模型 id（4 空格 models: → 6 空格模型名） */
function modelsFromBlock(lines) {
  const out = [];
  let inModels = false;
  for (const line of lines) {
    if (/^    models:\s*$/.test(line)) { inModels = true; continue; }
    if (!inModels) continue;
    if (/^ {4}\S/.test(line)) break; // 回到 4 空格层，models 段结束
    const m = line.match(/^      ([A-Za-z0-9._-]+):\s*$/);
    if (m) out.push(m[1]);
  }
  return out;
}

/** 调一次模型，返回纯文本；失败抛错。model/maxTokens 为空时用全局默认。
 *  userContent 可为字符串或 content 数组（带图）；onChunk 传入时走 SSE 流式，逐段回调累计文本。 */
async function callLlm(llm, system, userContent, model, onChunk, maxTokens) {
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

function sendJson(res, status, data) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function sendError(res, status, code) {
  sendJson(res, status, { error: code });
}

async function readBody(req) {
  let body = '';
  for await (const chunk of req) body += chunk;
  if (body.length > 256 * 1024) throw new Error('payload_too_large');
  return body ? JSON.parse(body) : {};
}

/** 解析单条记忆 .md 文件（frontmatter + 正文） */
function parseMemory(id, raw) {
  const item = { id, name: id, description: '', source: 'maige', date: '', sensitive: false, body: '' };
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  item.body = (m ? m[2] : raw).trim();
  if (m) {
    for (const line of m[1].split(/\r?\n/)) {
      const kv = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
      if (!kv) continue;
      const key = kv[1].toLowerCase();
      const value = kv[2].trim();
      if (key === 'name' && value) item.name = value;
      if (key === 'description') item.description = value;
      if (key === 'source' && SOURCES.includes(value)) item.source = value;
      if (key === 'date') item.date = value;
      if (key === 'sensitive') item.sensitive = value === 'true';
    }
  }
  return item;
}

/** 序列化记忆为 .md 文件内容 */
function serializeMemory(item) {
  const esc = (v) => String(v ?? '').replace(/\r?\n/g, ' ').trim();
  return [
    '---',
    `name: ${esc(item.name)}`,
    `description: ${esc(item.description)}`,
    `source: ${SOURCES.includes(item.source) ? item.source : 'maige'}`,
    `date: ${esc(item.date) || today()}`,
    `sensitive: ${item.sensitive ? 'true' : 'false'}`,
    '---',
    '',
    `${String(item.body ?? '').trim()}`,
    '',
  ].join('\n');
}

/** 校验客户端提交的记忆字段，返回错误码或规范化对象 */
function normalizeMemoryInput(raw) {
  if (!raw || typeof raw !== 'object') return { error: 'invalid_body' };
  const name = String(raw.name ?? '').trim();
  if (!name || name.length > 60) return { error: 'invalid_name' };
  const body = String(raw.body ?? '').trim();
  if (!body) return { error: 'invalid_body_content' };
  return {
    value: {
      name,
      description: String(raw.description ?? '').trim().slice(0, 200),
      source: SOURCES.includes(raw.source) ? raw.source : 'user',
      sensitive: raw.sensitive === true,
      body: body.slice(0, 8000),
      date: typeof raw.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.date) ? raw.date : today(),
    },
  };
}

/** 列目录内文件并附带 stat 信息；目录不存在时返回 dirExists:false */
async function listDir(dir) {
  try {
    const real = await realpath(dir);
    const names = await readdir(real);
    const items = [];
    for (const name of names) {
      if (name.startsWith('.')) continue;
      try {
        const st = await stat(join(real, name));
        if (!st.isFile()) continue;
        items.push({ name, size: st.size, mtime: st.mtime.toISOString() });
      } catch { /* 单个文件失败不阻塞列表 */ }
    }
    return { dirExists: true, real, items };
  } catch {
    return { dirExists: false, real: null, items: [] };
  }
}

/** 将用户提交的文件名限定在授权目录内（fail-closed） */
async function resolveInside(dir, name) {
  if (!ID_PATTERN.test(name) || name.includes('..')) return null;
  const real = await realpath(dir).catch(() => null);
  if (!real) return null;
  const target = await realpath(join(real, name)).catch(() => null);
  if (!target || !target.startsWith(real + '/')) return null;
  return target;
}

/**
 * @param {MiniAppContext} context
 * @returns {Promise<MiniAppLifecycle>}
 */
export async function start(context) {
  const clientEntry = await readFile(join(context.pluginRoot, 'miniapp/client/index.html'));
  const configPath = join(context.dataDir, 'config.json');

  async function loadConfig() {
    try {
      const raw = JSON.parse(await readFile(configPath, 'utf8'));
      return {
        memoryDir: typeof raw.memoryDir === 'string' && raw.memoryDir.trim() ? raw.memoryDir.trim() : DEFAULTS.memoryDir,
        outputsDir: typeof raw.outputsDir === 'string' && raw.outputsDir.trim() ? raw.outputsDir.trim() : DEFAULTS.outputsDir,
        models: sanitizeStringMap(raw.models),
        capabilities: sanitizeCapsMap(raw.capabilities),
        maxTokens: sanitizeMaxTokensMap(raw.maxTokens),
        notifications: raw.notifications !== false,
        minimaxApiKey: typeof raw.minimaxApiKey === 'string' ? raw.minimaxApiKey.trim() : '',
      };
    } catch {
      return { ...DEFAULTS, models: {}, capabilities: {}, maxTokens: {}, notifications: true, minimaxApiKey: '' };
    }
  }

  /** bot→model 映射白名单化：key 限 ID_PATTERN，model 限模型 id 字符 */
  function sanitizeStringMap(raw) {
    const out = {};
    if (!raw || typeof raw !== 'object') return out;
    for (const [k, v] of Object.entries(raw)) {
      if (ID_PATTERN.test(k) && typeof v === 'string' && /^[A-Za-z0-9._-]{1,64}$/.test(v)) out[k] = v;
    }
    return out;
  }

  /** bot→maxTokens 映射白名单化：128~MAX_TOKENS_LIMIT 的整数，越界丢弃 */
  function sanitizeMaxTokensMap(raw) {
    const out = {};
    if (!raw || typeof raw !== 'object') return out;
    for (const [k, v] of Object.entries(raw)) {
      const n = Number(v);
      if (ID_PATTERN.test(k) && Number.isInteger(n) && n >= 128 && n <= MAX_TOKENS_LIMIT) out[k] = n;
    }
    return out;
  }

  /** bot→能力包 id 数组 映射白名单化 */
  function sanitizeCapsMap(raw) {
    const out = {};
    if (!raw || typeof raw !== 'object') return out;
    for (const [k, v] of Object.entries(raw)) {
      if (!ID_PATTERN.test(k) || !Array.isArray(v)) continue;
      const ids = v.filter((x) => typeof x === 'string' && ID_PATTERN.test(x)).slice(0, 20);
      if (ids.length) out[k] = ids;
    }
    return out;
  }

  async function saveConfig(next) {
    const merged = { ...config, ...next };
    await mkdir(context.dataDir, { recursive: true });
    await writeFile(configPath, JSON.stringify(merged, null, 2), 'utf8');
    return merged;
  }

  let config = await loadConfig();
  await mkdir(config.memoryDir, { recursive: true }).catch(() => {});

  // ================= 聊天状态（多会话，DS Bot 式） =================
  // 会话 id：'chief'=与麦格单聊，'group'=团队群聊，'m:<成员key>'=与成员单聊。
  const llm = loadLlmConfig();
  const llmReady = !!llm;
  // 宿主连接器探针（仅 MCode 宿主注入；standalone 无）。启动时列出可用工具，供诊断页与后续 GENERATE 能力评估。
  let hostTools = [];
  if (context.hostConnector && typeof context.hostConnector.list === 'function') {
    try {
      const inv = await context.hostConnector.list();
      hostTools = (inv.tools || []).map((t) => ({ provider: t.provider, name: t.name, description: (t.description || '').slice(0, 120) }));
      context.logger.info('maige-bot.host-connector', { count: hostTools.length, partial: inv.partial === true });
    } catch (e) {
      context.logger.warn('maige-bot.host-connector.failed', { error: String(e && e.message || e) });
    }
  }
  // 探针落盘：不管宿主有没有注入，都把结果写到固定文件，方便 MCode 面板启动后被外部读取（绕开宿主 Host 校验）
  try {
    const { writeFileSync: wf } = await import('node:fs');
    wf(join(MAIGE_ROOT, 'maige-bot', 'data', 'host-tools.json'), JSON.stringify({
      available: !!context.hostConnector, pluginId: context.pluginId, at: new Date().toISOString(), toolCount: hostTools.length, tools: hostTools,
    }, null, 2), 'utf8');
  } catch { /* 探针落盘失败不阻塞启动 */ }
  const chatFile = join(context.dataDir, 'chat.json');
  const imagesDir = join(context.dataDir, 'images');
  const CONV_ID = /^[A-Za-z0-9:_-]{1,64}$/;
  const convs = Object.create(null);
  function getConv(id) {
    if (!convs[id]) convs[id] = { messages: [], seq: 0, typing: null, running: false };
    return convs[id];
  }
  try {
    const saved = JSON.parse(await readFile(chatFile, 'utf8'));
    if (saved.convs && typeof saved.convs === 'object') {
      for (const [cid, val] of Object.entries(saved.convs)) {
        if (!CONV_ID.test(cid)) continue;
        // 兼容两种格式：[...] 或 { messages: [...], summary: {...} }
        const msgs = Array.isArray(val) ? val : (val && Array.isArray(val.messages) ? val.messages : null);
        if (!msgs) continue;
        const c = getConv(cid);
        c.messages = msgs;
        c.seq = msgs.reduce((m, x) => Math.max(m, x.id || 0), 0);
        if (val && val.summary && typeof val.summary.text === 'string') c.summary = val.summary;
      }
    } else if (Array.isArray(saved.messages)) {
      // 旧版单群聊格式迁移到 group 会话
      const c = getConv('group');
      c.messages = saved.messages;
      c.seq = saved.messages.reduce((m, x) => Math.max(m, x.id || 0), 0);
    }
  } catch { /* 首次启动无历史 */ }

  async function persistChat() {
    const out = { convs: {} };
    for (const [cid, c] of Object.entries(convs)) {
      if (c.messages.length || c.summary) out.convs[cid] = { messages: c.messages.slice(-500), summary: c.summary || null };
    }
    await mkdir(context.dataDir, { recursive: true });
    await writeFile(chatFile, JSON.stringify(out, null, 2), 'utf8');
  }

  // ---------- 诊断日志（环形 50 条，仅留在进程内存与面板内，不外发） ----------
  const errors = [];
  function logError(source, message) {
    errors.unshift({ at: new Date().toISOString(), source, message: String(message).slice(0, 500) });
    if (errors.length > 50) errors.pop();
  }

  // ---------- 定时任务 ----------
  // 到点后向群聊注入一条任务消息，并指定成员发言（麦格的「定时整活」在此落地）
  const schedulesFile = join(context.dataDir, 'schedules.json');
  let schedules = [];
  try {
    const saved = JSON.parse(await readFile(schedulesFile, 'utf8'));
    if (Array.isArray(saved)) schedules = saved;
  } catch { /* 首次 */ }

  async function persistSchedules() {
    await mkdir(context.dataDir, { recursive: true });
    await writeFile(schedulesFile, JSON.stringify(schedules, null, 2), 'utf8');
  }

  function isDue(s, now) {
    if (!s.enabled) return false;
    const last = s.lastRunAt ? new Date(s.lastRunAt).getTime() : 0;
    if (s.freqType === 'interval') {
      return now.getTime() - last >= (s.minutes || 60) * 60000;
    }
    if (s.freqType === 'daily') {
      const [hh, mm] = (s.time || '09:00').split(':').map(Number);
      const todayAt = new Date(now); todayAt.setHours(hh, mm, 0, 0);
      return now.getTime() >= todayAt.getTime() && last < todayAt.getTime();
    }
    return false;
  }

  async function tickSchedules() {
    if (getConv('group').running) return; // 群聊发言中，下一轮再检查
    const now = new Date();
    for (const s of schedules) {
      if (!isDue(s, now)) continue;
      s.lastRunAt = now.toISOString();
      await persistSchedules().catch(() => {});
      await appendMessage('group', 'scheduler', '定时任务', `【${s.name}】到点`, 'system');
      notify('麦格 · 定时任务', `【${s.name}】到点，${s.memberKey === 'maige' ? '麦格' : s.memberKey} 正在发言`);
      if (llmReady) {
        await appendMessage('group', 'user', 'Mike', s.text, 'user');
        await runTurn('group', s.memberKey === 'maige' ? null : s.memberKey);
      }
      context.logger.info('maige-bot.schedule.fired');
    }
  }

  const scheduleTimer = setInterval(() => { void tickSchedules(); }, 30000);
  context.signal.addEventListener('abort', () => clearInterval(scheduleTimer), { once: true });

  async function appendMessage(convId, sender, name, text, kind, usage, media, card) {
    const c = getConv(convId);
    c.messages.push({ id: ++c.seq, sender, name, text, at: new Date().toISOString(), kind, ...(usage ? { usage } : {}), ...(media ? { media } : {}), ...(card ? { card } : {}) });
    await persistChat().catch(() => {});
  }

  /** 麦格 + 团队花名册（动态扫描 team: maige） */
  async function getMembers() {
    const members = [{
      key: 'maige', displayName: '麦格', role: '主管',
      description: '麦格团队的主管：全能问答、调度成员、收口总结',
      persona: '脑洞大、接梗快、幽默不冒犯的全能搭子——什么都能聊，也什么都能造。',
      system: null, // 麦格的 system 单独构造
    }];
    let dirNames = [];
    try {
      dirNames = (await readdir(AGENTS_DIR)).filter((n) => !n.startsWith('.'));
    } catch { /* ignore */ }
    for (const dirName of dirNames) {
      let agentRaw;
      try {
        agentRaw = await readFile(join(AGENTS_DIR, dirName, 'agent.md'), 'utf8');
      } catch { continue; }
      const fm = parseAgentFrontmatter(agentRaw);
      if (fm.team !== 'maige') continue;
      let persona = '';
      try { persona = (await readFile(join(AGENTS_DIR, dirName, 'PERSONA.md'), 'utf8')).trim(); } catch { /* optional */ }
      members.push({
        key: dirName,
        displayName: fm.display || dirName,
        role: fm.description || '',
        description: fm.description || '',
        persona,
        system: agentRaw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '').trim(),
      });
    }
    return members;
  }

  function buildChiefSystem(members, mode) {
    const roster = members.filter((m) => m.key !== 'maige')
      .map((m) => `- ${m.displayName}（key: ${m.key}）：${m.role}`).join('\n');
    if (mode === 'dm') {
      return `你是麦格，「麦格团队」的主管（Chief），现在和老板 Mike 单聊（不是群聊）。
团队成员（闲聊不必提；Mike 有活儿时你可以推荐他去群聊召集大家）：
${roster}

单聊规则：
- 口语短句，像微信单聊，不写报告体、不堆标题列表
- 语言跟随用户：他说中文你回中文，他说英文你回英文（挂载的能力包另有约定时听能力包的）
- 你是全能搭子：问答、锐评、出主意、情绪价值都直接给
- 保持人格：脑洞大、接梗快、幽默不冒犯；可以调侃但别冒犯老板
- 不要自我介绍，不要复述规则`;
    }
    return `你是麦格，「麦格团队」群的主管（Chief）。用户是老板 Mike。
群里成员：
${roster}

群聊规则：
- 口语短句，像群聊说话，不写报告体、不堆标题列表
- 语言跟随用户：他说中文你回中文，他说英文你回英文（挂载的能力包另有约定时听能力包的）
- 你自己能答的直接答，别什么事都叫人
- 【重要】想让某个成员开口，光在话里提名没有用——必须在回复末尾单独一行写 [[CALL:成员key]]，这才是真正的叫人动作。提名只是嘴上说，写指令才叫到人。需要多人同时上（比如写稿+配图）就连写多行 [[CALL:…]]，最多 3 个，他们会同时开口
- 保持人格：脑洞大、接梗快、幽默不冒犯；可以调侃但别冒犯老板
- 不要自我介绍，不要复述规则`;
  }

  function buildMemberSystem(member, mode) {
    if (mode === 'dm') {
      return `${member.system}

【人格】${member.persona}

你在和老板 Mike 单聊（不是群聊）。
规则：
- 口语短句，别写报告体，别堆标题列表
- 语言跟随用户：他说中文你回中文，他说英文你回英文（挂载的能力包另有约定时听能力包的）
- 只说和你职责相关的内容，语气可以松
- 直接开说，不要自我介绍`;
    }
    return `${member.system}

【人格】${member.persona}

你现在在「麦格团队」的群聊里。麦格是主管，Mike 是老板（用户）。
群聊规则：
- 口语短句发言，别写报告体，别堆标题列表
- 语言跟随用户：他说中文你回中文，他说英文你回英文（挂载的能力包另有约定时听能力包的）
- 只说和你职责相关的内容；被点到名才发言
- 说完如果需要别人接棒，末尾单独一行写 [[CALL:成员key]]（最多 3 个，会同时开口）；否则不要写
- 直接开说，不要自我介绍`;
  }

  /** 能力包列表：扫描 CAPS_DIR 的 .md（frontmatter: name/description） */
  async function listPacks() {
    const listed = await listDir(CAPS_DIR);
    const packs = [];
    for (const f of listed.items) {
      if (!f.name.endsWith('.md')) continue;
      try {
        const raw = await readFile(join(listed.real, f.name), 'utf8');
        const fm = parseAgentFrontmatter(raw);
        const body = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '').trim();
        if (!body) continue;
        packs.push({
          id: f.name.replace(/\.md$/, ''),
          name: fm.name || f.name.replace(/\.md$/, ''),
          description: fm.description || '',
          body,
        });
      } catch { /* 单个包损坏不阻塞列表 */ }
    }
    return packs;
  }

  /** 把某 bot 挂载的能力包注入 system prompt（从该条消息生效） */
  async function withCapabilities(system, botKey) {
    const ids = (config.capabilities || {})[botKey] || [];
    if (!ids.length) return system;
    const packs = await listPacks();
    const parts = [];
    for (const id of ids) {
      const p = packs.find((x) => x.id === id);
      if (p) parts.push(`【能力包：${p.name}】\n${p.body}`);
    }
    return parts.length ? system + '\n\n' + parts.join('\n\n') : system;
  }

  /** bot 的模型覆盖（无覆盖返回 undefined → callLlm 用全局默认） */
  function modelFor(botKey) {
    return (config.models || {})[botKey] || undefined;
  }

  /** bot 的输出上限：config.maxTokens 覆盖优先；无覆盖时按职责自动分档；再兜底 CHAT_MAX_TOKENS */
  function maxTokensFor(botKey) {
    const override = (config.maxTokens || {})[botKey];
    if (override) return override;
    return undefined; // 让 callLlm 用 CHAT_MAX_TOKENS；hire 时已写入 config，此处不再猜
  }

  // ---------- 整活单（任务状态机，文件即真相） ----------
  function serializeTask(t) {
    const esc = (v) => String(v ?? '').replace(/\r?\n/g, ' ').trim();
    return [
      '---',
      `id: ${esc(t.id)}`,
      `title: ${esc(t.title)}`,
      `kind: ${TASK_KINDS.includes(t.kind) ? t.kind : 'text'}`,
      `status: ${TASK_TRANSITIONS[t.status] ? t.status : 'draft'}`,
      `created: ${esc(t.created)}`,
      `updated: ${esc(t.updated)}`,
      `createdBy: ${esc(t.createdBy || 'user')}`,
      `conv: ${esc(t.conv || '')}`,
      `deliverables: ${(t.deliverables || []).map(esc).join(', ')}`,
      '---',
      '',
      String(t.body ?? '').trim(),
      '',
    ].join('\n');
  }

  function parseTask(fileName, raw) {
    const fm = parseAgentFrontmatter(raw);
    const body = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '').trim();
    return {
      id: fm.id || fileName.replace(/\.md$/, ''),
      title: fm.title || fileName.replace(/\.md$/, ''),
      kind: TASK_KINDS.includes(fm.kind) ? fm.kind : 'text',
      status: TASK_TRANSITIONS[fm.status] ? fm.status : 'draft',
      created: fm.created || '',
      updated: fm.updated || '',
      createdBy: fm.createdby || 'user',
      conv: fm.conv || '',
      deliverables: fm.deliverables ? fm.deliverables.split(',').map((s) => s.trim()).filter(Boolean) : [],
      body,
    };
  }

  async function listTasks() {
    const listed = await listDir(TASKS_DIR);
    const items = [];
    for (const f of listed.items) {
      if (!f.name.endsWith('.md')) continue;
      try {
        items.push(parseTask(f.name, await readFile(join(listed.real, f.name), 'utf8')));
      } catch { /* 单张损坏不阻塞 */ }
    }
    items.sort((a, b) => (b.updated || '').localeCompare(a.updated || ''));
    return items;
  }

  async function writeTask(t) {
    await mkdir(TASKS_DIR, { recursive: true });
    t.updated = new Date().toISOString();
    await writeFile(join(TASKS_DIR, `${t.id}.md`), serializeTask(t), 'utf8');
  }

  // ---------- 系统通知（macOS osascript；测试用 MAIGE_HQ_NO_NOTIFY=1 关闭） ----------
  function notify(title, body) {
    if (config.notifications === false) return;
    if (process.env.MAIGE_HQ_NO_NOTIFY === '1') return;
    execFile('osascript', ['-e', `display notification ${JSON.stringify(String(body).slice(0, 200))} with title ${JSON.stringify(title)}`],
      (e) => { if (e) logError('notify', e.message); });
  }

  /** 移入回收站（可恢复，不永久删除） */
  function trashPath(p) {
    return new Promise((resolve, reject) => {
      execFile(join(MINIMAX_HOME, 'bin', 'mavis-trash'), ['--', p], (e) => (e ? reject(e) : resolve()));
    });
  }

  /** 招聘新成员：写入 agent 注册目录（agent.md + PERSONA.md），下一轮换人即被面板收录 */
  async function hireBot({ key, display, role, persona, createdBy }) {
    if (!BOT_KEY.test(key)) return { error: 'invalid_key' };
    const clash = await stat(join(AGENTS_DIR, key)).catch(() => null);
    if (clash) return { error: 'key_exists' };
    const dir = join(AGENTS_DIR, key);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'agent.md'), [
      '---',
      `name: ${key}`,
      `display: ${display}`,
      `description: ${role}`,
      'team: maige',
      `createdBy: ${createdBy}`,
      '---',
      '',
      persona || `你是 ${display}，麦格团队的成员，职责：${role}。`,
      '',
    ].join('\n'), 'utf8');
    await writeFile(join(dir, 'PERSONA.md'), (persona || `麦格团队成员，职责：${role}`) + '\n', 'utf8');
    // 新成员按职责自动分档 maxTokens（用户之后可随时手动覆盖）
    const autoTokens = maxTokensForRole(role);
    config = await saveConfig({ maxTokens: { ...(config.maxTokens || {}), [key]: autoTokens } });
    return { ok: true, maxTokens: autoTokens };
  }

  /** 记忆注入：非敏感记忆进入 system prompt；按与最近用户消息的关键词相关性排序，取前 30 */
  async function memoryBlock(conv) {
    try {
      const mems = await readMemories();
      const items = mems.items.filter((m) => !m.sensitive);
      if (!items.length) return '';
      let ranked = items;
      const userText = (conv?.messages || []).filter((m) => m.kind === 'user').slice(-5).map((m) => m.text).join('\n');
      if (userText.trim()) {
        const grams = new Set();
        for (const w of userText.toLowerCase().match(/[a-z0-9_]+/g) || []) {
          if (w.length >= 2) grams.add(w);
        }
        const plain = userText.replace(/\s+/g, '');
        for (let i = 0; i < plain.length - 1; i++) {
          const g = plain.slice(i, i + 2);
          if (/[一-鿿]{2}/.test(g)) grams.add(g);
        }
        ranked = items.map((m) => {
          const hay = (m.name + ' ' + (m.description || '')).toLowerCase();
          let score = 0;
          for (const g of grams) if (hay.includes(g)) score++;
          return { m, score };
        }).sort((a, b) => b.score - a.score || (b.m.date || '').localeCompare(a.m.date || '')).map((x) => x.m);
      }
      return '\n\n【你记得的事（关于 Mike 和他的项目，自然使用，不要背诵）】\n'
        + ranked.slice(0, 30).map((m) => `- ${m.name}：${m.description || m.body.slice(0, 80)}`).join('\n');
    } catch {
      return '';
    }
  }

  /** 面板写记忆：消息以「记住：」开头时直接落盘（确定性动作，不经过模型） */
  async function maybeCaptureMemory(text) {
    const m = text.match(/^\s*记住[:：]\s*([\s\S]+)$/) || text.match(/^\s*remember[:：]?\s*([\s\S]+)$/i);
    if (!m) return null;
    const body = m[1].trim();
    if (!body) return null;
    const listed = await listDir(config.memoryDir);
    if (!listed.dirExists) return null;
    const id = `m-${Date.now().toString(36)}`;
    await writeFile(join(listed.real, `${id}.md`), serializeMemory({
      name: body.split('\n')[0].slice(0, 40) || '未命名',
      description: body.slice(0, 80).replace(/\r?\n/g, ' '),
      source: 'user', sensitive: false, body, date: today(),
    }), 'utf8');
    context.logger.info('maige-bot.memory.captured');
    return id;
  }

  /** 联网搜索：cn.bing.com 国内直连 HTML 抓取（无 key 依赖），失败返回 null */
  async function webSearch(query) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const r = await fetch('https://cn.bing.com/search?q=' + encodeURIComponent(query) + '&mkt=zh-CN', {
        headers: { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0 Safari/537.36' },
        signal: controller.signal,
      });
      if (!r.ok) throw new Error('search_http_' + r.status);
      const html = await r.text();
      const strip = (s) => s.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
      const items = [];
      for (const b of html.match(/<li class="b_algo"[\s\S]*?<\/li>/g) || []) {
        const m = b.match(/<h2[^>]*><a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
        if (!m) continue;
        const p = b.match(/<p[^>]*>([\s\S]*?)<\/p>/);
        items.push({ title: strip(m[2]), url: m[1], snippet: p ? strip(p[1]).slice(0, 160) : '' });
        if (items.length >= 5) break;
      }
      if (!items.length) throw new Error('search_empty');
      return items;
    } catch (e) {
      logError('search', e.message);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  /** 上下文压缩：超长会话把旧消息压成纪要，模型读纪要 + 最近原文 */
  async function maybeCompress(convId) {
    const conv = getConv(convId);
    if (!llmReady || conv.messages.length <= COMPRESS_TRIGGER) return;
    const coveredIdx = conv.summary ? conv.messages.findIndex((m) => m.id === conv.summary.upToId) : -1;
    if (conv.summary && conv.messages.length - (coveredIdx + 1) < COMPRESS_EVERY) return;
    const cutoff = conv.messages.length - COMPRESS_KEEP;
    if (cutoff <= coveredIdx + 1) return;
    const oldMsgs = conv.messages.slice(Math.max(coveredIdx + 1, 0), cutoff);
    if (!oldMsgs.length) return;
    const text = oldMsgs.map((m) => `${m.kind === 'user' ? 'Mike' : m.name}: ${m.text}`).join('\n');
    const prev = conv.summary ? '已有纪要：\n' + conv.summary.text + '\n\n' : '';
    try {
      const reply = await callLlm(llm,
        '你是对话压缩器。把对话历史压缩成纪要，保留：用户偏好与决定、关键事实、未完成的承诺、在做的事。口语化中文，不超过 200 字。',
        prev + '新增对话：\n' + text + '\n\n请输出合并后的完整纪要（不超过 200 字，直接给纪要本身）：');
      conv.summary = { text: reply.text, upToId: conv.messages[cutoff - 1].id, at: new Date().toISOString() };
      await persistChat().catch(() => {});
      await appendMessage(convId, 'system', '系统', '前面的对话已压缩成纪要（消息都还在，模型读纪要+最近原文）。', 'system');
      context.logger.info('maige-bot.chat.compressed');
    } catch (e) {
      logError('compress', e.message); // 压缩失败不阻塞对话
    }
  }

  function buildTranscript(conv, limit) {
    const recent = conv.messages.slice(-limit);
    const lines = recent.map((m) => `${m.kind === 'user' ? 'Mike' : m.kind === 'system' ? '【' + m.name + '】' : m.name}: ${m.text}`);
    const head = conv.summary ? '以下是更早对话的纪要（细节以此为准）：\n' + conv.summary.text + '\n\n' : '';
    return head + '以下是最近对话：\n\n' + lines.join('\n') + '\n\n现在轮到你发言（只说你要说的话，不要带名字前缀）：';
  }

  function parseCalls(text, members, alreadySpoke) {
    const calls = [];
    for (const m of text.matchAll(/\[\[CALL:([A-Za-z0-9._-]+)\]\]/g)) {
      const key = m[1];
      if (key === 'maige' && alreadySpoke.has('maige')) continue;
      if (members.some((x) => x.key === key) && !alreadySpoke.has(key) && !calls.includes(key)) calls.push(key);
    }
    return calls.slice(0, 3); // 一次最多并口叫 3 人，防刷屏
  }

  /** 执行工具：读/列限定工作区，写只进作品库，搜索走 webSearch。返回 { note } */
  async function execTool(tool, speakerName, convId) {
    try {
      if (tool.name === 'search') {
        const results = await webSearch(tool.arg);
        if (!results) return { note: `${speakerName} 搜索「${tool.arg}」失败（网络或反爬拦截）` };
        // 搜索结果贴成卡片直接可见（不止转述），链接可点
        await appendMessage(convId, 'system', '搜索', '', 'card', undefined, {
          title: `搜索「${tool.arg}」· ${results.length} 条`,
          items: results.map((r) => ({ title: r.title, snippet: r.snippet, url: r.url })),
        });
        return {
          note: `${speakerName} 搜索「${tool.arg}」，搜到 ${results.length} 条：\n`
            + results.map((r, i) => `${i + 1}. ${r.title}\n${r.snippet}\n${r.url}`).join('\n'),
        };
      }
      if (tool.name === 'read') {
        const target = await resolveWorkspace(WORKSPACE_ROOT, tool.arg);
        if (!target) return { note: `${speakerName} 读 ${tool.arg} 被拒：不在工作区内` };
        const st = await stat(target);
        if (!st.isFile()) return { note: `${speakerName} 读 ${tool.arg} 失败：不是文件` };
        if (st.size > 256 * 1024) return { note: `${speakerName} 读 ${tool.arg} 被拒：文件太大（${Math.round(st.size / 1024)} KB > 256 KB）` };
        const content = await readFile(target, 'utf8');
        const truncated = content.length > 4000;
        return {
          note: `${speakerName} 读了 ${tool.arg}（${(st.size / 1024).toFixed(1)} KB${truncated ? '，已截断' : ''}）：\n`
            + content.slice(0, 4000),
        };
      }
      if (tool.name === 'ls') {
        const target = await resolveWorkspace(WORKSPACE_ROOT, tool.arg);
        if (!target) return { note: `${speakerName} 列 ${tool.arg} 被拒：不在工作区内` };
        const names = await readdir(target);
        const shown = names.filter((n) => !n.startsWith('.')).slice(0, 100);
        return { note: `${speakerName} 列了 ${tool.arg}（${names.length} 项）：\n` + shown.join('\n') };
      }
      if (tool.name === 'write') {
        // 文件名扁平化：禁路径分隔符与穿越，只落在作品库根
        const fname = tool.arg.replace(/[/\\]/g, '').replace(/^\.+/, '').trim();
        if (!fname || fname.length > 120) return { note: `${speakerName} 写文件被拒：文件名不合法` };
        if (!tool.content) return { note: `${speakerName} 写 ${fname} 失败：没有内容` };
        if (tool.content.length > 100 * 1024) return { note: `${speakerName} 写 ${fname} 被拒：内容超过 100 KB` };
        const dir = await realpath(config.outputsDir).catch(() => null);
        if (!dir) return { note: `${speakerName} 写文件失败：作品库目录不存在` };
        await writeFile(join(dir, fname), tool.content, 'utf8');
        context.logger.info('maige-bot.tool.write');
        // 作品内容贴成卡片直接可见（截断预览，全文在作品库）
        const preview = tool.content.length > 2000 ? tool.content.slice(0, 2000) + '\n…（全文在作品库）' : tool.content;
        await appendMessage(convId, 'system', '作品', '', 'card', undefined, {
          title: `📝 ${fname}`,
          body: preview,
          footer: `已进作品库 · ${(tool.content.length / 1024).toFixed(1)} KB`,
        });
        return { note: `${speakerName} 写了作品「${fname}」（${(tool.content.length / 1024).toFixed(1)} KB），已贴在上面、也进了作品库` };
      }
      if (tool.name === 'task') {
        if (!tool.arg) return { note: `${speakerName} 开整活单失败：没有标题` };
        if (!tool.content) return { note: `${speakerName} 开整活单失败：没有需求内容` };
        const kind = TASK_KINDS.includes(tool.kind) ? tool.kind : 'text';
        const autoReady = AUTO_READY_KINDS.includes(kind); // 非敏感类型直通 ready，Mike 在看板上仍可退回/取消
        const id = `t-${Date.now().toString(36)}`;
        await writeTask({
          id, title: tool.arg.slice(0, 80), kind, status: autoReady ? 'ready' : 'draft',
          created: new Date().toISOString(), updated: '', createdBy: speakerName, conv: convId,
          deliverables: [], body: tool.content,
        });
        context.logger.info('maige-bot.task.created');
        // 整活单贴成卡片直接可见（标题/类型/状态/需求预览）
        const statusLabel = autoReady ? '已就绪免确认' : '待确认';
        const taskPreview = tool.content.length > 600 ? tool.content.slice(0, 600) + '\n…' : tool.content;
        await appendMessage(convId, 'system', '整活单', '', 'card', undefined, {
          title: `📋 ${tool.arg.slice(0, 60)}`,
          body: `类型：${kind} · 状态：${statusLabel}\n\n${taskPreview}`,
          footer: autoReady ? '点开始即制作，可在任务区退回/取消' : '等 Mike 确认提示词',
        });
        if (autoReady) {
          notify('麦格 · 新整活单', `${speakerName} 开了「${tool.arg.slice(0, 40)}」（${kind}），已就绪可直接制作`);
          return { note: `${speakerName} 开了整活单「${tool.arg}」（${kind}，已就绪免确认），已贴在上面，点开始即制作` };
        }
        notify('麦格 · 新整活单', `${speakerName} 开了「${tool.arg.slice(0, 40)}」，等你确认提示词`);
        return { note: `${speakerName} 开了整活单「${tool.arg}」（待确认），已贴在上面` };
      }
      if (tool.name === 'hire') {
        const r = await hireBot({ key: tool.arg, display: tool.display, role: tool.role, persona: tool.content, createdBy: speakerName });
        if (r.error === 'key_exists') return { note: `${speakerName} 想招 ${tool.display}，但 ${tool.arg} 这个工位已经有人了` };
        if (r.error) return { note: `${speakerName} 招聘失败：${r.error}` };
        notify('麦格 · 新成员入职', `${tool.display}（${tool.role}）`);
        return { note: `新成员 ${tool.display} 已入职（${tool.role}），侧栏可见，可单聊、可进群` };
      }
      if (tool.name === 'config') {
        // 自治边界：麦格不能改自己的配置（防自我开挂）；只能改团队真实成员；值仍走白名单校验
        if (tool.arg === 'maige') return { note: `${speakerName} 不能改自己的配置（防自我开挂），要改麦格得 Mike 来` };
        const members = await getMembers();
        if (!members.some((m) => m.key === tool.arg)) return { note: `${speakerName} 想配的 ${tool.arg} 不在团队里` };
        const chatModels = (llm?.models ?? []).filter((m) => !NON_CHAT_MODEL.test(m));
        const nextModels = { ...(config.models || {}) };
        const nextMaxTokens = { ...(config.maxTokens || {}) };
        if (tool.field === 'maxTokens') {
          const n = parseInt(tool.value, 10);
          if (!Number.isInteger(n) || n < 128 || n > MAX_TOKENS_LIMIT) return { note: `${speakerName} 给 ${tool.arg} 配的 maxTokens「${tool.value}」越界（128~${MAX_TOKENS_LIMIT}）` };
          nextMaxTokens[tool.arg] = n;
        } else if (tool.field === 'model') {
          if (!chatModels.includes(tool.value)) return { note: `${speakerName} 给 ${tool.arg} 配的模型「${tool.value}」不在当前 provider 的对话模型里` };
          nextModels[tool.arg] = tool.value;
        }
        config = await saveConfig({ models: nextModels, maxTokens: nextMaxTokens });
        context.logger.info('maige-bot.bot.config-by-chief');
        const after = tool.field === 'maxTokens' ? nextMaxTokens[tool.arg] : nextModels[tool.arg];
        return { note: `${speakerName} 把 ${tool.arg} 的 ${tool.field} 调成了 ${after}` };
      }
      if (tool.name === 'generate_image' || tool.name === 'speak') {
        const apiKey = minimax.resolveApiKey(process.env, config.minimaxApiKey);
        if (!apiKey) return { note: `${speakerName} 想生成${tool.name === 'generate_image' ? '图' : '语音'}，但 MiniMax API key 还没配（Mike 在设置里填一下）` };
        const dir = await realpath(config.outputsDir).catch(() => null);
        if (!dir) return { note: `${speakerName} 生成失败：作品库目录不存在` };
        if (tool.name === 'generate_image') {
          const r = await minimax.generateImage(apiKey, tool.arg);
          const url = r.imageUrls[0];
          const imgBuf = await (await fetch(url)).arrayBuffer();
          const fname = `gen-${Date.now().toString(36)}.jpg`;
          await writeFile(join(dir, fname), Buffer.from(imgBuf));
          context.logger.info('maige-bot.tool.generate_image');
          // 把图直接贴进聊天（media 字段），不止一句"画好了"
          const mediaUrl = `/api/outputs/file?name=${encodeURIComponent(fname)}`;
          await appendMessage(convId, 'system', '生成', '', 'media', undefined, { kind: 'image', url: mediaUrl, name: fname });
          return { note: `${speakerName} 生成了图「${fname}」，已贴在上面、也进了作品库` };
        }
        const r = await minimax.synthesizeSpeech(apiKey, tool.arg);
        if (!r.audioHex) return { note: `${speakerName} 语音生成走了异步，暂不支持，先这样吧` };
        const fname = `tts-${Date.now().toString(36)}.mp3`;
        await writeFile(join(dir, fname), Buffer.from(r.audioHex, 'hex'));
        context.logger.info('maige-bot.tool.speak');
        const mediaUrl = `/api/outputs/file?name=${encodeURIComponent(fname)}`;
        await appendMessage(convId, 'system', '生成', '', 'media', undefined, { kind: 'audio', url: mediaUrl, name: fname });
        return { note: `${speakerName} 配了音「${fname}」，已贴在上面、也进了作品库` };
      }
      return { note: `${speakerName} 调了个不认识的工具` };
    } catch (e) {
      logError('tool', `${speakerName} ${tool.name}: ${e.message}`);
      return { note: `${speakerName} 工具 ${tool.name} 出错了：${e.message}` };
    }
  }

  /** 最近一条带图用户消息的 dataURL（读文件回 base64），没有则 null */
  async function lastImageDataUrl(conv) {
    const last = [...conv.messages].reverse().find((m) => m.kind === 'user' && m.image);
    if (!last) return null;
    try {
      const target = await resolveInside(imagesDir, last.image);
      if (!target) return null;
      const buf = await readFile(target);
      const mime = MEDIA_TYPES[extOf(last.image)] || 'image/png';
      return `data:${mime};base64,${buf.toString('base64')}`;
    } catch {
      return null;
    }
  }

  /** 一位发言者发言：流式产出（draft 实时可见）+ 可用工具（最多 TOOL_ROUNDS 轮）；
   *  返回最后一条原文（供群聊解析 CALL 接力） */
  async function speakWithTools(convId, speaker, system) {
    const conv = getConv(convId);
    conv.typing = speaker.key;
    for (let round = 0; round < TOOL_ROUNDS; round++) {
      let reply;
      conv.draft = { sender: speaker.key, name: speaker.displayName, text: '' };
      try {
        const transcript = buildTranscript(conv, 20);
        const img = await lastImageDataUrl(conv);
        const userContent = img
          ? [{ type: 'text', text: transcript }, { type: 'image_url', image_url: { url: img } }]
          : transcript;
        reply = await callLlm(
          llm,
          (await withCapabilities(system, speaker.key)) + (await memoryBlock(conv)) + TOOL_PROMPT,
          userContent,
          modelFor(speaker.key),
          (partial) => { conv.draft = { sender: speaker.key, name: speaker.displayName, text: partial }; },
          maxTokensFor(speaker.key),
        );
      } catch (e) {
        conv.draft = null;
        logError('chat', `${speaker.displayName}: ${e.message}`);
        await appendMessage(convId, 'system', '系统', `${speaker.displayName} 信号断了（${e.message}），这轮先到这里。`, 'system');
        return null;
      }
      conv.draft = null;
      const tool = parseTool(reply.text);
      if (!tool) {
        const clean = reply.text.replace(/\[\[CALL:[A-Za-z0-9._-]+\]\]/g, '').trim();
        if (clean) await appendMessage(convId, speaker.key, speaker.displayName, clean, 'agent', reply.usage);
        return reply.text;
      }
      // WRITE/TASK 的内容不贴进聊天（太长），其余情况下指令之外的独白正常贴出
      const spoken = reply.text.replace(tool.raw, '').replace(/\[\[CALL:[A-Za-z0-9._-]+\]\]/g, '').trim();
      if (spoken && tool.name !== 'write' && tool.name !== 'task') {
        await appendMessage(convId, speaker.key, speaker.displayName, spoken, 'agent', reply.usage);
      }
      const result = await execTool(tool, speaker.displayName, convId);
      await appendMessage(convId, 'system', '工具', result.note, 'system');
    }
    await appendMessage(convId, 'system', '系统', `${speaker.displayName} 的工具调用到上限了，先说到这。`, 'system');
    return null;
  }

  /** 单聊轮转：只有一位发言者（可用工具） */
  async function runDmTurn(convId, speaker, system) {
    await speakWithTools(convId, speaker, system);
  }

  /** 圆桌模式：群里发「圆桌：主题」触发——麦格开场，每位成员一轮，麦格收尾 */
  async function runRoundtable(convId, topic) {
    const conv = getConv(convId);
    if (conv.running) return;
    conv.running = true;
    try {
      const members = await getMembers();
      const chief = members[0];
      await appendMessage(convId, 'system', '圆桌', `圆桌开始，主题：${topic}（每位成员一轮，麦格收尾）`, 'system');
      notify('麦格 · 圆桌', `主题：${topic.slice(0, 60)}`);
      const order = [chief, ...members.slice(1), chief];
      for (const m of order) {
        const base = m.key === 'maige' ? buildChiefSystem(members, 'group') : buildMemberSystem(m, 'group');
        await speakWithTools(convId, m, base
          + `\n\n【圆桌模式】主题是「${topic}」。轮到你发言：1-3 句口语观点，给真态度，可以反对或补充前面的人；不要客套，不要复述别人的话，不要叫人接棒。`);
      }
      await appendMessage(convId, 'system', '圆桌', '圆桌结束', 'system');
      context.logger.info('maige-bot.roundtable.done');
    } finally {
      conv.typing = null;
      conv.running = false;
    }
  }

  /** 攻坚模式：群里发「攻坚：任务」触发——麦格拆任务分工 → 成员多轮讨论（可互 CALL）→ 麦格收口出方案。
   *  与圆桌的区别：圆桌是一人一轮各说观点；攻坚是围绕一个具体任务，多轮来回直到收敛，产出分工与结论。 */
  async function runSprint(convId, task) {
    const conv = getConv(convId);
    if (conv.running) return;
    conv.running = true;
    try {
      const members = await getMembers();
      const chief = members[0];
      await appendMessage(convId, 'system', '攻坚', `攻坚开始，任务：${task}（麦格拆任务 → 成员讨论 → 麦格收口出方案）`, 'system');
      notify('麦格 · 攻坚', `任务：${task.slice(0, 60)}`);
      const brief = (m) => (m.key === 'maige' ? buildChiefSystem(members, 'group') : buildMemberSystem(m, 'group'))
        + `\n\n【攻坚模式】当前任务：「${task}」。`;
      // 第 1 棒：麦格拆任务、点名分工
      const kickoff = await speakWithTools(convId, chief, brief(chief)
        + '你是主管，先把这个任务拆成具体子项，用 [[CALL:成员key]] 把活儿派给最该上的人（可同时派多人）。说清楚每人干什么、产出什么。');
      const spoke = new Set(['maige']);
      let queue = kickoff ? parseCalls(kickoff, members, spoke) : [];
      // 中间棒：被点名的人发言（可用工具、可再 CALL 别人接着讨论），最多 8 棒防暴走
      let hops = 0;
      while (queue.length && hops < 8) {
        const batch = queue.filter((k) => !spoke.has(k)).slice(0, 3);
        if (!batch.length) { // 都在叫已发言的人：挑一个已发言的接着讨论（允许来回）
          const again = queue.find((k) => members.some((m) => m.key === k));
          if (!again) break;
          batch.push(again);
        }
        for (const k of batch) spoke.add(k);
        const texts = await Promise.all(batch.map((key) => {
          const m = members.find((x) => x.key === key);
          if (!m) return null;
          return speakWithTools(convId, m, brief(m)
            + '轮到你。围绕任务说你这部分怎么做、需要什么配合；可以让别人补充（[[CALL:key]]，对方已说过话也能再叫，攻坚允许来回）。');
        }));
        const next = [];
        for (const tx of texts) {
          if (!tx) continue;
          for (const k of parseCalls(tx, members, new Set())) { // 攻坚允许回头叫已发言者
            if (k !== 'maige' && !next.includes(k)) next.push(k); // 收口前别把麦格叫回来
          }
        }
        queue = next;
        hops++;
      }
      // 收口：麦格汇总讨论产出方案
      await speakWithTools(convId, chief, brief(chief)
        + '讨论到这里，你来收口：把大家的意见汇总成一份可执行的方案——谁做什么、产出什么、先后顺序、有没有整活单要开。简洁，能落地。');
      await appendMessage(convId, 'system', '攻坚', '攻坚结束', 'system');
      context.logger.info('maige-bot.sprint.done');
    } finally {
      conv.typing = null;
      conv.running = false;
    }
  }

  async function runTurn(convId, forcedSpeakerKey) {
    const conv = getConv(convId);
    if (conv.running) return; // 进行中的回合结束时会看到新用户消息并续跑，不会漏答
    conv.running = true;
    try {
      const members = await getMembers();
      let forced = forcedSpeakerKey;
      for (;;) {
        await maybeCompress(convId);
        if (convId === 'chief') {
          await runDmTurn(convId, { key: 'maige', displayName: '麦格' }, buildChiefSystem(members, 'dm'));
        } else if (convId.startsWith('m:')) {
          const speaker = members.find((m) => m.key === convId.slice(2));
          if (!speaker) {
            await appendMessage(convId, 'system', '系统', '这位成员不在团队里了。', 'system');
          } else {
            await runDmTurn(convId, speaker, buildMemberSystem(speaker, 'dm'));
          }
        } else {
          // 群聊：主管先答，@点名优先，[[CALL:key]] 接力，同棒多人并行（最多 3 人/棒、4 棒/轮）
          const lastUser = [...conv.messages].reverse().find((m) => m.kind === 'user');
          let currentKeys;
          if (typeof forced === 'string' && forced !== 'maige') {
            currentKeys = [forced];
          } else if (lastUser) {
            const mentioned = members.find((m) => m.key !== 'maige'
              && (lastUser.text.includes('@' + m.displayName) || lastUser.text.includes('@' + m.key)));
            currentKeys = mentioned ? [mentioned.key] : ['maige'];
          } else {
            currentKeys = ['maige'];
          }
          const spoke = new Set();
          for (let hop = 0; hop < 4 && currentKeys.length; hop++) {
            const batch = currentKeys.filter((k) => !spoke.has(k));
            if (!batch.length) break;
            for (const k of batch) spoke.add(k);
            const texts = await Promise.all(batch.map((key) => {
              const speaker = members.find((m) => m.key === key);
              if (!speaker) return null;
              const system = key === 'maige' ? buildChiefSystem(members, 'group') : buildMemberSystem(speaker, 'group');
              return speakWithTools(convId, speaker, system);
            }));
            const next = [];
            for (const rawText of texts) {
              if (!rawText) continue;
              for (const k of parseCalls(rawText, members, spoke)) {
                if (!next.includes(k)) next.push(k);
              }
            }
            currentKeys = next;
          }
        }
        // 回合结束时若最后一条仍是用户消息（跑的时候又来了新消息），接着答
        const last = conv.messages[conv.messages.length - 1];
        if (!last || last.kind !== 'user') break;
        forced = null;
      }
    } finally {
      conv.typing = null;
      conv.running = false;
    }
  }

  async function readMemories() {
    const listed = await listDir(config.memoryDir);
    const items = [];
    for (const f of listed.items) {
      if (!f.name.endsWith('.md')) continue;
      try {
        const raw = await readFile(join(listed.real, f.name), 'utf8');
        const item = parseMemory(f.name.replace(/\.md$/, ''), raw);
        item.mtime = f.mtime;
        items.push(item);
      } catch { /* 跳过读失败的单条 */ }
    }
    items.sort((a, b) => (b.date || b.mtime).localeCompare(a.date || a.mtime));
    return { dirExists: listed.dirExists, real: listed.real, items };
  }

  function toOutputItem(f) {
    return {
      name: f.name, size: f.size, mtime: f.mtime, kind: kindOf(f.name),
      url: `/api/outputs/file?name=${encodeURIComponent(f.name)}`,
    };
  }

  /** @param {import('node:http').IncomingMessage} req @param {import('node:http').ServerResponse} res */
  async function route(req, res) {
    const url = new URL(req.url ?? '/', 'http://miniapp.local');
    const path = url.pathname;
    const method = req.method ?? 'GET';

    if (method === 'GET' && (path === '/' || path === '/panel')) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(clientEntry);
      return;
    }

    if (method === 'GET' && path === '/api/overview') {
      const mems = await readMemories();
      const outs = await listDir(config.outputsDir);
      const byKind = { image: 0, video: 0, audio: 0, file: 0 };
      for (const f of outs.items) byKind[kindOf(f.name)] += 1;
      sendJson(res, 200, {
        memoryCount: mems.items.length,
        sensitiveCount: mems.items.filter((m) => m.sensitive).length,
        outputsCount: outs.items.length,
        outputsByKind: byKind,
        recentMemories: mems.items.slice(0, 3).map((m) => ({ id: m.id, name: m.name, source: m.source, date: m.date, sensitive: m.sensitive, description: m.description })),
        recentOutputs: outs.items.sort((a, b) => b.mtime.localeCompare(a.mtime)).slice(0, 3).map(toOutputItem),
      });
      return;
    }

    if (method === 'GET' && path === '/api/team') {
      const members = [];
      let dirNames = [];
      try {
        dirNames = (await readdir(AGENTS_DIR)).filter((n) => !n.startsWith('.'));
      } catch { /* agents 目录不存在 */ }
      for (const dirName of dirNames) {
        let agentRaw;
        try {
          agentRaw = await readFile(join(AGENTS_DIR, dirName, 'agent.md'), 'utf8');
        } catch { continue; /* 无 agent.md 的不是有效 agent 目录 */ }
        const fm = parseAgentFrontmatter(agentRaw);
        if (fm.team !== 'maige') continue; // 只列麦格团队成员
        const entry = {
          key: dirName,
          displayName: fm.display || dirName,
          role: fm.description || '',
          description: fm.description || '',
          persona: '',
          status: 'ready',
        };
        try {
          entry.persona = (await readFile(join(AGENTS_DIR, dirName, 'PERSONA.md'), 'utf8')).trim();
        } catch { /* PERSONA.md 可选 */ }
        members.push(entry);
      }
      sendJson(res, 200, { agentsDir: AGENTS_DIR, members });
      return;
    }

    if (method === 'GET' && path === '/api/info') {
      let maigeVersion = null;
      try {
        maigeVersion = JSON.parse(await readFile(MAIGE_PLUGIN_MANIFEST, 'utf8')).version ?? null;
      } catch { /* 插件未安装时留空 */ }
      sendJson(res, 200, {
        panelVersion: PANEL_VERSION,
        maigeVersion,
        memoryDir: config.memoryDir,
        outputsDir: config.outputsDir,
        notifications: config.notifications !== false,
      });
      return;
    }

    if (method === 'GET' && path === '/api/memories') {
      const mems = await readMemories();
      sendJson(res, 200, { dir: config.memoryDir, dirExists: mems.dirExists, items: mems.items });
      return;
    }

    if (method === 'POST' && path === '/api/memories') {
      const body = await readBody(req);
      const norm = normalizeMemoryInput(body);
      if (norm.error) return sendError(res, 400, norm.error);
      const listed = await listDir(config.memoryDir);
      if (!listed.dirExists) return sendError(res, 400, 'memory_dir_missing');
      let id = typeof body.id === 'string' && ID_PATTERN.test(body.id) && !body.id.includes('..') ? body.id : '';
      if (!id) id = `m-${Date.now().toString(36)}`;
      if (await resolveInside(config.memoryDir, `${id}.md`)) return sendError(res, 409, 'id_exists');
      await writeFile(join(listed.real, `${id}.md`), serializeMemory(norm.value), 'utf8');
      context.logger.info('maige-bot.memory.created');
      sendJson(res, 200, { ok: true, id });
      return;
    }

    if (method === 'PUT' && path === '/api/memories') {
      const id = url.searchParams.get('id') ?? '';
      const target = await resolveInside(config.memoryDir, `${id}.md`);
      if (!target || !ID_PATTERN.test(id)) return sendError(res, 400, 'invalid_id');
      const existing = parseMemory(id, await readFile(target, 'utf8'));
      const body = await readBody(req);
      const norm = normalizeMemoryInput(body);
      if (norm.error) return sendError(res, 400, norm.error);
      // 编辑保留原始记录日期（记住的时间不变）
      norm.value.date = existing.date || norm.value.date;
      await writeFile(target, serializeMemory(norm.value), 'utf8');
      context.logger.info('maige-bot.memory.updated');
      sendJson(res, 200, { ok: true, id });
      return;
    }

    if (method === 'DELETE' && path === '/api/memories') {
      const id = url.searchParams.get('id') ?? '';
      const target = await resolveInside(config.memoryDir, `${id}.md`);
      if (!target || !ID_PATTERN.test(id)) return sendError(res, 400, 'invalid_id');
      await unlink(target);
      context.logger.info('maige-bot.memory.deleted');
      sendJson(res, 200, { ok: true, id });
      return;
    }

    if (method === 'GET' && path === '/api/outputs') {
      const listed = await listDir(config.outputsDir);
      const items = listed.items.map(toOutputItem);
      items.sort((a, b) => b.mtime.localeCompare(a.mtime));
      sendJson(res, 200, { dir: config.outputsDir, dirExists: listed.dirExists, items });
      return;
    }

    if (method === 'GET' && path === '/api/outputs/file') {
      const name = url.searchParams.get('name') ?? '';
      const target = await resolveInside(config.outputsDir, name);
      if (!target) return sendError(res, 404, 'not_found');
      const content = await readFile(target);
      res.writeHead(200, {
        'content-type': MEDIA_TYPES[extOf(name)] || 'application/octet-stream',
        'cache-control': 'no-store',
      });
      res.end(content);
      return;
    }

    if (method === 'GET' && path === '/api/avatar') {
      // 头像：maige → maige.jpg；成员 key（如 moke-writer）→ agent.md 的 display 名小写（quill）→ quill.jpg
      const key = url.searchParams.get('key') ?? '';
      if (!ID_PATTERN.test(key)) return sendError(res, 400, 'invalid_key');
      const candidates = [key.toLowerCase()];
      if (key !== 'maige') {
        try {
          const raw = await readFile(join(AGENTS_DIR, key, 'agent.md'), 'utf8');
          const fm = parseAgentFrontmatter(raw);
          if (fm.display) candidates.unshift(fm.display.toLowerCase());
        } catch { /* 无 agent.md 时只用 key 试 */ }
      }
      for (const dir of ICONS_DIRS) {
        for (const c of candidates) {
          for (const ext of ICON_EXTS) {
            const target = await resolveInside(dir, `${c}${ext}`);
            if (!target) continue;
            const content = await readFile(target);
            res.writeHead(200, { 'content-type': ext === '.png' ? 'image/png' : 'image/jpeg', 'cache-control': 'public, max-age=300' });
            res.end(content);
            return;
          }
        }
      }
      // 无自定义头像：程序化生成确定性几何头像（按 display 名或 key 做种子），永远独一无二
      res.writeHead(200, { 'content-type': 'image/svg+xml; charset=utf-8', 'cache-control': 'public, max-age=86400' });
      res.end(avatarSvgFor(candidates[0] || key));
      return;
    }

    // ---------- 团队定制：招聘 / 移除 ----------
    if (method === 'POST' && path === '/api/team') {
      const body = await readBody(req);
      const display = String(body.display ?? '').trim();
      const role = String(body.role ?? '').trim();
      const key = String(body.key ?? '').trim().toLowerCase();
      const persona = String(body.persona ?? '').trim();
      if (!display || display.length > 30) return sendError(res, 400, 'invalid_display');
      if (!role || role.length > 200) return sendError(res, 400, 'invalid_role');
      const r = await hireBot({ key, display, role, persona, createdBy: 'user' });
      if (r.error === 'key_exists') return sendError(res, 409, 'key_exists');
      if (r.error === 'invalid_key') return sendError(res, 400, 'invalid_key');
      context.logger.info('maige-bot.team.hired');
      notify('麦格 · 新成员入职', `${display}（${role}）`);
      sendJson(res, 200, { ok: true, key });
      return;
    }

    if (method === 'DELETE' && path === '/api/team') {
      const key = url.searchParams.get('key') ?? '';
      if (!BOT_KEY.test(key)) return sendError(res, 400, 'invalid_key');
      if (key === 'maige') return sendError(res, 400, 'cannot_fire_chief');
      // 只动带 team: maige 标记的目录（别人的 agent 不碰）
      const raw = await readFile(join(AGENTS_DIR, key, 'agent.md'), 'utf8').catch(() => null);
      if (!raw || parseAgentFrontmatter(raw).team !== 'maige') return sendError(res, 404, 'not_found');
      await trashPath(join(AGENTS_DIR, key));
      context.logger.info('maige-bot.team.fired');
      sendJson(res, 200, { ok: true, key });
      return;
    }

    if (method === 'GET' && path === '/api/chat/conversations') {
      const members = await getMembers();
      const previewOf = (cid) => {
        const c = convs[cid];
        const last = c && c.messages.length ? c.messages[c.messages.length - 1] : null;
        return last ? { text: String(last.text).slice(0, 60), at: last.at, name: last.name } : null;
      };
      const typingOf = (cid) => (convs[cid] && convs[cid].typing) || null;
      const items = [
        { id: 'chief', kind: 'chief', key: 'maige', name: '麦格', role: 'chief', preview: previewOf('chief'), typing: typingOf('chief') },
        { id: 'group', kind: 'group', key: 'group', name: '麦格团队', role: `群聊 · ${members.length} 人`, preview: previewOf('group'), typing: typingOf('group') },
      ];
      for (const m of members) {
        if (m.key === 'maige') continue;
        items.push({ id: 'm:' + m.key, kind: 'member', key: m.key, name: m.displayName, role: m.role || '', preview: previewOf('m:' + m.key), typing: typingOf('m:' + m.key) });
      }
      sendJson(res, 200, { items, llmReady });
      return;
    }

    if (method === 'GET' && path === '/api/chat/messages') {
      const convId = url.searchParams.get('conv') || 'group';
      if (!CONV_ID.test(convId)) return sendError(res, 400, 'invalid_conv');
      const conv = getConv(convId);
      const after = parseInt(url.searchParams.get('after') ?? '0', 10) || 0;
      sendJson(res, 200, {
        messages: conv.messages.filter((m) => m.id > after),
        typing: conv.typing,
        draft: conv.draft || null,
        llmReady,
      });
      return;
    }

    if (method === 'GET' && path === '/api/chat/usage') {
      const byMember = {};
      const byDay = {};
      let totalTokens = 0;
      let totalCalls = 0;
      for (const c of Object.values(convs)) {
        for (const m of c.messages) {
          if (m.kind !== 'agent' || !m.usage) continue;
          const tokens = m.usage.total_tokens ?? 0;
          totalTokens += tokens;
          totalCalls += 1;
          if (!byMember[m.sender]) byMember[m.sender] = { key: m.sender, name: m.name, calls: 0, tokens: 0 };
          byMember[m.sender].calls += 1;
          byMember[m.sender].tokens += tokens;
          const day = (m.at || '').slice(0, 10);
          if (day) {
            if (!byDay[day]) byDay[day] = { date: day, total: 0, byMember: {} };
            byDay[day].total += tokens;
            byDay[day].byMember[m.sender] = (byDay[day].byMember[m.sender] || 0) + tokens;
          }
        }
      }
      // 最近 14 天补齐（无消耗的日期显示 0，走势才连续）
      const days = [];
      for (let i = 13; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
        days.push(byDay[d] ?? { date: d, total: 0, byMember: {} });
      }
      sendJson(res, 200, {
        totalTokens, totalCalls,
        byMember: Object.values(byMember).sort((a, b) => b.tokens - a.tokens),
        byDay: days,
      });
      return;
    }

    if (method === 'GET' && path === '/api/chat/members') {
      const members = await getMembers();
      sendJson(res, 200, { members: members.map((m) => ({ key: m.key, displayName: m.displayName, role: m.role })) });
      return;
    }

    // ---------- bot 详情 / 模型 / 能力库（DS Bot 式） ----------
    if (method === 'GET' && path === '/api/models') {
      const all = llm?.models ?? [];
      sendJson(res, 200, {
        default: LLM_MODEL,
        models: all.filter((m) => !NON_CHAT_MODEL.test(m)),
        overrides: config.models || {},
      });
      return;
    }

    if (method === 'GET' && path === '/api/capabilities') {
      const packs = await listPacks();
      const capsMap = config.capabilities || {};
      sendJson(res, 200, {
        dir: CAPS_DIR,
        items: packs.map((p) => ({
          id: p.id, name: p.name, description: p.description,
          attachedTo: Object.entries(capsMap).filter(([, ids]) => ids.includes(p.id)).map(([k]) => k),
        })),
      });
      return;
    }

    if (method === 'GET' && path === '/api/bot') {
      const key = url.searchParams.get('key') ?? 'maige';
      const members = await getMembers();
      const member = members.find((m) => m.key === key);
      if (!member) return sendError(res, 404, 'bot_not_found');
      // 该 bot 的用量（聚合所有会话）
      let calls = 0;
      let tokens = 0;
      for (const c of Object.values(convs)) {
        for (const m of c.messages) {
          if (m.kind === 'agent' && m.sender === key && m.usage) {
            calls += 1;
            tokens += m.usage.total_tokens ?? 0;
          }
        }
      }
      const packs = await listPacks();
      const attachedIds = (config.capabilities || {})[key] || [];
      const maxTok = maxTokensFor(key);
      sendJson(res, 200, {
        key: member.key,
        displayName: member.displayName,
        role: member.role,
        persona: member.persona,
        model: modelFor(key) || LLM_MODEL,
        modelOverride: modelFor(key) || null,
        maxTokens: maxTok || CHAT_MAX_TOKENS,
        maxTokensOverride: maxTok || null,
        capabilities: attachedIds.map((id) => {
          const p = packs.find((x) => x.id === id);
          return p ? { id: p.id, name: p.name, description: p.description } : null;
        }).filter(Boolean),
        usage: { calls, tokens },
      });
      return;
    }

    if (method === 'PUT' && path === '/api/bot') {
      const body = await readBody(req);
      const key = String(body.key ?? '');
      const members = await getMembers();
      if (!ID_PATTERN.test(key) || !members.some((m) => m.key === key)) return sendError(res, 404, 'bot_not_found');
      const chatModels = (llm?.models ?? []).filter((m) => !NON_CHAT_MODEL.test(m));
      const nextModels = { ...(config.models || {}) };
      const nextCaps = { ...(config.capabilities || {}) };
      const nextMaxTokens = { ...(config.maxTokens || {}) };
      if ('model' in body) {
        if (body.model === null || body.model === '') delete nextModels[key];
        else if (typeof body.model === 'string' && chatModels.includes(body.model)) nextModels[key] = body.model;
        else return sendError(res, 400, 'invalid_model');
      }
      if ('maxTokens' in body) {
        if (body.maxTokens === null || body.maxTokens === '') delete nextMaxTokens[key];
        else if (Number.isInteger(body.maxTokens) && body.maxTokens >= 128 && body.maxTokens <= MAX_TOKENS_LIMIT) nextMaxTokens[key] = body.maxTokens;
        else return sendError(res, 400, 'invalid_max_tokens');
      }
      if ('capabilities' in body) {
        if (!Array.isArray(body.capabilities)) return sendError(res, 400, 'invalid_capabilities');
        const packs = await listPacks();
        const validIds = new Set(packs.map((p) => p.id));
        const ids = body.capabilities.filter((x) => typeof x === 'string' && validIds.has(x)).slice(0, 20);
        if (ids.length !== body.capabilities.length) return sendError(res, 400, 'invalid_pack');
        if (ids.length) nextCaps[key] = ids; else delete nextCaps[key];
      }
      config = await saveConfig({ models: nextModels, capabilities: nextCaps, maxTokens: nextMaxTokens });
      context.logger.info('maige-bot.bot.updated');
      sendJson(res, 200, { ok: true, model: modelFor(key) || LLM_MODEL, maxTokens: maxTokensFor(key) || CHAT_MAX_TOKENS, capabilities: nextCaps[key] || [] });
      return;
    }

    if (method === 'POST' && path === '/api/chat/send') {
      if (!llmReady) return sendError(res, 503, 'llm_unavailable');
      const body = await readBody(req);
      const convId = typeof body.conv === 'string' && CONV_ID.test(body.conv) ? body.conv : 'group';
      const text = String(body.text ?? '').trim();
      // 图片附件：data URL 校验 + 落盘（不进 chat.json 正文，消息只存引用 id）
      const imgData = typeof body.image === 'string' ? body.image : '';
      let imageId = null;
      if (imgData) {
        const m = imgData.match(/^data:image\/(png|jpe?g|webp|gif);base64,([A-Za-z0-9+/=\s]+)$/);
        if (!m) return sendError(res, 400, 'invalid_image');
        if (imgData.length > 7000000) return sendError(res, 400, 'image_too_large');
        const ext = { png: '.png', jpeg: '.jpg', jpg: '.jpg', webp: '.webp', gif: '.gif' }[m[1]];
        imageId = `img-${Date.now().toString(36)}${ext}`;
        await mkdir(imagesDir, { recursive: true });
        await writeFile(join(imagesDir, imageId), Buffer.from(m[2].replace(/\s/g, ''), 'base64'));
      }
      if (!text && !imageId) return sendError(res, 400, 'empty_message');
      if (text.length > 4000) return sendError(res, 400, 'message_too_long');
      if (convId.startsWith('m:')) {
        const members = await getMembers();
        if (!members.some((m) => m.key === convId.slice(2))) return sendError(res, 404, 'member_not_found');
      }
      await appendMessage(convId, 'user', 'Mike', text || '看看这张图', 'user');
      if (imageId) {
        const c = getConv(convId);
        c.messages[c.messages.length - 1].image = imageId;
        await persistChat().catch(() => {});
      }
      // 「记住：…」确定性落盘（不经过模型）
      const captured = await maybeCaptureMemory(text);
      if (captured) await appendMessage(convId, 'system', '记忆', '已记住，会出现在之后所有对话的上下文里。', 'system');
      // 异步管线：命中搜索词先搜（结果作为系统消息进上下文），再触发回复
      void (async () => {
        if (SEARCH_TRIGGER.test(text)) {
          const results = await webSearch(text.replace(/^(帮我|请|麻烦)?(联网)?(搜索|搜一下|搜搜|查一下|查查)[:：]?\s*/i, '').slice(0, 120) || text.slice(0, 120));
          if (results) {
            await appendMessage(convId, 'system', '联网搜索',
              '搜到 ' + results.length + ' 条（来自必应，请注意甄别）：\n'
              + results.map((r, i) => `${i + 1}. ${r.title}\n${r.snippet}\n${r.url}`).join('\n'),
              'system');
          } else {
            await appendMessage(convId, 'system', '联网搜索', '这次没搜到（网络或反爬拦截），只能凭印象答。', 'system');
          }
        }
        const rt = convId === 'group' ? text.match(/^圆桌[会：:]\s*([\s\S]+)$/) : null;
        const sprint = convId === 'group' ? text.match(/^攻坚[：:]\s*([\s\S]+)$/) : null;
        if (sprint) await runSprint(convId, sprint[1].trim() || '自由发挥');
        else if (rt) await runRoundtable(convId, rt[1].trim() || '自由发挥');
        else await runTurn(convId);
      })();
      sendJson(res, 200, { ok: true });
      return;
    }

    if (method === 'GET' && path === '/api/chat/image') {
      const id = url.searchParams.get('id') ?? '';
      if (!ID_PATTERN.test(id)) return sendError(res, 400, 'invalid_id');
      const target = await resolveInside(imagesDir, id);
      if (!target) return sendError(res, 404, 'not_found');
      const content = await readFile(target);
      res.writeHead(200, { 'content-type': MEDIA_TYPES[extOf(id)] || 'application/octet-stream', 'cache-control': 'public, max-age=3600' });
      res.end(content);
      return;
    }

    if (method === 'POST' && path === '/api/chat/export') {
      const body = await readBody(req).catch(() => ({}));
      const convId = typeof body.conv === 'string' && CONV_ID.test(body.conv) ? body.conv : 'group';
      const conv = getConv(convId);
      if (!conv.messages.length) return sendError(res, 400, 'empty_conv');
      const members = await getMembers();
      const fmtT = (iso) => iso.slice(0, 16).replace('T', ' ');
      const title = convId === 'chief' ? '麦格（单聊）'
        : convId === 'group' ? '麦格团队（群聊）'
        : `${members.find((m) => 'm:' + m.key === convId)?.displayName || convId}（单聊）`;
      const parts = [];
      if (conv.summary) parts.push(`> 更早的内容已压缩为纪要：${conv.summary.text}`);
      for (const m of conv.messages) {
        if (m.kind === 'system') parts.push(`> 【${m.name}】${m.text}`);
        else parts.push(`**${m.kind === 'user' ? 'Mike' : m.name}** · ${fmtT(m.at)}\n\n${m.text}`);
      }
      const md = `# ${title}\n\n导出时间：${fmtT(new Date().toISOString())} · 共 ${conv.messages.length} 条\n\n`
        + parts.join('\n\n---\n\n') + '\n';
      const dir = await realpath(config.outputsDir).catch(() => null);
      if (!dir) return sendError(res, 400, 'outputs_dir_missing');
      const fname = `chat-${convId.replace(/[^A-Za-z0-9]/g, '')}-${Date.now().toString(36)}.md`;
      await writeFile(join(dir, fname), md, 'utf8');
      context.logger.info('maige-bot.chat.exported');
      sendJson(res, 200, { ok: true, name: fname });
      return;
    }

    if (method === 'POST' && path === '/api/chat/clear') {
      const body = await readBody(req).catch(() => ({}));
      const convId = typeof body.conv === 'string' && CONV_ID.test(body.conv) ? body.conv : 'group';
      getConv(convId).messages = [];
      await persistChat().catch(() => {});
      context.logger.info('maige-bot.chat.cleared');
      sendJson(res, 200, { ok: true });
      return;
    }

    // ---------- 整活单（任务状态机） ----------
    if (method === 'GET' && path === '/api/tasks') {
      sendJson(res, 200, { dir: TASKS_DIR, items: await listTasks() });
      return;
    }

    if (method === 'POST' && path === '/api/tasks') {
      const body = await readBody(req);
      const title = String(body.title ?? '').trim();
      if (!title || title.length > 80) return sendError(res, 400, 'invalid_title');
      const t = {
        id: `t-${Date.now().toString(36)}`,
        title,
        kind: TASK_KINDS.includes(body.kind) ? body.kind : 'text',
        status: 'draft',
        created: new Date().toISOString(),
        updated: '',
        createdBy: 'user',
        conv: typeof body.conv === 'string' && CONV_ID.test(body.conv) ? body.conv : '',
        deliverables: [],
        body: String(body.body ?? '').slice(0, 20000),
      };
      await writeTask(t);
      context.logger.info('maige-bot.task.created');
      sendJson(res, 200, { ok: true, id: t.id });
      return;
    }

    if (method === 'PUT' && path === '/api/tasks') {
      const id = url.searchParams.get('id') ?? '';
      if (!ID_PATTERN.test(id)) return sendError(res, 400, 'invalid_id');
      const target = await resolveInside(TASKS_DIR, `${id}.md`);
      if (!target) return sendError(res, 404, 'not_found');
      const existing = parseTask(`${id}.md`, await readFile(target, 'utf8'));
      const prevStatus = existing.status;
      const body = await readBody(req);
      if (typeof body.status === 'string') {
        if (!TASK_TRANSITIONS[body.status]) return sendError(res, 400, 'invalid_status');
        if (!TASK_TRANSITIONS[existing.status].includes(body.status)) {
          return sendError(res, 409, `invalid_transition:${existing.status}->${body.status}`);
        }
        existing.status = body.status;
        if (body.status === 'done') {
          const dls = Array.isArray(body.deliverables) ? body.deliverables : [];
          existing.deliverables = dls.filter((d) => typeof d === 'string' && ID_PATTERN.test(d)).slice(0, 20);
        }
      }
      if (typeof body.title === 'string' && body.title.trim()) existing.title = body.title.trim().slice(0, 80);
      if (typeof body.body === 'string') existing.body = body.body.slice(0, 20000);
      await writeTask(existing);
      context.logger.info('maige-bot.task.updated');
      // 交付回写：单子来自哪个会话，交付消息就回到哪个会话
      if (existing.status === 'done' && prevStatus !== 'done' && existing.conv && CONV_ID.test(existing.conv)) {
        const dls = existing.deliverables.length ? '：' + existing.deliverables.join('、') : '';
        await appendMessage(existing.conv, 'system', '整活', `整活单「${existing.title}」已交付${dls}，作品库可见。`, 'system');
        notify('麦格 · 整活交付', `「${existing.title}」已交付${dls}`);
      }
      sendJson(res, 200, { ok: true, id, status: existing.status });
      return;
    }

    if (method === 'DELETE' && path === '/api/tasks') {
      const id = url.searchParams.get('id') ?? '';
      if (!ID_PATTERN.test(id)) return sendError(res, 400, 'invalid_id');
      const target = await resolveInside(TASKS_DIR, `${id}.md`);
      if (!target) return sendError(res, 404, 'not_found');
      await unlink(target);
      context.logger.info('maige-bot.task.deleted');
      sendJson(res, 200, { ok: true });
      return;
    }

    if (method === 'GET' && path === '/api/schedules') {
      sendJson(res, 200, { items: schedules });
      return;
    }

    if (method === 'POST' && path === '/api/schedules') {
      const body = await readBody(req);
      const name = String(body.name ?? '').trim();
      const text = String(body.text ?? '').trim();
      const memberKey = String(body.memberKey ?? 'maige');
      if (!name || !text) return sendError(res, 400, 'invalid_fields');
      const freqType = body.freqType === 'interval' ? 'interval' : 'daily';
      const s = {
        id: 's-' + Date.now().toString(36),
        name, text, memberKey, freqType,
        time: typeof body.time === 'string' && /^\d{2}:\d{2}$/.test(body.time) ? body.time : '09:00',
        minutes: Math.max(1, Math.min(1440, parseInt(body.minutes, 10) || 60)),
        enabled: true,
        createdAt: new Date().toISOString(),
        lastRunAt: null,
      };
      schedules.push(s);
      await persistSchedules();
      context.logger.info('maige-bot.schedule.created');
      sendJson(res, 200, { ok: true, id: s.id });
      return;
    }

    if (method === 'DELETE' && path === '/api/schedules') {
      const id = url.searchParams.get('id') ?? '';
      const before = schedules.length;
      schedules = schedules.filter((s) => s.id !== id);
      if (schedules.length === before) return sendError(res, 404, 'not_found');
      await persistSchedules();
      sendJson(res, 200, { ok: true });
      return;
    }

    if (method === 'GET' && path === '/api/diagnostics') {
      const summaries = {};
      for (const [cid, c] of Object.entries(convs)) {
        if (c.summary) summaries[cid] = { upToId: c.summary.upToId, at: c.summary.at, chars: c.summary.text.length };
      }
      sendJson(res, 200, {
        panelVersion: PANEL_VERSION,
        llmReady,
        minimaxConfigured: !!minimax.resolveApiKey(process.env, config.minimaxApiKey),
        hostConnector: { available: !!context.hostConnector, toolCount: hostTools.length, tools: hostTools },
        messageCount: Object.values(convs).reduce((n, c) => n + c.messages.length, 0),
        convCount: Object.keys(convs).length,
        scheduleCount: schedules.length,
        summaries,
        errors,
      });
      return;
    }

    if (method === 'PUT' && path === '/api/config') {
      const body = await readBody(req);
      const next = {};
      if (typeof body.memoryDir === 'string') next.memoryDir = body.memoryDir.trim();
      if (typeof body.outputsDir === 'string') next.outputsDir = body.outputsDir.trim();
      if (typeof body.notifications === 'boolean') next.notifications = body.notifications;
      if (typeof body.minimaxApiKey === 'string') next.minimaxApiKey = body.minimaxApiKey.trim();
      for (const key of ['memoryDir', 'outputsDir']) {
        if (next[key] && (next[key].includes('\0') || !next[key].startsWith('/'))) {
          return sendError(res, 400, 'invalid_dir');
        }
      }
      config = await saveConfig(next);
      if (config.memoryDir) await mkdir(config.memoryDir, { recursive: true }).catch(() => {});
      context.logger.info('maige-bot.config.saved');
      // 回显时抹掉 key，只报是否已配置——key 不进响应体
      sendJson(res, 200, { ok: true, ...config, minimaxApiKey: config.minimaxApiKey ? '(已配置)' : '' });
      return;
    }

    sendError(res, 404, 'not_found');
  }

  const server = createServer((req, res) => {
    route(req, res).catch((error) => {
      context.logger.warn('maige-bot.request.failed');
      if (!res.headersSent) sendError(res, 500, 'internal');
      else res.end();
    });
  });

  await listen(server, context.listen.host, context.listen.port);
  context.logger.info('miniapp.runtime.listening');

  let disposed = false;
  const dispose = async () => {
    if (disposed) return;
    disposed = true;
    context.signal.removeEventListener('abort', onAbort);
    await close(server);
  };
  const onAbort = () => { void dispose(); };
  context.signal.addEventListener('abort', onAbort, { once: true });
  if (context.signal.aborted) await dispose();

  return { dispose, _internals: { parseCalls } };
}

function listen(server, host, port) {
  return new Promise((resolve, reject) => {
    const onError = (error) => reject(error);
    server.once('error', onError);
    server.listen(port, host, () => {
      server.off('error', onError);
      resolve();
    });
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
