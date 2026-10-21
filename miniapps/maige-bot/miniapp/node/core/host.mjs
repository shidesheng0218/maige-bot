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