// 纯函数单测：零依赖，node:test。CI 跑这个（不需要 LLM / MCode）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';

import {
  parseTool, parseCalls, parseAgentFrontmatter,
  parseMemory, serializeMemory, normalizeMemoryInput,
} from '../miniapps/maige-bot/miniapp/node/core/parse.mjs';
import { avatarSvgFor, kindOf, extOf } from '../miniapps/maige-bot/miniapp/node/core/avatar.mjs';
import { maxTokensForRole } from '../miniapps/maige-bot/miniapp/node/core/roles.mjs';
import { parseTask, serializeTask, TASK_TRANSITIONS } from '../miniapps/maige-bot/miniapp/node/core/tasks.mjs';
import { resolveWorkspace, resolveInside, listDir } from '../miniapps/maige-bot/miniapp/node/core/fs.mjs';
import { resolveHostPaths, parseLlmYaml, loadLlmConfig } from '../miniapps/maige-bot/miniapp/node/core/host.mjs';
import {
  normalizeProvider, mergeProviders, defaultProviderId, splitModelRef, joinModelRef, chatModelsOf,
} from '../miniapps/maige-bot/miniapp/node/core/host.mjs';
import { buildChatBody, buildChatHeaders } from '../miniapps/maige-bot/miniapp/node/core/llm.mjs';

// ---------- 工具指令解析 ----------
test('parseTool: 支持全部工具指令', () => {
  assert.deepEqual(parseTool('搜 [[SEARCH:MiniMax]]').name, 'search');
  assert.equal(parseTool('[[READ:maige-bot/README.md]]').arg, 'maige-bot/README.md');
  assert.equal(parseTool('看看 [[LS:maige-bot]] 先').name, 'ls');
  const w = parseTool('交付：[[WRITE:稿.md]]\n第一行\n第二行\n');
  assert.equal(w.name, 'write');
  assert.equal(w.arg, '稿.md');
  assert.equal(w.content, '第一行\n第二行');
  const t = parseTool('[[TASK:image:落日]]\n需求与提示词');
  assert.equal(t.kind, 'image');
  assert.equal(t.content, '需求与提示词');
  const h = parseTool('[[HIRE:tech-lead:技术负责人:Bolt]]\n人格');
  assert.deepEqual([h.name, h.arg, h.role, h.display], ['hire', 'tech-lead', '技术负责人', 'Bolt']);
  assert.equal(parseTool('[[CONFIG:moke-writer:maxTokens:8000]]').value, '8000');
  assert.equal(parseTool('[[CONFIG:tech-lead:model:deepseek-v4.1-flash]]').field, 'model');
  assert.equal(parseTool('[[GENERATE_IMAGE:一只猫]]').name, 'generate_image');
  assert.equal(parseTool('[[SPEAK:你好]]').name, 'speak');
  assert.equal(parseTool('没有指令'), null);
  assert.equal(parseTool('[[CALL:moke-writer]]'), null);
});

test('parseTool: WRITE/TASK 会把指令后的全文作为内容（单条指令独占回复）', () => {
  const w = parseTool('[[WRITE:a.md]]\n内容\n后面还有字');
  assert.equal(w.name, 'write');
  assert.equal(w.content, '内容\n后面还有字'); // 指令之后全文都归内容
  assert.equal(parseTool('没有 [['), null);
});

// ---------- 接力解析 ----------
test('parseCalls: 并行、去重、跳过已发言、上限 3', () => {
  const members = [{ key: 'a' }, { key: 'b' }, { key: 'c' }, { key: 'd' }];
  assert.deepEqual(parseCalls('[[CALL:a]] [[CALL:b]]', members, new Set()), ['a', 'b']);
  assert.deepEqual(parseCalls('[[CALL:a]] [[CALL:a]]', members, new Set()), ['a']);
  assert.deepEqual(parseCalls('[[CALL:a]]', members, new Set(['a'])), []);
  assert.deepEqual(parseCalls('[[CALL:a]] [[CALL:b]] [[CALL:c]] [[CALL:d]]', members, new Set()), ['a', 'b', 'c']);
  assert.deepEqual(parseCalls('[[CALL:ghost]]', members, new Set()), []);
});

