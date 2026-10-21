// 宿主适配层：本项目对 MiniMax Code 私有布局的全部依赖都收在这个文件里。
// 目的：MCode 升级（插件目录/agents 目录/config.yaml 格式变化）时，只需要改这里。
// 非 MCode 环境：用 MAIGE_LLM_BASE_URL / MAIGE_LLM_API_KEY / MAIGE_LLM_MODELS 直接接任意
// OpenAI 兼容端点，不依赖 config.yaml。

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

/** 解析项目/宿主路径（全部可被环境变量覆盖，默认从 $HOME 推导） */
export function resolveHostPaths(env = process.env) {
  const HOME = env.HOME || homedir();
  const root = env.MAIGE_ROOT || join(HOME, 'Documents', 'minimax项目');
  const minimaxHome = env.MINIMAX_HOME || join(HOME, '.minimax');
  return {
    root,
    minimaxHome,
    memoryDir: env.MAIGE_MEMORY_DIR || join(root, 'maige-bot', 'memory'),
    outputsDir: env.MAIGE_OUTPUTS_DIR || join(root, 'maige-outputs'),
    tasksDir: env.MAIGE_TASKS_DIR || join(root, 'maige-bot', 'tasks'),
    capsDir: env.MAIGE_CAPS_DIR || join(root, 'maige-bot', 'capabilities'),
    workspaceRoot: env.MAIGE_WORKSPACE_ROOT || root,
    agentsDir: env.MAIGE_AGENTS_DIR || join(minimaxHome, 'agents'),
    pluginManifest: env.MAIGE_PLUGIN_MANIFEST || join(minimaxHome, 'plugins', 'maige-bot', '.minimax-plugin', 'plugin.json'),
    minimaxConfigYaml: env.MAIGE_LLM_CONFIG || join(minimaxHome, 'config.yaml'),
    trashBin: env.MAIGE_TRASH_BIN || join(minimaxHome, 'bin', 'mavis-trash'),
    iconsDirs: env.MAIGE_ICONS_DIRS
      ? env.MAIGE_ICONS_DIRS.split(':')
      : [join(root, 'maige-outputs', 'icons-v2'), join(root, 'maige-outputs', 'icons')],
  };
}

/** 从 config.yaml 文本里解析 OpenAI 兼容 provider 块（dashscope / claudecode 兜底） */
export function parseLlmYaml(raw) {
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
  return { apiKey, baseURL: baseURL.replace(/\/$/, ''), models: modelsFromBlock(found.lines), source: 'config.yaml' };
}

