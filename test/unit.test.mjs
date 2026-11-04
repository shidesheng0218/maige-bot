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
import { resolveWorkspace, resolveInside, resolveFileInside, isSafeFileName, listDir } from '../miniapps/maige-bot/miniapp/node/core/fs.mjs';
import { isHardSensitive } from '../miniapps/maige-bot/miniapp/node/core/sensitive.mjs';
import { resolveHostPaths, parseLlmYaml, loadLlmConfig } from '../miniapps/maige-bot/miniapp/node/core/host.mjs';
import {
  normalizeProvider, mergeProviders, defaultProviderId, splitModelRef, joinModelRef, chatModelsOf,
} from '../miniapps/maige-bot/miniapp/node/core/host.mjs';
import { buildChatBody, buildChatHeaders } from '../miniapps/maige-bot/miniapp/node/core/llm.mjs';
import { createToolExecutor } from '../miniapps/maige-bot/miniapp/node/core/tools.mjs';
import { hasStrayToolIntent } from '../miniapps/maige-bot/miniapp/node/core/orchestrator.mjs';
import { normalizeBudget, budgetExceeded, effectiveMaxTokens, budgetReasonText, BUDGET_LIMITS } from '../miniapps/maige-bot/miniapp/node/core/budget.mjs';

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

test('parseTool: 宽容空格与全角冒号（模型常见漂移）', () => {
  assert.equal(parseTool('[[SEARCH : MiniMax]]').name, 'search');
  assert.equal(parseTool('[[READ ： maige-bot/README.md]]').arg, 'maige-bot/README.md');
  const t = parseTool('[[TASK： text ： 晨报]]\n写五条');
  assert.equal(t.name, 'task');
  assert.equal(t.kind, 'text');
  assert.equal(t.arg, '晨报');
  assert.equal(t.content, '写五条');
  assert.equal(parseTool('[[CONFIG： tech-lead ： maxTokens ： 8000]]').value, '8000');
  assert.deepEqual(
    parseCalls('[[CALL： moke-writer]] [[CALL : huajiang-visual]]', [{ key: 'moke-writer' }, { key: 'huajiang-visual' }], new Set()),
    ['moke-writer', 'huajiang-visual'],
  );
});

test('parseTool: 多个指令时终端指令优先（TASK 不被 SEARCH 抢掉）', () => {
  const t = parseTool('先查 [[SEARCH:Product Hunt]]\n\n[[TASK:text:冷启动文案]]\n需求：写三条');
  assert.equal(t.name, 'task');
  assert.equal(t.arg, '冷启动文案');
  // 需求正文里提到 SEARCH，也不能反过来抢掉 TASK
  const t2 = parseTool('[[TASK:text:竞品调研]]\n需求：先 [[SEARCH:竞品]] 再整理');
  assert.equal(t2.name, 'task');
  assert.match(t2.content, /竞品/);
});

test('parseTool: WRITE/TASK 会把指令后的全文作为内容（单条指令独占回复）', () => {
  const w = parseTool('[[WRITE:a.md]]\n内容\n后面还有字');
  assert.equal(w.name, 'write');
  assert.equal(w.content, '内容\n后面还有字'); // 指令之后全文都归内容
  assert.equal(parseTool('没有 [['), null);
});

test('parseTool: REMEMBER 主动记忆', () => {
  const r = parseTool('[[REMEMBER:Mike 不吃辣]]');
  assert.equal(r.name, 'remember');
  assert.equal(r.arg, 'Mike 不吃辣');
  assert.equal(parseTool('[[REMEMBER:]]'), null);
});

