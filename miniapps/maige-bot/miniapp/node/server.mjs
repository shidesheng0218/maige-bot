// @ts-check
// 麦格面板 Node 服务：概览 + 记忆 CRUD + 作品库（预览）+ 设置（版本号见 PANEL_VERSION / plugin.json）
// 数据源：本地授权目录（记忆目录 / 作品目录 / maige-bot 插件根只读版本号）。
// 安全：所有文件访问经 realpath 校验，fail-closed 限定在授权目录内；不做任意文件系统代理。

import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { readFile, readdir, stat, unlink, realpath, mkdir, writeFile, chmod } from 'node:fs/promises';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import * as minimax from './minimax.mjs';
import {
  resolveHostPaths, parseLlmYaml, mergeProviders, defaultProviderId,
  splitModelRef, joinModelRef, normalizeProvider, chatModelsOf,
} from './core/host.mjs';
import {
  parseTool, parseCalls, parseAgentFrontmatter, parseMemory,
  serializeMemory, normalizeMemoryInput, today, ID_PATTERN,
} from './core/parse.mjs';
import { avatarSvgFor, kindOf, extOf, MEDIA_TYPES } from './core/avatar.mjs';
import { maxTokensForRole, MAX_TOKENS_LIMIT } from './core/roles.mjs';
import { CHAT_MAX_TOKENS, NON_CHAT_MODEL } from './core/llm.mjs';
import { normalizeBudget } from './core/budget.mjs';
import { sendJson, sendError, readBody } from './core/http.mjs';
import { resolveWorkspace, resolveInside, listDir } from './core/fs.mjs';
import { TASK_TRANSITIONS, TASK_KINDS, serializeTask, parseTask } from './core/tasks.mjs';
import { createToolExecutor } from './core/tools.mjs';
import { createOrchestrator } from './core/orchestrator.mjs';

// 向后兼容：测试与外部脚本从 server.mjs 导入这些纯函数
export { parseTool, parseCalls, resolveWorkspace, avatarSvgFor, maxTokensForRole };
export { parseAgentFrontmatter, parseMemory, serializeMemory, normalizeMemoryInput, parseTask, serializeTask };

/** @typedef {import('./miniapp-api.js').MiniAppContext} MiniAppContext */
/** @typedef {import('./miniapp-api.js').MiniAppLifecycle} MiniAppLifecycle */

// 宿主路径全部经适配层解析（可被 MAIGE_* 环境变量覆盖，非 MCode 环境同样可跑）
const HOST = resolveHostPaths();
const DEFAULTS = { memoryDir: HOST.memoryDir, outputsDir: HOST.outputsDir };
const MAIGE_PLUGIN_MANIFEST = HOST.pluginManifest;
const AGENTS_DIR = HOST.agentsDir;
const ICONS_DIRS = HOST.iconsDirs;
const ICON_EXTS = ['.png', '.jpg'];

// ================= 群聊引擎 =================
// 模型来源：宿主适配层（config.yaml 的 OpenAI 兼容 provider，或 MAIGE_LLM_* 环境变量）。
// 凭据只留在 Node 进程，不进 Client、不进日志。