// ---------- frontmatter / 记忆 ----------
test('parseAgentFrontmatter: 读取团队标记与显示名', () => {
  const fm = parseAgentFrontmatter('---\nname: x\ndisplay: Quill\nteam: maige\n---\n正文');
  assert.equal(fm.display, 'Quill');
  assert.equal(fm.team, 'maige');
});

test('记忆文件：序列化→解析 往返一致', () => {
  const src = {
    name: '偏好', description: '喝咖啡不加糖', source: 'user',
    date: '2026-01-02', sensitive: false, body: '正文内容\n第二行',
  };
  const parsed = parseMemory('m1', serializeMemory(src));
  assert.equal(parsed.name, src.name);
  assert.equal(parsed.description, src.description);
  assert.equal(parsed.source, 'user');
  assert.equal(parsed.date, '2026-01-02');
  assert.equal(parsed.sensitive, false);
  assert.equal(parsed.body, src.body);
});

test('记忆输入校验：拒绝空名/空正文，非法 source 回落 user', () => {
  assert.equal(normalizeMemoryInput({ name: '', body: 'x' }).error, 'invalid_name');
  assert.equal(normalizeMemoryInput({ name: 'n', body: '' }).error, 'invalid_body_content');
  const v = normalizeMemoryInput({ name: 'n', body: 'x', source: 'hacker', sensitive: 'yes' });
  assert.equal(v.value.source, 'user');
  assert.equal(v.value.sensitive, false);
});

// ---------- 头像 ----------
test('avatarSvgFor: 确定性、合法 SVG、不同种子不同图', () => {
  const a = avatarSvgFor('nova');
  assert.equal(a, avatarSvgFor('nova'));
  assert.notEqual(a, avatarSvgFor('pax'));
  assert.match(a, /^<svg[^>]*>.*<\/svg>$/s);
  assert.match(a, /<rect/);
});

test('kindOf/extOf: 媒体类型判定', () => {
  assert.equal(kindOf('a.PNG'), 'image');
  assert.equal(kindOf('a.mp4'), 'video');
  assert.equal(kindOf('a.mp3'), 'audio');
  assert.equal(kindOf('a.md'), 'file');
  assert.equal(extOf('a.tar.gz'), '.gz');
});

// ---------- 角色分档 ----------
test('maxTokensForRole: 按职责关键词取档', () => {
  assert.equal(maxTokensForRole('麦格团队的写手：文案、脚本'), 200000);
  assert.equal(maxTokensForRole('技术负责人：代码评审'), 50000);
  assert.equal(maxTokensForRole('主管：调度'), 8000);
  assert.equal(maxTokensForRole('评审员：挑刺'), 4000);
  assert.equal(maxTokensForRole('查证员：联网搜索'), 2000);
  assert.equal(maxTokensForRole('未知角色'), 4000);
  assert.equal(maxTokensForRole(''), 4000);
});

// ---------- 整活单 ----------
test('整活单：序列化→解析 往返一致', () => {
  const t = {
    id: 't1', title: '海报', kind: 'image', status: 'ready',
    created: '2026-01-01T00:00:00Z', updated: '2026-01-02T00:00:00Z',
    createdBy: '麦格', conv: 'group', deliverables: ['a.png', 'b.md'], body: '需求',
  };
  const p = parseTask('t1.md', serializeTask(t));
  assert.equal(p.title, '海报');
  assert.equal(p.kind, 'image');
  assert.equal(p.status, 'ready');
  assert.deepEqual(p.deliverables, ['a.png', 'b.md']);
  assert.equal(p.body, '需求');
});