/** 从 provider 块提取 models: 映射里的模型 id（4 空格 models: → 6 空格模型名） */
export function modelsFromBlock(lines) {
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

/** 模型来源解析：环境变量优先（任意 OpenAI 兼容端点），否则解析 MCode 的 config.yaml */
export function loadLlmConfig(env = process.env, paths = resolveHostPaths(env)) {
  if (env.MAIGE_LLM_BASE_URL && env.MAIGE_LLM_API_KEY) {
    return {
      apiKey: env.MAIGE_LLM_API_KEY,
      baseURL: env.MAIGE_LLM_BASE_URL.replace(/\/$/, ''),
      models: String(env.MAIGE_LLM_MODELS || '').split(',').map((s) => s.trim()).filter(Boolean),
      source: 'env',
    };
  }
  try {
    return parseLlmYaml(readFileSync(paths.minimaxConfigYaml, 'utf8'));
  } catch {
    return null;
  }
}

// ================= 自带模型（多 provider） =================

export const PROVIDER_ID = /^[a-z][a-z0-9-]{0,31}$/;

/** 规范化一个 provider（白名单化：只保留允许的字段与安全取值） */
export function normalizeProvider(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id ?? '').trim().toLowerCase();
  if (!PROVIDER_ID.test(id)) return null;
  const baseURL = String(raw.baseURL ?? '').trim().replace(/\/$/, '');
  if (!baseURL || !/^https?:\/\//i.test(baseURL)) return null;
  const models = Array.isArray(raw.models)
    ? raw.models.map((m) => String(m).trim()).filter((m) => m && m.length <= 64).slice(0, 50)
    : [];
  const defaultModel = String(raw.defaultModel ?? '').trim() || models[0] || '';
  if (!models.length && defaultModel) models.push(defaultModel); // 只填默认模型也可用
  return {
    id,
    name: String(raw.name ?? '').trim().slice(0, 40) || id,
    baseURL,
    apiKey: String(raw.apiKey ?? '').trim(),
    models,
    defaultModel,
    // 思考参数（dashscope/Qwen 系需要；OpenAI 兼容端点普遍不认，发了会 400）
    thinking: raw.thinking === true,
    // 是否在流式请求里带 stream_options（要 usage 统计；个别自建服务会拒绝未知字段）
    streamUsage: raw.streamUsage !== false,
    // 鉴权头（多数服务是 authorization: Bearer；Azure 之类是 api-key）
    authHeader: /^[A-Za-z0-9-]{1,40}$/.test(String(raw.authHeader ?? '')) ? String(raw.authHeader) : 'authorization',
    authPrefix: typeof raw.authPrefix === 'string' ? String(raw.authPrefix) : 'Bearer ',
    builtin: raw.builtin === true,
  };
}

/** 合并用户配置的 provider 与内建 provider（MCode config.yaml / 环境变量），返回按 id 去重的列表 */
export function mergeProviders(userProviders, builtinMCode, envProvider) {
  const out = [];
  const seen = new Set();
  const push = (p) => {
    const n = p && normalizeProvider(p);
    if (!n || seen.has(n.id)) return;
    seen.add(n.id);
    out.push(n);
  };
  for (const p of Array.isArray(userProviders) ? userProviders : []) push(p);
  if (builtinMCode) {
    const mModels = builtinMCode.models || [];
    // 内建默认模型：优先 kimi-k3（面板历史默认），否则列表第一个
    const mDefault = mModels.includes('kimi-k3') ? 'kimi-k3' : (mModels[0] || '');
    push({
      id: 'mcode', name: 'MiniMax Code', baseURL: builtinMCode.baseURL, apiKey: builtinMCode.apiKey,
      models: mModels, defaultModel: mDefault,
      thinking: true, // dashscope 系：必须显式关思考，否则 reasoning 模型 content 为空
      builtin: true,
    });
  }
  if (envProvider) {
    push({
      id: 'env', name: '环境变量', baseURL: envProvider.baseURL, apiKey: envProvider.apiKey,
      models: envProvider.models || [], defaultModel: envProvider.models?.[0] || '',
      thinking: false, builtin: true,
    });
  }
  return out;
}

/** 默认 provider：优先用户配置的第一条，其次内建 */
export function defaultProviderId(providers) {
  if (!providers.length) return '';
  const user = providers.find((p) => !p.builtin);
  return (user || providers[0]).id;
}

/** 解析模型引用：'provider/model' 或裸 model id（旧格式，向后兼容） */
export function splitModelRef(value, fallbackProviderId) {
  const v = String(value ?? '').trim();
  if (!v) return null;
  const i = v.indexOf('/');
  if (i > 0) {
    const providerId = v.slice(0, i).trim();
    const model = v.slice(i + 1).trim();
    if (providerId && model) return { providerId, model };
  }
  return { providerId: fallbackProviderId || '', model: v };
}

/** 拼回引用格式 */
export function joinModelRef(providerId, model) {
  return `${providerId}/${model}`;
}

/** provider 的对话模型（过滤图像/语音/音乐/视频/向量类模型——它们不能用来聊天） */
export function chatModelsOf(provider, nonChatPattern) {
  const re = nonChatPattern || /image|tts|speech|voice|music|video|embedding|vl-/i;
  return (provider?.models || []).filter((m) => !re.test(m));
}