const PANEL_VERSION = '0.26.0';
// 新成员 key 规则（agent 目录名）：小写字母开头，小写字母/数字/连字符
const BOT_KEY = /^[a-z][a-z0-9-]{2,30}$/;
// 整活单（任务）：文件存储在 maige-bot/tasks/，面板与 MCode 会话共享同一目录（交接靠文件，不靠 API）
const TASKS_DIR = HOST.tasksDir;
// 工具层：bot 回复里的指令由服务端解析执行（[[SEARCH]]/[[READ]]/[[LS]]/[[WRITE]]），
// 结果作为【工具】系统消息回注上下文，同一人接着说。每位发言者最多 TOOL_ROUNDS 轮。
const TOOL_ROUNDS = 3;
const WORKSPACE_ROOT = HOST.workspaceRoot;
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
const CAPS_DIR = HOST.capsDir;

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
        providers: sanitizeProviders(raw.providers),
        budget: normalizeBudget(raw.budget),
        notifications: raw.notifications !== false,
        minimaxApiKey: typeof raw.minimaxApiKey === 'string' ? raw.minimaxApiKey.trim() : '',
      };
    } catch {
      return { ...DEFAULTS, models: {}, capabilities: {}, maxTokens: {}, providers: [], budget: normalizeBudget(), notifications: true, minimaxApiKey: '' };
    }
  }

  /** 用户自配 provider 列表（白名单化，key 只留在这里） */
  function sanitizeProviders(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.map((p) => normalizeProvider(p)).filter(Boolean).slice(0, 10);
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
    await writeFile(configPath, JSON.stringify(merged, null, 2), { encoding: 'utf8', mode: 0o600 });
    // mode 只在创建时生效；已存在的文件要显式收紧（配置里可能有 MiniMax API key）
    await chmod(configPath, 0o600).catch(() => {});
    return merged;
  }

  let config = await loadConfig();
  await mkdir(config.memoryDir, { recursive: true }).catch(() => {});
  // 存量配置里可能已有 API key：启动时收紧权限（仅当前用户可读写）
  await chmod(configPath, 0o600).catch(() => {});

  // ================= 聊天状态（多会话，DS Bot 式） =================
  // 会话 id：'chief'=与麦格单聊，'group'=团队群聊，'m:<成员key>'=与成员单聊。
  // 模型来源（自带模型）：用户配置的 providers 优先，其次 MCode 的 config.yaml，最后环境变量。
  let builtinMCode = null;
  try {
    builtinMCode = parseLlmYaml(readFileSync(HOST.minimaxConfigYaml, 'utf8'));
  } catch { /* 没装 MCode 或没有 config.yaml：纯用户自配模式 */ }
  const envProvider = process.env.MAIGE_LLM_BASE_URL && process.env.MAIGE_LLM_API_KEY
    ? { baseURL: process.env.MAIGE_LLM_BASE_URL, apiKey: process.env.MAIGE_LLM_API_KEY, models: String(process.env.MAIGE_LLM_MODELS || '').split(',').map((s) => s.trim()).filter(Boolean) }
    : null;
  /** 全部可用 provider（用户配置 + 内建） */
  function getProviders() {
    return mergeProviders(config.providers || [], builtinMCode, envProvider);
  }
  function defaultProvider() {
    const list = getProviders();
    if (!list.length) return null;
    return list.find((p) => !p.builtin) || list[0];
  }
  /** 解析某个 bot 该用哪个 provider + 模型（配置值支持 'provider/model' 与旧版裸 model id） */
  function resolveModelFor(botKey) {
    const providers = getProviders();
    if (!providers.length) return null;
    const def = defaultProvider();
    const ref = (config.models || {})[botKey];
    if (!ref) {
      return { provider: def, model: def.defaultModel || def.models?.[0] || '', ref: null };
    }
    const parsed = splitModelRef(ref, def.id);
    const provider = providers.find((p) => p.id === parsed.providerId) || def;
    return { provider, model: parsed.model || provider.defaultModel || provider.models?.[0] || '', ref };
  }
  // 动态判定：用户随时新增 provider，面板立刻可用（不是启动时算一次）
  const llmReady = () => getProviders().length > 0;
  /** 当前回合预算（用户可配；0 = 不限） */
  const getBudget = () => normalizeBudget(config.budget);
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
    wf(join(HOST.root, 'maige-bot', 'data', 'host-tools.json'), JSON.stringify({
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
      if (llmReady()) {
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

  /** bot 的输出上限：config.maxTokens 覆盖优先；无覆盖时按职责自动分档；再兜底 CHAT_MAX_TOKENS */
  function maxTokensFor(botKey) {
    const override = (config.maxTokens || {})[botKey];
    if (override) return override;
    return undefined; // 让 callLlm 用 CHAT_MAX_TOKENS；hire 时已写入 config，此处不再猜
  }

  // ---------- 整活单（任务状态机，文件即真相） ----------
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
      execFile(join(HOST.minimaxHome, 'bin', 'mavis-trash'), ['--', p], (e) => (e ? reject(e) : resolve()));
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

  /** 联网搜索：多源降级（必应 → 搜狗 → DuckDuckGo），全部免费无 key。
   *  每个源独立超时/解析；只保留 http(s) 链接（防 javascript: 等协议注入）。
   *  返回 { engine, items } 或 null（全挂时调用方要如实说"没搜到"）。 */
  const SEARCH_ENGINES = [
    {
      name: '必应',
      url: (q) => 'https://cn.bing.com/search?q=' + encodeURIComponent(q) + '&mkt=zh-CN',
      parse(html, strip) {
        const items = [];
        for (const b of html.match(/<li class="b_algo"[\s\S]*?<\/li>/g) || []) {
          const m = b.match(/<h2[^>]*><a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
          if (!m) continue;
          const p = b.match(/<p[^>]*>([\s\S]*?)<\/p>/);
          items.push({ title: strip(m[2]), url: m[1], snippet: p ? strip(p[1]).slice(0, 160) : '' });
          if (items.length >= 5) break;
        }
        return items;
      },
    },
    {
      name: '搜狗',
      url: (q) => 'https://www.sogou.com/web?query=' + encodeURIComponent(q),
      parse(html, strip, base) {
        const items = [];
        for (const b of html.match(/<h3[^>]*class="vr-title"[\s\S]*?<\/h3>/g) || []) {
          const m = b.match(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
          if (!m) continue;
          let url = m[1];
          if (url.startsWith('/')) url = new URL(url, base).href; // 搜狗跳转链接
          items.push({ title: strip(m[2]), url, snippet: '' });
          if (items.length >= 5) break;
        }
        return items;
      },
    },
    {
      name: 'DuckDuckGo',
      url: (q) => 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(q),
      parse(html, strip) {
        const items = [];
        for (const b of html.match(/<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g) || []) {
          const m = b.match(/href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
          if (!m) continue;
          items.push({ title: strip(m[2]), url: m[1], snippet: '' });
          if (items.length >= 5) break;
        }
        return items;
      },
    },
  ];

  const HTTP_URL = /^https?:\/\//i;

  async function fetchSearchEngine(engine, query) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    try {
      const r = await fetch(engine.url(query), {
        headers: { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0 Safari/537.36' },
        signal: controller.signal,
      });
      if (!r.ok) throw new Error('http_' + r.status);
      const html = await r.text();
      const strip = (s) => s.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
      return engine.parse(html, strip, engine.url(query))
        .filter((it) => HTTP_URL.test(it.url || '')); // 协议白名单：只放行 http(s)
    } finally {
      clearTimeout(timer);
    }
  }

  async function webSearch(query) {
    for (const engine of SEARCH_ENGINES) {
      try {
        const items = await fetchSearchEngine(engine, query);
        if (items.length) return { engine: engine.name, items };
      } catch (e) {
        logError('search', `${engine.name}: ${e.message}`); // 单源失败静默降级
      }
    }
    return null;
  }

  /** 上下文压缩：超长会话把旧消息压成纪要，模型读纪要 + 最近原文 */
  /** 消息的可读文本：media/card 消息没有正文，用占位描述，避免空行污染上下文与纪要 */
  // 工具执行器（工厂注入运行时状态；实现见 core/tools.mjs）
  const execTool = createToolExecutor({
    getConfig: () => config,
    updateConfig: async (patch) => { config = await saveConfig(patch); return config; },
    context, appendMessage, getMembers, hireBot, writeTask, notify, webSearch, logError,
    workspaceRoot: WORKSPACE_ROOT,
    listProviders: getProviders,
    splitModelRef, joinModelRef,
  });

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

  // 多 agent 编排器（工厂注入运行时状态；实现见 core/orchestrator.mjs）
  const {
    speakWithTools, runDmTurn, runRoundtable, runSprint, runTurn, maybeCompress,
    cancelTurn, isRunning, turnInfo,
  } = createOrchestrator({
    getConv, appendMessage, getMembers, buildChiefSystem, buildMemberSystem,
    withCapabilities, memoryBlock, resolveModelFor, defaultProvider, maxTokensFor, execTool, lastImageDataUrl,
    persistChat, logError, notify, context,
    TOOL_PROMPT, TOOL_ROUNDS, COMPRESS_TRIGGER, COMPRESS_KEEP, COMPRESS_EVERY,
    getBudget,
  });


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

    // ---------- 来源校验（防浏览器跨站 CSRF） ----------
    // 本服务无鉴权，任何本机进程/网页都可能打它。判定依据：
    //  · 浏览器发跨站简单请求时必带 Origin，且带不了自定义头（带即触发 preflight，我们不响应 CORS）
    //  · curl / 宿主服务端调用不带 Origin —— 不是 CSRF 载体，放行
    // 所以：带 Origin 的写请求必须带 x-maige-csrf 头；带 body 的写请求必须是 JSON。
    if (method !== 'GET' && method !== 'HEAD') {
      const origin = req.headers.origin;
      if (origin && req.headers['x-maige-csrf'] !== '1') {
        logError('security', `blocked_origin: ${String(origin).slice(0, 120)} ${method} ${path}`);
        return sendError(res, 403, 'forbidden_origin');
      }
      const contentLength = parseInt(req.headers['content-length'] || '0', 10) || 0;
      const contentType = String(req.headers['content-type'] || '');
      if (contentLength > 0 && !/^application\/json\b/i.test(contentType)) {
        logError('security', `blocked_content_type: ${contentType.slice(0, 80)} ${method} ${path}`);
        return sendError(res, 415, 'unsupported_media_type');
      }
    }

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
        budget: getBudget(),
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
      sendJson(res, 200, { items, llmReady: llmReady() });
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
        running: isRunning(convId),
        turn: turnInfo(convId),
        llmReady: llmReady(),
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
      const providers = getProviders();
      const def = defaultProvider();
      sendJson(res, 200, {
        default: def ? joinModelRef(def.id, def.defaultModel || def.models?.[0] || '') : '',
        defaultProvider: def ? def.id : '',
        providers: providers.map((p) => ({
          id: p.id, name: p.name, baseURL: p.baseURL, builtin: p.builtin, hasKey: !!p.apiKey,
          models: chatModelsOf(p, NON_CHAT_MODEL), defaultModel: p.defaultModel,
        })),
        // 兼容旧客户端：扁平模型列表
        models: providers.flatMap((p) => chatModelsOf(p, NON_CHAT_MODEL).map((m) => joinModelRef(p.id, m))),
        overrides: config.models || {},
      });
      return;
    }

    // ---------- 自带模型服务（providers） ----------
    if (method === 'GET' && path === '/api/providers') {
      const providers = getProviders();
      const def = defaultProvider();
      sendJson(res, 200, {
        defaultProvider: def ? def.id : '',
        items: providers.map((p) => ({
          id: p.id, name: p.name, baseURL: p.baseURL, builtin: p.builtin, hasKey: !!p.apiKey,
          models: chatModelsOf(p, NON_CHAT_MODEL), defaultModel: p.defaultModel, thinking: p.thinking, streamUsage: p.streamUsage,
          authHeader: p.authHeader, authPrefix: p.authPrefix,
        })),
      });
      return;
    }

    if (method === 'POST' && path === '/api/providers') {
      const body = await readBody(req);
      const p = normalizeProvider(body);
      if (!p) return sendError(res, 400, 'invalid_provider');
      if (p.builtin) return sendError(res, 400, 'builtin_provider');
      if (p.id === 'mcode' || p.id === 'env') return sendError(res, 400, 'reserved_provider_id'); // 保留 id 给内建服务
      const list = (config.providers || []).filter((x) => x.id !== p.id);
      if (list.length >= 10) return sendError(res, 400, 'too_many_providers');
      config = await saveConfig({ providers: [...list, p] });
      context.logger.info('maige-bot.provider.added', { id: p.id });
      sendJson(res, 200, { ok: true, id: p.id });
      return;
    }

    if (method === 'PUT' && path === '/api/providers') {
      const body = await readBody(req);
      const id = String(body.id ?? '').trim().toLowerCase();
      const list = config.providers || [];
      const existing = list.find((x) => x.id === id);
      if (!existing) return sendError(res, 404, 'provider_not_found');
      const merged = normalizeProvider({ ...existing, ...body, id });
      if (!merged) return sendError(res, 400, 'invalid_provider');
      config = await saveConfig({ providers: list.map((x) => (x.id === id ? merged : x)) });
      context.logger.info('maige-bot.provider.updated', { id });
      sendJson(res, 200, { ok: true, id });
      return;
    }

    if (method === 'DELETE' && path === '/api/providers') {
      const id = url.searchParams.get('id') ?? '';
      const list = config.providers || [];
      if (!list.some((x) => x.id === id)) return sendError(res, 404, 'provider_not_found');
      // 被 bot 引用时先解除引用，避免留下悬空配置
      const nextModels = { ...(config.models || {}) };
      for (const [bot, ref] of Object.entries(nextModels)) {
        if (String(ref).startsWith(id + '/')) delete nextModels[bot];
      }
      config = await saveConfig({ providers: list.filter((x) => x.id !== id), models: nextModels });
      context.logger.info('maige-bot.provider.removed', { id });
      sendJson(res, 200, { ok: true, id });
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
      const sel = resolveModelFor(key);
      sendJson(res, 200, {
        key: member.key,
        displayName: member.displayName,
        role: member.role,
        persona: member.persona,
        model: sel ? joinModelRef(sel.provider.id, sel.model) : '',
        modelOverride: sel && sel.ref ? sel.ref : null,
        provider: sel ? sel.provider.id : '',
        providerName: sel ? sel.provider.name : '',
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
      const providers = getProviders();
      const defId = defaultProviderId(providers);
      const nextModels = { ...(config.models || {}) };
      const nextCaps = { ...(config.capabilities || {}) };
      const nextMaxTokens = { ...(config.maxTokens || {}) };
      if ('model' in body) {
        if (body.model === null || body.model === '') delete nextModels[key];
        else if (typeof body.model === 'string' && body.model.trim()) {
          const parsed = splitModelRef(body.model.trim(), defId);
          const provider = providers.find((p) => p.id === parsed.providerId);
          if (!provider) return sendError(res, 400, 'invalid_provider');
          // provider 列了对话模型就必须在列表里；没列（自建服务）则接受任意模型名
          const chatModels = chatModelsOf(provider, NON_CHAT_MODEL);
          if (chatModels.length && !chatModels.includes(parsed.model)) {
            return sendError(res, 400, 'invalid_model');
          }
          nextModels[key] = joinModelRef(provider.id, parsed.model);
        } else return sendError(res, 400, 'invalid_model');
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
      const sel2 = resolveModelFor(key);
      sendJson(res, 200, {
        ok: true,
        model: sel2 ? joinModelRef(sel2.provider.id, sel2.model) : '',
        maxTokens: maxTokensFor(key) || CHAT_MAX_TOKENS,
        capabilities: nextCaps[key] || [],
      });
      return;
    }

    if (method === 'POST' && path === '/api/chat/send') {
      if (!llmReady()) return sendError(res, 503, 'llm_unavailable');
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
          const found = await webSearch(text.replace(/^(帮我|请|麻烦)?(联网)?(搜索|搜一下|搜搜|查一下|查查)[:：]?\s*/i, '').slice(0, 120) || text.slice(0, 120));
          if (found) {
            const results = found.items;
            await appendMessage(convId, 'system', '联网搜索',
              '搜到 ' + results.length + ' 条（来自' + found.engine + '，请注意甄别）：\n'
              + results.map((r, i) => `${i + 1}. ${r.title}\n${r.snippet}\n${r.url}`).join('\n'),
              'system');
          } else {
            await appendMessage(convId, 'system', '联网搜索', '这次没搜到（几个搜索源都没通），只能凭印象答。', 'system');
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

    // 停止当前回合（长回合刹车：立刻中断正在进行的模型请求）
    if (method === 'POST' && path === '/api/chat/stop') {
      const body = await readBody(req).catch(() => ({}));
      const convId = typeof body.conv === 'string' && CONV_ID.test(body.conv) ? body.conv : 'group';
      const stopped = cancelTurn(convId);
      context.logger.info('maige-bot.chat.stopped', { conv: convId, stopped });
      sendJson(res, 200, { ok: true, stopped });
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
        llmReady: llmReady(),
        minimaxConfigured: !!minimax.resolveApiKey(process.env, config.minimaxApiKey),
        budget: getBudget(),
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
      if (body.budget && typeof body.budget === 'object') next.budget = normalizeBudget(body.budget);
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
    clearInterval(scheduleTimer); // 测试/独立运行时也要能干净退出
    context.signal.removeEventListener('abort', onAbort);
    await close(server);
  };
  const onAbort = () => { void dispose(); };
  context.signal.addEventListener('abort', onAbort, { once: true });
  if (context.signal.aborted) await dispose();

  return { dispose };
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