test('整活单：状态机只允许合法转移', () => {
  assert.ok(TASK_TRANSITIONS.draft.includes('ready'));
  assert.ok(TASK_TRANSITIONS.ready.includes('making'));
  assert.ok(TASK_TRANSITIONS.making.includes('done'));
  assert.deepEqual(TASK_TRANSITIONS.done, []);
  assert.ok(TASK_TRANSITIONS.cancelled.includes('draft'));
  assert.ok(!TASK_TRANSITIONS.draft.includes('done'));
});

// ---------- 文件边界 ----------
test('resolveWorkspace/resolveInside: 允许内部路径，拦截穿越', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'maige-unit-'));
  try {
    writeFileSync(join(dir, 'x.md'), 'hi');
    assert.ok(await resolveWorkspace(dir, 'x.md'));
    assert.equal(await resolveWorkspace(dir, '../secret'), null);
    assert.equal(await resolveWorkspace(dir, '/etc/hosts'), null);
    assert.ok(await resolveInside(dir, 'x.md'));
    assert.equal(await resolveInside(dir, '../x.md'), null);
    assert.equal(await resolveInside(dir, '..'), null);
    const listed = await listDir(dir);
    assert.ok(listed.dirExists && listed.items.some((i) => i.name === 'x.md'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------- 宿主适配层 ----------
test('resolveHostPaths: 环境变量覆盖优先', () => {
  const p = resolveHostPaths({
    HOME: '/home/u', MAIGE_ROOT: '/r', MAIGE_MEMORY_DIR: '/m',
    MAIGE_AGENTS_DIR: '/a', MAIGE_ICONS_DIRS: '/i1:/i2',
  });
  assert.equal(p.root, '/r');
  assert.equal(p.memoryDir, '/m');
  assert.equal(p.agentsDir, '/a');
  assert.deepEqual(p.iconsDirs, ['/i1', '/i2']);
  assert.equal(p.outputsDir, '/r/maige-outputs');
});

test('parseLlmYaml: 解析 dashscope 块；缺失时返回 null', () => {
  const yaml = [
    'providers:',
    '  dashscope:',
    '    provider: dashscope',
    '    baseURL: https://example.com/v1',
    '    apiKey: sk-test',
    '    models:',
    '      kimi-k3:',
    '        name: kimi-k3',
    '      deepseek-v4.1-flash:',
    '        name: deepseek-v4.1-flash',
    '  other:',
    '    baseURL: https://other/v1',
  ].join('\n');
  const cfg = parseLlmYaml(yaml);
  assert.equal(cfg.baseURL, 'https://example.com/v1');
  assert.equal(cfg.apiKey, 'sk-test');
  assert.deepEqual(cfg.models, ['kimi-k3', 'deepseek-v4.1-flash']);
  assert.equal(parseLlmYaml('nothing: here'), null);
});

test('loadLlmConfig: MAIGE_LLM_* 环境变量优先于 config.yaml', () => {
  const cfg = loadLlmConfig({
    HOME: '/home/u',
    MAIGE_LLM_BASE_URL: 'https://api.example/v1/',
    MAIGE_LLM_API_KEY: 'k',
    MAIGE_LLM_MODELS: 'm1, m2',
  });
  assert.equal(cfg.baseURL, 'https://api.example/v1');
  assert.equal(cfg.apiKey, 'k');
  assert.deepEqual(cfg.models, ['m1', 'm2']);
  assert.equal(cfg.source, 'env');
});

// ---------- 自带模型（provider） ----------
test('normalizeProvider: 白名单化字段，拒绝非法 id/baseURL', () => {
  const p = normalizeProvider({
    id: 'OpenAI', name: ' OpenAI ', baseURL: 'https://api.openai.com/v1/',
    apiKey: 'sk-x', models: ['gpt-4o', '', 'gpt-4o-mini'], defaultModel: 'gpt-4o',
  });
  assert.equal(p.id, 'openai');
  assert.equal(p.name, 'OpenAI');
  assert.equal(p.baseURL, 'https://api.openai.com/v1');
  assert.deepEqual(p.models, ['gpt-4o', 'gpt-4o-mini']);
  assert.equal(p.defaultModel, 'gpt-4o');
  assert.equal(p.thinking, false);
  assert.equal(p.streamUsage, true);
  assert.equal(normalizeProvider({ id: 'Bad Id', baseURL: 'https://x.dev' }), null);
  assert.equal(normalizeProvider({ id: 'ok', baseURL: 'ftp://x.dev' }), null);
  assert.equal(normalizeProvider({ id: 'ok' }), null);
});

test('mergeProviders: 用户配置优先，内建去重', () => {
  const list = mergeProviders(
    [{ id: 'openai', name: 'OpenAI', baseURL: 'https://api.openai.com/v1', apiKey: 'k', models: ['gpt-4o'] }],
    { baseURL: 'https://dashscope/v1', apiKey: 'dk', models: ['kimi-k3'] },
    { baseURL: 'https://env/v1', apiKey: 'ek', models: ['e1'] },
  );
  assert.deepEqual(list.map((p) => p.id), ['openai', 'mcode', 'env']);
  assert.equal(list[1].builtin, true);
  assert.equal(list[1].thinking, true); // dashscope 系需要显式关思考
  assert.equal(defaultProviderId(list), 'openai');
  // 同 id 去重（用户配置不会被内建覆盖）
  const dup = mergeProviders([{ id: 'mcode', baseURL: 'https://mine.dev/v1', apiKey: 'x', models: ['q'] }], { baseURL: 'https://d/v1', apiKey: 'dk', models: ['kimi-k3'] }, null);
  assert.equal(dup.length, 1);
  assert.equal(dup[0].baseURL, 'https://mine.dev/v1');
});

test('splitModelRef/joinModelRef: provider/model 与裸模型兼容', () => {
  assert.deepEqual(splitModelRef('openai/gpt-4o', 'def'), { providerId: 'openai', model: 'gpt-4o' });
  assert.deepEqual(splitModelRef('gpt-4o', 'def'), { providerId: 'def', model: 'gpt-4o' });
  assert.equal(splitModelRef('', 'def'), null);
  assert.equal(joinModelRef('openai', 'gpt-4o'), 'openai/gpt-4o');
});

test('chatModelsOf: 过滤图像/语音等非对话模型', () => {
  const p = { models: ['gpt-4o', 'qwen-image-3.0-pro', 'speech-2.8-hd', 'gpt-4o-mini'] };
  assert.deepEqual(chatModelsOf(p), ['gpt-4o', 'gpt-4o-mini']);
});

test('buildChatBody: 思考参数与 usage 统计按 provider 能力开关', () => {
  const plain = { baseURL: 'x', apiKey: 'k', models: [], thinking: false, streamUsage: true };
  const body = buildChatBody(plain, { system: 's', userContent: 'u', model: 'm', maxTokens: 100 });
  assert.equal(body.model, 'm');
  assert.equal(body.max_tokens, 100);
  assert.equal('thinking' in body, false);
  assert.equal('stream_options' in body, false);

  const dashscope = { ...plain, thinking: true };
  const body2 = buildChatBody(dashscope, { system: 's', userContent: 'u', stream: true });
  assert.deepEqual(body2.thinking, { type: 'disabled' });
  assert.deepEqual(body2.stream_options, { include_usage: true });

  const noUsage = { ...plain, streamUsage: false };
  const body3 = buildChatBody(noUsage, { system: 's', userContent: 'u', stream: true });
  assert.equal('stream_options' in body3, false);
});

test('buildChatHeaders: 鉴权头可配（Azure 之类用 api-key）', () => {
  assert.deepEqual(
    buildChatHeaders({ apiKey: 'k', authHeader: 'authorization', authPrefix: 'Bearer ' }),
    { 'content-type': 'application/json', authorization: 'Bearer k' },
  );
  assert.deepEqual(
    buildChatHeaders({ apiKey: 'k', authHeader: 'api-key', authPrefix: '' }),
    { 'content-type': 'application/json', 'api-key': 'k' },
  );
});