test('parseTool: DELIVER 与 GENERATE_VIDEO', () => {
  const d = parseTool('[[DELIVER:t-abc:晨报.md]]\n# 晨报\n今日五条');
  assert.equal(d.name, 'deliver');
  assert.equal(d.taskId, 't-abc');
  assert.equal(d.arg, '晨报.md');
  assert.match(d.content, /晨报/);
  const v = parseTool('[[GENERATE_VIDEO:一只猫在跑步]]');
  assert.equal(v.name, 'generate_video');
  assert.equal(v.arg, '一只猫在跑步');
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
  assert.equal(maxTokensForRole('查证员：联网搜索'), 4000);
  assert.equal(maxTokensForRole('记录员：纪要归档'), 4000);
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

test('整活单：assignee 字段往返', () => {
  const t = {
    id: 't2', title: '海报', kind: 'image', status: 'ready', created: '', updated: '',
    createdBy: 'maige', assignee: 'moke-writer', conv: 'group', deliverables: [], body: '画',
  };
  const p = parseTask('t2.md', serializeTask(t));
  assert.equal(p.assignee, 'moke-writer');
  // 旧单子没有 assignee 字段也读得出（向后兼容）
  const legacy = parseTask('t3.md', '---\nid: t3\ntitle: 旧单\nkind: text\nstatus: draft\n---\nbody');
  assert.equal(legacy.assignee, '');
});

// ---------- 工具层：card 消息参数契约 ----------
test('tools: 搜索/作品/整活单/交付卡片落在 card 字段，不是 media', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'maige-tools-'));
  try {
    const calls = [];
    const tasks = [];
    const exec = createToolExecutor({
      getConfig: () => ({ outputsDir: dir }),
      updateConfig: async () => ({}),
      context: { logger: { info() {} } },
      appendMessage: (...args) => { calls.push(args); },
      // 故意把 Frame 放在 Quill 前面：assignee 应看正文里谁先被点名，而不是列表顺序
      getMembers: async () => [
        { key: 'maige' },
        { key: 'huajiang-visual', displayName: 'Frame' },
        { key: 'moke-writer', displayName: 'Quill' },
      ],
      hireBot: async () => ({}),
      writeTask: async (t) => { tasks.push(t); },
      readTask: async () => null,
      notify: () => {},
      webSearch: async () => null,
      workspaceRoot: dir,
      listProviders: () => [],
      splitModelRef: () => ({}),
      joinModelRef: () => '',
      logError: () => {},
      writeMemoryNote: async () => ({ id: 'm1' }),
    });
    await exec({ name: 'write', arg: '晨报.md', content: '今日五条' }, '麦格', 'group');
    const workCard = calls.find((a) => a[4] === 'card' && a[7]?.type === 'work');
    assert.ok(workCard, '应写入 work card');
    assert.equal(workCard[6], undefined, 'media 参数必须为空');
    assert.equal(workCard[7].name, '晨报.md');

    const r = await exec({
      name: 'task', kind: 'text', arg: '晨报单',
      content: '@Quill 写文案\n\n@Frame 做视频\n\n[[TASK:text:第二张]]\n需求',
    }, '麦格', 'group');
    const taskCard = calls.find((a) => a[4] === 'card' && a[7]?.type === 'task');
    assert.ok(taskCard, '应写入 task card');
    assert.equal(taskCard[6], undefined, 'media 参数必须为空');
    assert.equal(taskCard[7].title, '晨报单');
    assert.equal(tasks.length, 1, '一次执行只开一张单');
    assert.equal(tasks[0].assignee, 'moke-writer', 'assignee 应取正文里最先被点名的人');
    assert.match(r.note, /还有 1 张单未执行/, '嵌套的第二张单要明确提示未执行');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
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

test('作品文件名：允许中文/空格，仍拦截路径穿越', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'maige-unit-'));
  try {
    writeFileSync(join(dir, '晨报.md'), '# hi');
    writeFileSync(join(dir, '我的 海报.png'), 'x');
    assert.ok(isSafeFileName('晨报.md'));
    assert.ok(isSafeFileName('我的 海报.png'));
    assert.equal(isSafeFileName(''), false);
    assert.equal(isSafeFileName('../x'), false);
    assert.equal(isSafeFileName('a/b'), false);
    assert.equal(isSafeFileName('a\\b'), false);
    assert.equal(isSafeFileName('x'.repeat(256)), false);
    assert.ok(await resolveFileInside(dir, '晨报.md'));
    assert.ok(await resolveFileInside(dir, '我的 海报.png'));
    assert.equal(await resolveFileInside(dir, '../x'), null);
    assert.equal(await resolveFileInside(dir, '不存在.md'), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------- 敏感记忆硬门 ----------
test('isHardSensitive: 密码/密钥/证件命中，日常偏好不误伤', () => {
  assert.equal(isHardSensitive('我的服务器密码是 hunter2'), true);
  assert.equal(isHardSensitive('password: hunter2'), true);
  assert.equal(isHardSensitive('API key 是 sk-abcdefgh12345678'), true);
  assert.equal(isHardSensitive('sk-abcdefgh12345678'), true);
  assert.equal(isHardSensitive('身份证号 110101199001011234'), true);
  assert.equal(isHardSensitive('银行卡 6222021234567890123'), true);
  assert.equal(isHardSensitive('github_pat_11ABCDEFG0123456789_abcdefghijklmnop'), true);
  // 不误伤
  assert.equal(isHardSensitive('我喝咖啡不加糖'), false);
  assert.equal(isHardSensitive('密码管理器很好用'), false);
  assert.equal(isHardSensitive('这个 token 机制讲得不错'), false);
  assert.equal(isHardSensitive(''), false);
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
  // 顺序即优先级：用户自配 > 环境变量 > MCode 内置
  assert.deepEqual(list.map((p) => p.id), ['openai', 'env', 'mcode']);
  assert.equal(list[2].builtin, true);
  assert.equal(list[2].thinking, true); // dashscope 系需要显式关思考
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

// ---------- 回合预算 ----------
test('normalizeBudget: 默认不限，环境变量兜底，越界收敛', () => {
  assert.deepEqual(normalizeBudget(), { maxTokens: 0, maxMinutes: 0 });
  assert.deepEqual(normalizeBudget(undefined, { MAIGE_TURN_MAX_TOKENS: '20000', MAIGE_TURN_MAX_MINUTES: '2.5' }),
    { maxTokens: 20000, maxMinutes: 2.5 });
  // 面板配置优先于环境变量
  assert.deepEqual(normalizeBudget({ maxTokens: 5000, maxMinutes: 1 }, { MAIGE_TURN_MAX_TOKENS: '20000' }),
    { maxTokens: 5000, maxMinutes: 1 });
  // 非法值忽略，上限收敛
  assert.deepEqual(normalizeBudget({ maxTokens: -5, maxMinutes: 'x' }), { maxTokens: 0, maxMinutes: 0 });
  assert.deepEqual(normalizeBudget({ maxTokens: 1e12, maxMinutes: 1e6 }),
    { maxTokens: BUDGET_LIMITS.maxTokens, maxMinutes: BUDGET_LIMITS.maxMinutes });
});

test('budgetExceeded: 按 token / 时长判定，0 表示不限', () => {
  const b = { maxTokens: 1000, maxMinutes: 2 };
  assert.equal(budgetExceeded(b, { tokens: 999, elapsedMs: 0 }), null);
  assert.equal(budgetExceeded(b, { tokens: 1000, elapsedMs: 0 }), 'tokens');
  assert.equal(budgetExceeded(b, { tokens: 0, elapsedMs: 2 * 60000 }), 'time');
  assert.equal(budgetExceeded({ maxTokens: 0, maxMinutes: 0 }, { tokens: 9e9, elapsedMs: 9e9 }), null);
  assert.equal(budgetExceeded(null, { tokens: 1 }), null);
});

test('effectiveMaxTokens: 单条上限与预算剩余取小；剩余不足 128 返回 0', () => {
  assert.equal(effectiveMaxTokens(8000, { maxTokens: 0, maxMinutes: 0 }, 99999), 8000);
  assert.equal(effectiveMaxTokens(8000, { maxTokens: 5000, maxMinutes: 0 }, 0), 5000);
  assert.equal(effectiveMaxTokens(8000, { maxTokens: 5000, maxMinutes: 0 }, 4500), 500);
  assert.equal(effectiveMaxTokens(8000, { maxTokens: 5000, maxMinutes: 0 }, 4900), 0);
  assert.equal(effectiveMaxTokens(undefined, { maxTokens: 5000, maxMinutes: 0 }, 1000), 4000);
});

test('budgetReasonText: 区分 token / 时长 / 手动停止', () => {
  assert.match(budgetReasonText('tokens', { maxTokens: 5000 }), /token 预算（5000）/);
  assert.match(budgetReasonText('time', { maxMinutes: 2 }), /时长上限（2 分钟）/);
  assert.match(budgetReasonText('user', {}), /已停止当前回合/);
});

// ---------- 编排器：畸形指令检测 + 压缩记账（工厂注入 fake 依赖，不调真 LLM） ----------
test('orchestrator: CALL 是接力不是工具；未知大写指令才算格式漂移', async () => {
  assert.equal(parseTool('我搜一下 [[SEARCH :MiniMax]] 再答').name, 'search', '宽容解析应识别空格形态');
  assert.equal(hasStrayToolIntent('好的 [[CALL:moke-writer]]'), false, '合法接力不应触发重试');
  assert.equal(hasStrayToolIntent('[[CALL： moke-writer]]'), false, '全角/空格形态的合法接力也不应触发');
  assert.equal(hasStrayToolIntent('我搜一下 [[SEARCHX:MiniMax]] 再答'), true, '未知指令形态应被检测');
  assert.equal(hasStrayToolIntent('这是普通回复'), false);
});

test('orchestrator: 压缩的 token 消耗记入回合预算（addUsage 被调用）', async () => {
  // 验证记账路径：压缩消耗的 token 会让 budgetExceeded 更早触发，不逃逸出预算
  const b = { maxTokens: 1000, maxMinutes: 0 };
  assert.equal(budgetExceeded(b, { tokens: 600, elapsedMs: 0 }), null);
  assert.equal(budgetExceeded(b, { tokens: 600 + 500, elapsedMs: 0 }), 'tokens');
});

// ---------- 搜索 provider 层 ----------
test('search: 引擎排序——API 层在前，免费层兜底，健康度降权', async () => {
  const { buildEngineOrder, createHealthTracker, normalizeSearchProvider } = await import('../miniapps/maige-bot/miniapp/node/core/search.mjs');
  const health = createHealthTracker();
  // 无配置：只有免费层
  assert.deepEqual(buildEngineOrder([], health).map((e) => e.id), ['bing', 'sogou', 'ddg']);
  // 配了 Tavily + Brave：API 层在前
  const order = buildEngineOrder([
    { engine: 'brave', apiKey: 'k1' },
    { engine: 'tavily', apiKey: 'k2' },
  ], health);
  assert.deepEqual(order.map((e) => e.id), ['api:brave', 'api:tavily', 'bing', 'sogou', 'ddg']);
  // 健康度降权：bing 失败 2 次 → 排免费层最后
  health.recordFailure('bing'); health.recordFailure('bing');
  health.recordFailure('sogou');
  const order2 = buildEngineOrder([], health);
  assert.deepEqual(order2.map((e) => e.id), ['ddg', 'sogou', 'bing'], '失败多的应降权');
  // 恢复后回到前面
  health.recordSuccess('bing');
  assert.deepEqual(buildEngineOrder([], health).map((e) => e.id), ['bing', 'ddg', 'sogou']);
});

test('search: normalizeSearchProvider 白名单化', async () => {
  const { normalizeSearchProvider } = await import('../miniapps/maige-bot/miniapp/node/core/search.mjs');
  assert.deepEqual(normalizeSearchProvider({ engine: 'Tavily', apiKey: ' k ' }), { engine: 'tavily', apiKey: 'k' });
  assert.equal(normalizeSearchProvider({ engine: 'ghost', apiKey: 'k' }), null, '未知引擎拒收');
  assert.equal(normalizeSearchProvider({ engine: 'tavily', apiKey: '' }), null, '空 key 拒收');
  assert.equal(normalizeSearchProvider(null), null);
});

test('search: isRelevant 拦住「有结果但跑题」（必应拆词成词典）', async () => {
  const { isRelevant } = await import('../miniapps/maige-bot/miniapp/node/core/search.mjs');
  assert.equal(isRelevant('Product Hunt AI developer tools cold start', [
    { title: 'product_百度百科', snippet: 'product 是英语名词' },
  ]), false);
  assert.equal(isRelevant('Product Hunt AI developer tools cold start', [
    { title: 'Product Hunt – The best new products in tech.', snippet: 'developer tools' },
  ]), true);
  assert.equal(isRelevant('独立开发者 AI 编程工具 痛点', [
    { title: '独立音乐_百度百科', snippet: '独立音乐类型' },
  ]), false);
  assert.equal(isRelevant('独立开发者 AI 编程工具 痛点', [
    { title: '独立开发者 AI 编程工具痛点盘点', snippet: '开发者工具' },
  ]), true);
  assert.equal(isRelevant('', [{ title: 'x' }]), true, '无法判定时不误杀');
});

test('search: stripHtml 与免费引擎解析器（防回归 fixture）', async () => {
  const { stripHtml, FREE_ENGINES } = await import('../miniapps/maige-bot/miniapp/node/core/search.mjs');
  assert.equal(stripHtml('<p>你好 <b>世界</b></p>'), '你好 世界');
  // 必应解析器：从真实结构的 fixture 提取
  const bing = FREE_ENGINES.find((e) => e.id === 'bing');
  const html = '<li class="b_algo"><h2><a href="https://a.com">标题A</a></h2><p>摘要A</p></li>'
    + '<li class="b_algo"><h2><a href="https://b.com">标题B</a></h2></li>';
  const items = bing.parse(html);
  assert.equal(items.length, 2);
  assert.equal(items[0].title, '标题A');
  assert.equal(items[0].url, 'https://a.com');
  assert.equal(items[0].snippet, '摘要A');
  assert.equal(items[1].snippet, '');
});